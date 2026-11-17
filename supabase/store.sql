-- ---------------------------------------------------------------------------
-- Loca Store: catalogue, orders, wishlist (run after profiles.sql, rewards.sql, account-approval.sql)
--
--   • Catalogue is PUBLIC to read (anon + authenticated, active products only).
--   • Ordering needs a signed-in, approved member (or staff). Orders are written ONLY through
--     place_order(): prices and stock are validated on the server, never trusted from the browser.
--   • Stock is deducted when staff moves an order past "new" (confirmed / ready / completed) and
--     given back if a deducted order is cancelled. Placing an order does not reserve stock.
--   • Admin Store, Admin Umum and Owner manage everything (public.can_manage_store()).
-- ---------------------------------------------------------------------------

create table if not exists public.store_products (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 500),
  category text not null check (category in ('boardgame', 'pokemon_single', 'pokemon_sealed', 'accessories')),
  card_info text check (char_length(card_info) <= 80),   -- e.g. set + card number for Pokemon singles
  price integer not null check (price >= 0),             -- IDR, whole rupiah
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists store_products_category_idx on public.store_products (category, is_active);
create index if not exists store_products_created_by_idx on public.store_products (created_by);
alter table public.store_products enable row level security;

drop policy if exists "Read store products" on public.store_products;
create policy "Read store products" on public.store_products for select to anon, authenticated
  using (is_active or (select public.can_manage_store()));
drop policy if exists "Store admin insert products" on public.store_products;
create policy "Store admin insert products" on public.store_products for insert to authenticated
  with check ((select public.can_manage_store()));
drop policy if exists "Store admin update products" on public.store_products;
create policy "Store admin update products" on public.store_products for update to authenticated
  using ((select public.can_manage_store())) with check ((select public.can_manage_store()));
drop policy if exists "Store admin delete products" on public.store_products;
create policy "Store admin delete products" on public.store_products for delete to authenticated
  using ((select public.can_manage_store()));

create table if not exists public.store_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  buyer_name text,
  buyer_phone text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'completed', 'cancelled')),
  total integer not null check (total >= 0),
  note text check (char_length(note) <= 300),
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_orders_user_idx on public.store_orders (user_id, created_at desc);
create index if not exists store_orders_status_idx on public.store_orders (status, created_at desc);
alter table public.store_orders enable row level security;

drop policy if exists "Read own or managed store orders" on public.store_orders;
create policy "Read own or managed store orders" on public.store_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_store()));
-- No insert / update / delete policies on purpose: only the security-definer functions below write.

create table if not exists public.store_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.store_orders(id) on delete cascade,
  product_id bigint references public.store_products(id) on delete set null,
  name text not null,                 -- snapshot, so history survives product edits / deletes
  price integer not null check (price >= 0),
  qty integer not null check (qty between 1 and 99)
);
create index if not exists store_order_items_order_idx on public.store_order_items (order_id);
create index if not exists store_order_items_product_idx on public.store_order_items (product_id);
alter table public.store_order_items enable row level security;

drop policy if exists "Read own or managed store order items" on public.store_order_items;
create policy "Read own or managed store order items" on public.store_order_items for select to authenticated
  using (
    (select public.can_manage_store())
    or exists (select 1 from public.store_orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- "Titip cari": members tell the store what they want (sold out / not listed).
create table if not exists public.store_wishlist (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id bigint references public.store_products(id) on delete set null,
  note text not null check (char_length(note) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists store_wishlist_user_idx on public.store_wishlist (user_id);
create index if not exists store_wishlist_product_idx on public.store_wishlist (product_id);
alter table public.store_wishlist enable row level security;

drop policy if exists "Read own or managed wishlist" on public.store_wishlist;
create policy "Read own or managed wishlist" on public.store_wishlist for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_store()));
drop policy if exists "Insert own wishlist" on public.store_wishlist;
create policy "Insert own wishlist" on public.store_wishlist for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Delete own or managed wishlist" on public.store_wishlist;
create policy "Delete own or managed wishlist" on public.store_wishlist for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_store()));

-- ---------------------------------------------------------------------------
-- place_order: items = [{"product_id": 1, "qty": 2}, ...]  → returns the new order id
-- ---------------------------------------------------------------------------
create or replace function public.place_order(items jsonb, order_note text default null)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
  line jsonb;
  prod public.store_products;
  wanted integer;
  merged jsonb := '{}'::jsonb;
  pid text;
  new_order_id bigint;
  running_total integer := 0;
begin
  if uid is null then raise exception 'Silakan masuk dulu untuk memesan'; end if;
  select * into me from public.profiles where id = uid;
  if not found or not (me.approved or me.role <> 'member') then raise exception 'Akunmu belum diverifikasi owner'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception 'Keranjang kosong'; end if;
  if jsonb_array_length(items) > 30 then raise exception 'Maksimal 30 jenis barang per pesanan'; end if;

  -- merge duplicate product lines
  for line in select * from jsonb_array_elements(items) loop
    wanted := coalesce((line->>'qty')::integer, 0);
    if wanted < 1 or wanted > 99 or (line->>'product_id') is null then raise exception 'Data keranjang tidak valid'; end if;
    merged := jsonb_set(merged, array[line->>'product_id'], to_jsonb(coalesce((merged->>(line->>'product_id'))::integer, 0) + wanted));
  end loop;

  insert into public.store_orders (user_id, buyer_name, buyer_phone, total, note)
  values (uid, me.full_name, me.phone, 0, nullif(left(trim(coalesce(order_note, '')), 300), ''))
  returning id into new_order_id;

  for pid in select jsonb_object_keys(merged) order by 1 loop
    wanted := (merged->>pid)::integer;
    select * into prod from public.store_products where id = pid::bigint for share;
    if not found or not prod.is_active then raise exception 'Ada produk yang sudah tidak tersedia'; end if;
    if prod.stock < wanted then raise exception 'Stok "%" tinggal %', prod.name, prod.stock; end if;
    insert into public.store_order_items (order_id, product_id, name, price, qty) values (new_order_id, prod.id, prod.name, prod.price, wanted);
    running_total := running_total + prod.price * wanted;
  end loop;

  update public.store_orders set total = running_total where id = new_order_id;
  return new_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_order_status: staff only. Deducts stock on first move past "new", restores on cancel.
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(order_id bigint, new_status text)
returns public.store_orders
language plpgsql
security definer set search_path = public
as $$
declare
  ord public.store_orders;
  it record;
  prod public.store_products;
begin
  if not public.can_manage_store() then raise exception 'Hanya admin store yang boleh mengubah pesanan'; end if;
  if new_status not in ('new', 'confirmed', 'ready', 'completed', 'cancelled') then raise exception 'Status tidak valid'; end if;
  select * into ord from public.store_orders where id = order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;

  if new_status in ('confirmed', 'ready', 'completed') and not ord.stock_deducted then
    for it in select * from public.store_order_items where store_order_items.order_id = ord.id and product_id is not null loop
      select * into prod from public.store_products where id = it.product_id for update;
      if prod.stock < it.qty then raise exception 'Stok "%" tidak cukup (sisa %, dipesan %)', prod.name, prod.stock, it.qty; end if;
      update public.store_products set stock = stock - it.qty where id = it.product_id;
    end loop;
    ord.stock_deducted := true;
  elsif new_status in ('new', 'cancelled') and ord.stock_deducted then
    for it in select * from public.store_order_items where store_order_items.order_id = ord.id and product_id is not null loop
      update public.store_products set stock = stock + it.qty where id = it.product_id;
    end loop;
    ord.stock_deducted := false;
  end if;

  update public.store_orders set status = new_status, stock_deducted = ord.stock_deducted, updated_at = now()
  where id = ord.id returning * into ord;
  return ord;
end;
$$;

revoke all on function public.set_order_status(bigint, text) from public, anon;
grant execute on function public.set_order_status(bigint, text) to authenticated;

-- Store staff cannot read other members' profiles (RLS), so the wishlist list joins the buyer here.
create or replace function public.list_store_wishlist()
returns table (id bigint, note text, created_at timestamptz, product_id bigint, product_name text, buyer_name text, buyer_phone text)
language sql
stable
security definer set search_path = public
as $$
  select w.id, w.note, w.created_at, w.product_id, p.name, pr.full_name, pr.phone
  from public.store_wishlist w
  left join public.store_products p on p.id = w.product_id
  left join public.profiles pr on pr.id = w.user_id
  where public.can_manage_store()
  order by w.created_at desc
  limit 200;
$$;

revoke all on function public.list_store_wishlist() from public, anon;
grant execute on function public.list_store_wishlist() to authenticated;

-- ---------------------------------------------------------------------------
-- Product photos (public bucket; only store staff may write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "Store admin upload images" on storage.objects;
create policy "Store admin upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-images' and (select public.can_manage_store()));
drop policy if exists "Store admin update images" on storage.objects;
create policy "Store admin update images" on storage.objects for update to authenticated
  using (bucket_id = 'store-images' and (select public.can_manage_store()));
drop policy if exists "Store admin delete images" on storage.objects;
create policy "Store admin delete images" on storage.objects for delete to authenticated
  using (bucket_id = 'store-images' and (select public.can_manage_store()));

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Loca Store: product categories ("jenis produk") managed from the admin panel.
-- Run after store.sql (needs public.store_products and public.can_manage_store()).
--
--   • store_categories: id is a short slug (e.g. 'boardgame'), stored in store_products.category.
--   • The old hard-coded CHECK on store_products.category is replaced by a foreign key, so new
--     categories added by Admin Store / Admin Umum / Owner can be used right away.
--   • Active categories are readable without login (catalogue tabs); inactive ones only by store staff.
-- ---------------------------------------------------------------------------

create table if not exists public.store_categories (
  id text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (char_length(label) between 1 and 40),
  note text check (note is null or char_length(note) <= 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists store_categories_label_key on public.store_categories (lower(label));
alter table public.store_categories enable row level security;

-- Starter categories = the four that used to be hard-coded (only when empty, so deleted ones never come back).
insert into public.store_categories (id, label, note, sort_order)
select v.id, v.label, v.note, v.ord from (values
  ('boardgame', 'Boardgame', 'Untuk meja bareng teman', 1),
  ('pokemon_single', 'Pokémon Singles', 'Kartu satuan', 2),
  ('pokemon_sealed', 'Pokémon Sealed', 'Booster, box & deck', 3),
  ('accessories', 'Accessories', 'Sleeves, deck box, playmat', 4)
) as v(id, label, note, ord)
where not exists (select 1 from public.store_categories);

-- Any category already used by a product must exist before the foreign key is added.
insert into public.store_categories (id, label, sort_order)
select distinct p.category, p.category, 99 from public.store_products p
where not exists (select 1 from public.store_categories c where c.id = p.category)
on conflict do nothing;

alter table public.store_products drop constraint if exists store_products_category_check;
alter table public.store_products drop constraint if exists store_products_category_fkey;
alter table public.store_products add constraint store_products_category_fkey
  foreign key (category) references public.store_categories(id) on update cascade on delete restrict;

-- Read: split per role, because can_manage_store() is not executable by anon.
drop policy if exists "Public read active store categories" on public.store_categories;
create policy "Public read active store categories" on public.store_categories for select to anon
  using (is_active);
drop policy if exists "Members read store categories" on public.store_categories;
create policy "Members read store categories" on public.store_categories for select to authenticated
  using (is_active or (select public.can_manage_store()));
drop policy if exists "Store admin insert categories" on public.store_categories;
create policy "Store admin insert categories" on public.store_categories for insert to authenticated
  with check ((select public.can_manage_store()));
drop policy if exists "Store admin update categories" on public.store_categories;
create policy "Store admin update categories" on public.store_categories for update to authenticated
  using ((select public.can_manage_store())) with check ((select public.can_manage_store()));
drop policy if exists "Store admin delete categories" on public.store_categories;
create policy "Store admin delete categories" on public.store_categories for delete to authenticated
  using ((select public.can_manage_store()));

grant select on public.store_categories to anon, authenticated;
grant insert, update, delete on public.store_categories to authenticated;

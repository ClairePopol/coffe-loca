-- ---------------------------------------------------------------------------
-- Profile content managed from the admin panel (run after profiles.sql)
--   promos          "This Month's Promo"          → shown to every signed-in member
--   events          "What's Happening This Month" → shown to every signed-in member
--   vouchers        voucher / reward catalogue
--   member_vouchers who holds which voucher (granted to chosen members or random members)
-- Writes are limited to Coffee staff (can_manage_coffee: Admin Coffee, Admin Umum, Owner).
-- ---------------------------------------------------------------------------

create table if not exists public.promos (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  detail text check (char_length(detail) <= 300),
  badge text check (char_length(badge) <= 16),
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  detail text check (char_length(detail) <= 300),
  event_date date not null,
  time_text text check (char_length(time_text) <= 30),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  detail text check (char_length(detail) <= 300),
  expires_at date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_vouchers (
  id bigint generated always as identity primary key,
  voucher_id bigint not null references public.vouchers(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'used')),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  unique (voucher_id, member_id)
);

create index if not exists promos_created_by_idx on public.promos (created_by);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists vouchers_created_by_idx on public.vouchers (created_by);
create index if not exists member_vouchers_member_idx on public.member_vouchers (member_id);
create index if not exists member_vouchers_granted_by_idx on public.member_vouchers (granted_by);
create index if not exists member_vouchers_used_by_idx on public.member_vouchers (used_by);

alter table public.promos enable row level security;
alter table public.events enable row level security;
alter table public.vouchers enable row level security;
alter table public.member_vouchers enable row level security;

-- Promos & events: members read the active ones, Coffee staff read and manage everything.
drop policy if exists "Read promos" on public.promos;
create policy "Read promos" on public.promos for select to authenticated
  using (is_active or (select public.can_manage_coffee()));
drop policy if exists "Staff insert promos" on public.promos;
create policy "Staff insert promos" on public.promos for insert to authenticated
  with check ((select public.can_manage_coffee()));
drop policy if exists "Staff update promos" on public.promos;
create policy "Staff update promos" on public.promos for update to authenticated
  using ((select public.can_manage_coffee())) with check ((select public.can_manage_coffee()));
drop policy if exists "Staff delete promos" on public.promos;
create policy "Staff delete promos" on public.promos for delete to authenticated
  using ((select public.can_manage_coffee()));

drop policy if exists "Read events" on public.events;
create policy "Read events" on public.events for select to authenticated
  using (is_active or (select public.can_manage_coffee()));
drop policy if exists "Staff insert events" on public.events;
create policy "Staff insert events" on public.events for insert to authenticated
  with check ((select public.can_manage_coffee()));
drop policy if exists "Staff update events" on public.events;
create policy "Staff update events" on public.events for update to authenticated
  using ((select public.can_manage_coffee())) with check ((select public.can_manage_coffee()));
drop policy if exists "Staff delete events" on public.events;
create policy "Staff delete events" on public.events for delete to authenticated
  using ((select public.can_manage_coffee()));

-- Vouchers: staff see the whole catalogue, a member only sees vouchers they hold.
drop policy if exists "Read vouchers" on public.vouchers;
create policy "Read vouchers" on public.vouchers for select to authenticated
  using (
    (select public.can_manage_coffee())
    or exists (select 1 from public.member_vouchers mv where mv.voucher_id = vouchers.id and mv.member_id = (select auth.uid()))
  );
drop policy if exists "Staff insert vouchers" on public.vouchers;
create policy "Staff insert vouchers" on public.vouchers for insert to authenticated
  with check ((select public.can_manage_coffee()));
drop policy if exists "Staff update vouchers" on public.vouchers;
create policy "Staff update vouchers" on public.vouchers for update to authenticated
  using ((select public.can_manage_coffee())) with check ((select public.can_manage_coffee()));
drop policy if exists "Staff delete vouchers" on public.vouchers;
create policy "Staff delete vouchers" on public.vouchers for delete to authenticated
  using ((select public.can_manage_coffee()));

-- member_vouchers: read-only from the API (a member reads their own, staff read all).
-- Rows are only written by the functions below.
drop policy if exists "Read own vouchers" on public.member_vouchers;
create policy "Read own vouchers" on public.member_vouchers for select to authenticated
  using (member_id = (select auth.uid()) or (select public.can_manage_coffee()));

-- Give a voucher to specific members (multiple choice). Returns how many members newly received it.
create or replace function public.grant_voucher(p_voucher_id bigint, p_member_ids uuid[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  granted integer;
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa memberi voucher'; end if;
  if not exists (select 1 from public.vouchers where id = p_voucher_id and is_active) then
    raise exception 'Voucher tidak ditemukan atau sudah nonaktif';
  end if;
  if coalesce(array_length(p_member_ids, 1), 0) = 0 then raise exception 'Pilih minimal 1 member'; end if;
  if array_length(p_member_ids, 1) > 500 then raise exception 'Maksimal 500 member sekali beri'; end if;

  insert into public.member_vouchers (voucher_id, member_id, granted_by)
  select p_voucher_id, p.id, auth.uid() from public.profiles p where p.id = any (p_member_ids)
  on conflict (voucher_id, member_id) do nothing;
  get diagnostics granted = row_count;
  return granted;
end;
$$;

-- Give a voucher to N random members (role = member) who don't have it yet.
create or replace function public.grant_voucher_random(p_voucher_id bigint, p_count integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  granted integer;
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa memberi voucher'; end if;
  if not exists (select 1 from public.vouchers where id = p_voucher_id and is_active) then
    raise exception 'Voucher tidak ditemukan atau sudah nonaktif';
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then raise exception 'Jumlah acak harus 1 sampai 500'; end if;

  insert into public.member_vouchers (voucher_id, member_id, granted_by)
  select p_voucher_id, p.id, auth.uid()
  from public.profiles p
  where p.role = 'member'
    and not exists (select 1 from public.member_vouchers mv where mv.voucher_id = p_voucher_id and mv.member_id = p.id)
  order by random()
  limit p_count;
  get diagnostics granted = row_count;
  return granted;
end;
$$;

-- Staff marks a member's voucher as used (e.g. when redeemed at the cashier).
create or replace function public.use_member_voucher(p_member_voucher_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa menandai voucher terpakai'; end if;
  update public.member_vouchers
  set status = 'used', used_by = auth.uid(), used_at = now()
  where id = p_member_voucher_id and status = 'active';
  if not found then raise exception 'Voucher tidak ditemukan atau sudah terpakai'; end if;
end;
$$;

-- New functions are callable only by signed-in users (Supabase grants anon by default, so revoke it explicitly).
revoke all on function public.grant_voucher(bigint, uuid[]) from public, anon;
revoke all on function public.grant_voucher_random(bigint, integer) from public, anon;
revoke all on function public.use_member_voucher(bigint) from public, anon;
grant execute on function public.grant_voucher(bigint, uuid[]) to authenticated;
grant execute on function public.grant_voucher_random(bigint, integer) to authenticated;
grant execute on function public.use_member_voucher(bigint) to authenticated;

notify pgrst, 'reload schema';

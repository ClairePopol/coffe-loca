create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin_coffee', 'admin_store', 'admin', 'owner')),
  points integer not null default 0 check (points >= 0),
  stamps integer not null default 0 check (stamps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists stamps integer not null default 0;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Roles: member · admin_coffee (Coffee only) · admin_store (Store only) · admin (Admin Umum: both) · owner (both)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('member', 'admin_coffee', 'admin_store', 'admin', 'owner'));

alter table public.profiles enable row level security;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  -- Any staff role (used to let staff read member profiles).
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin_coffee', 'admin_store', 'admin', 'owner'));
$$;

revoke all on function public.is_admin_or_owner() from public;
grant execute on function public.is_admin_or_owner() to authenticated;

-- Coffee area (stamps, redeem, stamp history): Admin Coffee, Admin Umum, Owner.
create or replace function public.can_manage_coffee()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin_coffee', 'admin', 'owner'));
$$;

revoke all on function public.can_manage_coffee() from public;
grant execute on function public.can_manage_coffee() to authenticated;

-- Store area: Admin Store, Admin Umum, Owner.
create or replace function public.can_manage_store()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin_store', 'admin', 'owner'));
$$;

revoke all on function public.can_manage_store() from public;
grant execute on function public.can_manage_store() to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin_or_owner());

create or replace function public.award_points(target_user_id uuid, points_to_add integer)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare updated_profile public.profiles;
begin
  if not public.can_manage_coffee() then
    raise exception 'Only admin or owner can award points';
  end if;
  if points_to_add <= 0 then raise exception 'Points must be positive'; end if;
  update public.profiles set points = points + points_to_add, updated_at = now()
  where id = target_user_id returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Member profile not found'; end if;
  return updated_profile;
end;
$$;

revoke all on function public.award_points(uuid, integer) from public;
grant execute on function public.award_points(uuid, integer) to authenticated;

create or replace function public.award_stamp(target_user_id uuid)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare updated_profile public.profiles;
begin
  if not public.can_manage_coffee() then
    raise exception 'Only admin or owner can award stamps';
  end if;
  update public.profiles
  set stamps = least(stamps + 1, 10), updated_at = now()
  where id = target_user_id
  returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Member profile not found'; end if;
  return updated_profile;
end;
$$;

revoke all on function public.award_stamp(uuid) from public;
grant execute on function public.award_stamp(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Stamp history (who gave / redeemed stamps for whom, and when)
-- Rows are only written by the functions below; admins/owners can read them.
-- ---------------------------------------------------------------------------
create table if not exists public.stamp_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  action text not null check (action in ('add', 'redeem')),
  amount integer not null,
  stamps_before integer not null,
  stamps_after integer not null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  member_name text,
  admin_id uuid references public.profiles(id) on delete set null,
  admin_name text
);

create index if not exists stamp_logs_created_at_idx on public.stamp_logs (created_at desc);
create index if not exists stamp_logs_member_idx on public.stamp_logs (member_id, created_at desc);

alter table public.stamp_logs enable row level security;
revoke insert, update, delete on public.stamp_logs from anon, authenticated;

drop policy if exists "Admins can read stamp logs" on public.stamp_logs;
create policy "Admins can read stamp logs"
  on public.stamp_logs for select
  using (public.can_manage_coffee());

-- Add 1-10 stamps. The card holds at most 10; extra stamps are not added.
create or replace function public.award_stamps(target_user_id uuid, amount integer)
returns public.stamp_logs
language plpgsql
security definer set search_path = public
as $$
declare
  target_member public.profiles;
  staff public.profiles;
  added integer;
  log_row public.stamp_logs;
begin
  select * into staff from public.profiles where id = auth.uid() and role in ('admin_coffee', 'admin', 'owner');
  if staff.id is null then raise exception 'Hanya admin atau owner yang bisa menambah stamp'; end if;
  if amount is null or amount < 1 or amount > 10 then raise exception 'Jumlah stamp harus 1 sampai 10'; end if;

  select * into target_member from public.profiles where id = target_user_id for update;
  if target_member.id is null then raise exception 'Member tidak ditemukan'; end if;
  if target_member.stamps >= 10 then raise exception 'Kartu member sudah penuh (10/10). Tukarkan kopi gratis dulu.'; end if;

  added := least(amount, 10 - target_member.stamps);
  update public.profiles set stamps = stamps + added, updated_at = now() where id = target_member.id;

  insert into public.stamp_logs (action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name)
  values ('add', added, target_member.stamps, target_member.stamps + added, target_member.id, target_member.full_name, staff.id, staff.full_name)
  returning * into log_row;
  return log_row;
end;
$$;

revoke all on function public.award_stamps(uuid, integer) from public;
grant execute on function public.award_stamps(uuid, integer) to authenticated;

-- Redeem a full card (10 stamps) for one free coffee and reset it to 0.
create or replace function public.redeem_free_coffee(target_user_id uuid)
returns public.stamp_logs
language plpgsql
security definer set search_path = public
as $$
declare
  target_member public.profiles;
  staff public.profiles;
  log_row public.stamp_logs;
begin
  select * into staff from public.profiles where id = auth.uid() and role in ('admin_coffee', 'admin', 'owner');
  if staff.id is null then raise exception 'Hanya admin atau owner yang bisa menukar kopi gratis'; end if;

  select * into target_member from public.profiles where id = target_user_id for update;
  if target_member.id is null then raise exception 'Member tidak ditemukan'; end if;
  if target_member.stamps < 10 then raise exception 'Stamp belum 10 (baru %/10)', target_member.stamps; end if;

  update public.profiles set stamps = 0, updated_at = now() where id = target_member.id;

  insert into public.stamp_logs (action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name)
  values ('redeem', 10, target_member.stamps, 0, target_member.id, target_member.full_name, staff.id, staff.full_name)
  returning * into log_row;
  return log_row;
end;
$$;

revoke all on function public.redeem_free_coffee(uuid) from public;
grant execute on function public.redeem_free_coffee(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Change a member's role (from the admin panel)
--   Only the Owner can change roles (any role), but not their own.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(target_user_id uuid, new_role text)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  staff public.profiles;
  target_profile public.profiles;
  updated_profile public.profiles;
begin
  select * into staff from public.profiles where id = auth.uid() and role = 'owner';
  if staff.id is null then raise exception 'Hanya Owner yang bisa mengubah role'; end if;
  if new_role not in ('member', 'admin_coffee', 'admin_store', 'admin', 'owner') then raise exception 'Role tidak dikenal: %', new_role; end if;
  if target_user_id = staff.id then raise exception 'Kamu tidak bisa mengubah role akunmu sendiri'; end if;

  select * into target_profile from public.profiles where id = target_user_id for update;
  if target_profile.id is null then raise exception 'Member tidak ditemukan'; end if;

  update public.profiles set role = new_role, updated_at = now() where id = target_profile.id
  returning * into updated_profile;
  return updated_profile;
end;
$$;

revoke all on function public.set_member_role(uuid, text) from public;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- Refresh the API schema cache so new columns (e.g. stamps) are visible immediately.
notify pgrst, 'reload schema';

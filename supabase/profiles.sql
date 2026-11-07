create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

revoke all on function public.is_admin_or_owner() from public;
grant execute on function public.is_admin_or_owner() to authenticated;

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
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner')) then
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

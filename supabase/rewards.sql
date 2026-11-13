-- ---------------------------------------------------------------------------
-- Reward catalogue, uncapped stamps and role limits (run after profiles.sql, content.sql, promo-claim.sql, account-approval.sql)
--
--   • Stamps keep stacking past 10. 10 stamps = 1 full card = a free coffee; the owner decides other
--     rewards (e.g. 40 stamps = merchandise) in the admin panel → public.rewards.
--   • Redeeming a reward SUBTRACTS its price (the card no longer resets to 0).
--   • Admin Coffee can only: scan a member's stamp card and scan a voucher.
--     Verification list, member list, reward redeem, stamp history, promos/events/vouchers and
--     voucher claim history are for Admin Umum + Owner ("admin up").
-- ---------------------------------------------------------------------------

-- Admin Umum + Owner.
create or replace function public.is_admin_up()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

revoke all on function public.is_admin_up() from public, anon;
grant execute on function public.is_admin_up() to authenticated;

-- Only Admin Umum + Owner may list other members (Admin Coffee/Store keep reading their own row).
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin_up());

-- Stamp history: Admin Umum + Owner.
alter table public.stamp_logs add column if not exists reward_title text;
drop policy if exists "Admins can read stamp logs" on public.stamp_logs;
create policy "Admins can read stamp logs"
  on public.stamp_logs for select
  using (public.is_admin_up());

-- ---------------------------------------------------------------------------
-- Reward catalogue (the "etalase")
-- ---------------------------------------------------------------------------
create table if not exists public.rewards (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  detail text check (char_length(detail) <= 200),
  stamps_cost integer not null check (stamps_cost between 1 and 1000),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rewards_created_by_idx on public.rewards (created_by);
alter table public.rewards enable row level security;

drop policy if exists "Read rewards" on public.rewards;
create policy "Read rewards" on public.rewards for select to authenticated
  using (is_active or (select public.is_admin_up()));
drop policy if exists "Admin insert rewards" on public.rewards;
create policy "Admin insert rewards" on public.rewards for insert to authenticated
  with check ((select public.is_admin_up()));
drop policy if exists "Admin update rewards" on public.rewards;
create policy "Admin update rewards" on public.rewards for update to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "Admin delete rewards" on public.rewards;
create policy "Admin delete rewards" on public.rewards for delete to authenticated
  using ((select public.is_admin_up()));

-- The first reward is the existing one: a free coffee for a full card.
insert into public.rewards (title, detail, stamps_cost)
select 'Kopi Gratis', '1 kartu penuh (10 stamp) = 1 kopi gratis', 10
where not exists (select 1 from public.rewards);

-- ---------------------------------------------------------------------------
-- Stamps: no more 10-stamp cap
-- ---------------------------------------------------------------------------
create or replace function public.award_stamps(target_user_id uuid, amount integer)
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
  if staff.id is null then raise exception 'Hanya admin atau owner yang bisa menambah stamp'; end if;
  if amount is null or amount < 1 or amount > 10 then raise exception 'Jumlah stamp harus 1 sampai 10'; end if;

  select * into target_member from public.profiles where id = target_user_id for update;
  if target_member.id is null then raise exception 'Member tidak ditemukan'; end if;

  update public.profiles set stamps = stamps + amount, updated_at = now() where id = target_member.id;

  insert into public.stamp_logs (action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name)
  values ('add', amount, target_member.stamps, target_member.stamps + amount, target_member.id, target_member.full_name, staff.id, staff.full_name)
  returning * into log_row;
  return log_row;
end;
$$;

revoke all on function public.award_stamps(uuid, integer) from public, anon;
grant execute on function public.award_stamps(uuid, integer) to authenticated;

-- Redeem a reward from the catalogue. Subtracts its price; Admin Umum + Owner only.
create or replace function public.redeem_reward(target_user_id uuid, p_reward_id bigint)
returns public.stamp_logs
language plpgsql
security definer set search_path = public
as $$
declare
  target_member public.profiles;
  staff public.profiles;
  reward public.rewards;
  log_row public.stamp_logs;
begin
  select * into staff from public.profiles where id = auth.uid() and role in ('admin', 'owner');
  if staff.id is null then raise exception 'Hanya Admin Umum atau Owner yang bisa menukar hadiah'; end if;

  select * into reward from public.rewards where id = p_reward_id and is_active;
  if reward.id is null then raise exception 'Hadiah tidak ditemukan atau sudah nonaktif'; end if;

  select * into target_member from public.profiles where id = target_user_id for update;
  if target_member.id is null then raise exception 'Member tidak ditemukan'; end if;
  if target_member.stamps < reward.stamps_cost then
    raise exception 'Stamp belum cukup (% dari % stamp)', target_member.stamps, reward.stamps_cost;
  end if;

  update public.profiles set stamps = stamps - reward.stamps_cost, updated_at = now() where id = target_member.id;

  insert into public.stamp_logs (action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name, reward_title)
  values ('redeem', reward.stamps_cost, target_member.stamps, target_member.stamps - reward.stamps_cost, target_member.id, target_member.full_name, staff.id, staff.full_name, reward.title)
  returning * into log_row;
  return log_row;
end;
$$;

revoke all on function public.redeem_reward(uuid, bigint) from public, anon;
grant execute on function public.redeem_reward(uuid, bigint) to authenticated;

-- Replaced by redeem_reward (it reset the card to 0 and required exactly a full card).
drop function if exists public.redeem_free_coffee(uuid);

-- ---------------------------------------------------------------------------
-- What Admin Coffee needs for scanning, without being able to list members/vouchers
-- ---------------------------------------------------------------------------
create or replace function public.scan_member(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  m public.profiles;
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa scan member'; end if;
  select * into m from public.profiles where id = p_member_id;
  if m.id is null then raise exception 'Member tidak ditemukan'; end if;
  return jsonb_build_object('id', m.id, 'full_name', m.full_name, 'stamps', m.stamps, 'approved', (m.approved or m.role <> 'member'));
end;
$$;

create or replace function public.scan_voucher(p_member_voucher_id bigint)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  mv public.member_vouchers;
  v public.vouchers;
  who text;
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa scan voucher'; end if;
  select * into mv from public.member_vouchers where id = p_member_voucher_id;
  if mv.id is null then raise exception 'QR ini tidak cocok dengan voucher mana pun'; end if;
  select * into v from public.vouchers where id = mv.voucher_id;
  select full_name into who from public.profiles where id = mv.member_id;
  return jsonb_build_object(
    'id', mv.id, 'title', v.title, 'member_name', who, 'status', mv.status,
    'uses_left', mv.uses_left, 'uses_total', mv.uses_total,
    'expires_at', coalesce(mv.expires_at, v.expires_at), 'is_active', v.is_active
  );
end;
$$;

revoke all on function public.scan_member(uuid) from public, anon;
revoke all on function public.scan_voucher(bigint) from public, anon;
grant execute on function public.scan_member(uuid) to authenticated;
grant execute on function public.scan_voucher(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin Umum + Owner only: verification, promos / events / vouchers, voucher claim history
-- ---------------------------------------------------------------------------
create or replace function public.set_member_approval(target_user_id uuid, is_approved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin_up() then raise exception 'Hanya Admin Umum atau Owner yang bisa memverifikasi akun'; end if;
  update public.profiles set approved = is_approved, updated_at = now() where id = target_user_id;
  if not found then raise exception 'Member tidak ditemukan'; end if;
end;
$$;

revoke all on function public.set_member_approval(uuid, boolean) from public, anon;
grant execute on function public.set_member_approval(uuid, boolean) to authenticated;

drop policy if exists "Read promos" on public.promos;
create policy "Read promos" on public.promos for select to authenticated using (is_active or (select public.is_admin_up()));
drop policy if exists "Staff insert promos" on public.promos;
create policy "Staff insert promos" on public.promos for insert to authenticated with check ((select public.is_admin_up()));
drop policy if exists "Staff update promos" on public.promos;
create policy "Staff update promos" on public.promos for update to authenticated using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "Staff delete promos" on public.promos;
create policy "Staff delete promos" on public.promos for delete to authenticated using ((select public.is_admin_up()));

drop policy if exists "Read events" on public.events;
create policy "Read events" on public.events for select to authenticated using (is_active or (select public.is_admin_up()));
drop policy if exists "Staff insert events" on public.events;
create policy "Staff insert events" on public.events for insert to authenticated with check ((select public.is_admin_up()));
drop policy if exists "Staff update events" on public.events;
create policy "Staff update events" on public.events for update to authenticated using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "Staff delete events" on public.events;
create policy "Staff delete events" on public.events for delete to authenticated using ((select public.is_admin_up()));

drop policy if exists "Read vouchers" on public.vouchers;
create policy "Read vouchers" on public.vouchers for select to authenticated
  using (
    (select public.is_admin_up())
    or exists (select 1 from public.member_vouchers mv where mv.voucher_id = vouchers.id and mv.member_id = (select auth.uid()))
  );
drop policy if exists "Staff insert vouchers" on public.vouchers;
create policy "Staff insert vouchers" on public.vouchers for insert to authenticated with check ((select public.is_admin_up()));
drop policy if exists "Staff update vouchers" on public.vouchers;
create policy "Staff update vouchers" on public.vouchers for update to authenticated using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "Staff delete vouchers" on public.vouchers;
create policy "Staff delete vouchers" on public.vouchers for delete to authenticated using ((select public.is_admin_up()));

drop policy if exists "Read own vouchers" on public.member_vouchers;
create policy "Read own vouchers" on public.member_vouchers for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin_up()));

create or replace function public.grant_voucher(p_voucher_id bigint, p_member_ids uuid[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  granted integer;
begin
  if not public.is_admin_up() then raise exception 'Hanya Admin Umum atau Owner yang bisa memberi voucher'; end if;
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

create or replace function public.grant_voucher_random(p_voucher_id bigint, p_count integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  granted integer;
begin
  if not public.is_admin_up() then raise exception 'Hanya Admin Umum atau Owner yang bisa memberi voucher'; end if;
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

revoke all on function public.grant_voucher(bigint, uuid[]) from public, anon;
revoke all on function public.grant_voucher_random(bigint, integer) from public, anon;
grant execute on function public.grant_voucher(bigint, uuid[]) to authenticated;
grant execute on function public.grant_voucher_random(bigint, integer) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Member self-service: the "Redeem Stamps" button on the home page.
-- A verified member spends their OWN stamps on a reward they can afford (logged without an admin).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_my_reward(p_reward_id bigint)
returns public.stamp_logs
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m public.profiles;
  reward public.rewards;
  log_row public.stamp_logs;
begin
  if uid is null then raise exception 'Silakan login dulu'; end if;

  select * into m from public.profiles where id = uid for update;
  if m.id is null then raise exception 'Profil tidak ditemukan'; end if;
  if not (m.approved or m.role <> 'member') then raise exception 'Akunmu belum diverifikasi owner'; end if;

  select * into reward from public.rewards where id = p_reward_id and is_active;
  if reward.id is null then raise exception 'Hadiah tidak ditemukan atau sudah tidak tersedia'; end if;
  if m.stamps < reward.stamps_cost then
    raise exception 'Stamp belum cukup (% dari % stamp)', m.stamps, reward.stamps_cost;
  end if;

  update public.profiles set stamps = stamps - reward.stamps_cost, updated_at = now() where id = m.id;

  insert into public.stamp_logs (action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name, reward_title)
  values ('redeem', reward.stamps_cost, m.stamps, m.stamps - reward.stamps_cost, m.id, m.full_name, null, null, reward.title)
  returning * into log_row;
  return log_row;
end;
$$;

revoke all on function public.redeem_my_reward(bigint) from public, anon;
grant execute on function public.redeem_my_reward(bigint) to authenticated;

notify pgrst, 'reload schema';

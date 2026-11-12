-- ---------------------------------------------------------------------------
-- Claimable promos (run after content.sql)
--   A member taps KLAIM on "This Month's Promo" → it becomes a voucher in "Rewards & Voucher"
--   that can be used `claim_uses` times (default 4x) and expires at the end of the current month (WIB).
--   One claim per promo per member. Staff mark each use (use_member_voucher).
-- ---------------------------------------------------------------------------

alter table public.promos add column if not exists claim_uses integer not null default 4 check (claim_uses between 1 and 50);

-- A claimed promo is backed by one voucher row per promo (created on first claim).
alter table public.vouchers add column if not exists promo_id bigint references public.promos(id) on delete set null;
create unique index if not exists vouchers_promo_id_key on public.vouchers (promo_id) where promo_id is not null;

-- Per-grant usage + expiry (manual vouchers keep 1 use and fall back to vouchers.expires_at).
alter table public.member_vouchers
  add column if not exists uses_total integer not null default 1 check (uses_total >= 1),
  add column if not exists uses_left integer not null default 1 check (uses_left >= 0),
  add column if not exists expires_at date;
alter table public.member_vouchers add constraint member_vouchers_uses_check check (uses_left <= uses_total);
update public.member_vouchers set uses_left = 0 where status = 'used';

create or replace function public.claim_promo(p_promo_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  promo public.promos;
  v_id bigint;
  today date := (now() at time zone 'Asia/Jakarta')::date;
  month_end date := (date_trunc('month', today::timestamp) + interval '1 month - 1 day')::date;
  inserted integer;
begin
  if uid is null then raise exception 'Silakan login dulu'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'Profil tidak ditemukan'; end if;

  select * into promo from public.promos where id = p_promo_id and is_active and (valid_until is null or valid_until >= today);
  if promo.id is null then raise exception 'Promo ini sudah tidak tersedia'; end if;

  insert into public.vouchers (title, detail, promo_id) values (promo.title, promo.detail, promo.id)
  on conflict (promo_id) where promo_id is not null do nothing;
  select v.id into v_id from public.vouchers v where v.promo_id = promo.id;

  insert into public.member_vouchers (voucher_id, member_id, granted_by, uses_total, uses_left, expires_at)
  values (v_id, uid, uid, promo.claim_uses, promo.claim_uses, month_end)
  on conflict (voucher_id, member_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then raise exception 'Promo ini sudah kamu klaim'; end if;
end;
$$;

-- Staff marks ONE use of a member's voucher; the voucher becomes 'used' when no uses are left.
create or replace function public.use_member_voucher(p_member_voucher_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  mv public.member_vouchers;
  expiry date;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa menandai voucher terpakai'; end if;

  select * into mv from public.member_vouchers where id = p_member_voucher_id for update;
  if mv.id is null or mv.status <> 'active' or mv.uses_left < 1 then raise exception 'Voucher tidak ditemukan atau sudah terpakai'; end if;

  select coalesce(mv.expires_at, v.expires_at) into expiry from public.vouchers v where v.id = mv.voucher_id;
  if expiry is not null and expiry < today then raise exception 'Voucher sudah kedaluwarsa'; end if;

  update public.member_vouchers
  set uses_left = uses_left - 1,
      status = case when uses_left - 1 = 0 then 'used' else status end,
      used_by = auth.uid(),
      used_at = now()
  where id = mv.id;
end;
$$;

revoke all on function public.claim_promo(bigint) from public, anon;
grant execute on function public.claim_promo(bigint) to authenticated;

notify pgrst, 'reload schema';

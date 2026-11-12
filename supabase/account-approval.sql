-- ---------------------------------------------------------------------------
-- Account approval: new sign-ups wait until the owner / admin verifies them.
--   The member chats the owner on WhatsApp (see /profile); staff taps VERIFIKASI in the admin panel.
--   Existing accounts are approved automatically. Members cannot approve themselves
--   (profiles has no INSERT/UPDATE policy; only the RPC below writes the flag).
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists approved boolean not null default false;
update public.profiles set approved = true where approved = false and created_at < now();  -- grandfather existing accounts

create or replace function public.set_member_approval(target_user_id uuid, is_approved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_manage_coffee() then raise exception 'Hanya admin yang bisa memverifikasi akun'; end if;
  update public.profiles set approved = is_approved, updated_at = now() where id = target_user_id;
  if not found then raise exception 'Member tidak ditemukan'; end if;
end;
$$;

revoke all on function public.set_member_approval(uuid, boolean) from public, anon;
grant execute on function public.set_member_approval(uuid, boolean) to authenticated;

-- Unverified accounts cannot claim promos.
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
  if not exists (select 1 from public.profiles where id = uid and (approved or role <> 'member')) then raise exception 'Akunmu belum diverifikasi owner'; end if;

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

revoke all on function public.claim_promo(bigint) from public, anon;
grant execute on function public.claim_promo(bigint) to authenticated;

notify pgrst, 'reload schema';

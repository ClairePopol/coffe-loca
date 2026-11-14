-- ---------------------------------------------------------------------------
-- Verification queue for every admin role + delete buttons (run after account-approval.sql, rewards.sql)
--
--   • Every staff role (Admin Coffee / Store / Umum / Owner) can verify new sign-ups from a small queue
--     (name + phone only). Once verified the row disappears. Staff below Admin Umum cannot browse members.
--   • Staff below Admin Umum may only approve (never revoke).
--   • Delete a verification request (still pending): any staff.
--   • Delete a member: Admin Umum + Owner only; never yourself; only the Owner may delete staff accounts.
--     Deleting removes the auth user, so profile, stamps and vouchers cascade away.
-- ---------------------------------------------------------------------------

create or replace function public.list_pending_members()
returns table (id uuid, full_name text, phone text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin_or_owner() then raise exception 'Hanya staff yang bisa melihat antrean verifikasi'; end if;
  return query
    select p.id, p.full_name, p.phone, p.created_at
    from public.profiles p
    where p.role = 'member' and not p.approved
    order by p.created_at;
end;
$$;
revoke all on function public.list_pending_members() from public, anon;
grant execute on function public.list_pending_members() to authenticated;

create or replace function public.set_member_approval(target_user_id uuid, is_approved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin_or_owner() then raise exception 'Hanya staff yang bisa memverifikasi akun'; end if;
  if not is_approved and not public.is_admin_up() then raise exception 'Hanya Admin Umum / Owner yang bisa mencabut verifikasi'; end if;
  update public.profiles set approved = is_approved, updated_at = now() where id = target_user_id;
  if not found then raise exception 'Member tidak ditemukan'; end if;
end;
$$;
revoke all on function public.set_member_approval(uuid, boolean) from public, anon;
grant execute on function public.set_member_approval(uuid, boolean) to authenticated;

-- Reject / remove a sign-up that has not been verified yet.
create or replace function public.delete_pending_member(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin_or_owner() then raise exception 'Hanya staff yang bisa menghapus permintaan verifikasi'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id and role = 'member' and not approved) then
    raise exception 'Permintaan verifikasi tidak ditemukan atau sudah diverifikasi';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;
revoke all on function public.delete_pending_member(uuid) from public, anon;
grant execute on function public.delete_pending_member(uuid) to authenticated;

-- Delete a member account for good.
create or replace function public.delete_member(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare target_role text;
begin
  if not public.is_admin_up() then raise exception 'Hanya Admin Umum / Owner yang bisa menghapus member'; end if;
  if target_user_id = auth.uid() then raise exception 'Kamu tidak bisa menghapus akunmu sendiri'; end if;
  select role into target_role from public.profiles where id = target_user_id;
  if target_role is null then raise exception 'Member tidak ditemukan'; end if;
  if target_role <> 'member' and not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'Hanya Owner yang bisa menghapus akun staff';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

notify pgrst, 'reload schema';

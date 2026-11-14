-- Optional birth date collected at sign-up (used for birthday vouchers). Run after profiles.sql.
alter table public.profiles add column if not exists birth_date date;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare bd date;
begin
  begin
    bd := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  exception when others then
    bd := null;
  end;
  if bd is not null and (bd > current_date or bd < date '1900-01-01') then bd := null; end if;
  insert into public.profiles (id, full_name, phone, birth_date)
  values (new.id, new.raw_user_meta_data ->> 'full_name', nullif(new.raw_user_meta_data ->> 'phone', ''), bd)
  on conflict (id) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';

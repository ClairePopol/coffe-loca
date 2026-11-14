-- Photos for the reward showcase (etalase). Run after rewards.sql.
alter table public.rewards add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reward-images', 'reward-images', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

-- Public bucket: anyone can view by URL; only Admin Umum + Owner may upload / replace / delete.
drop policy if exists "Admin upload reward images" on storage.objects;
create policy "Admin upload reward images" on storage.objects for insert to authenticated
  with check (bucket_id = 'reward-images' and (select public.is_admin_up()));
drop policy if exists "Admin update reward images" on storage.objects;
create policy "Admin update reward images" on storage.objects for update to authenticated
  using (bucket_id = 'reward-images' and (select public.is_admin_up()));
drop policy if exists "Admin delete reward images" on storage.objects;
create policy "Admin delete reward images" on storage.objects for delete to authenticated
  using (bucket_id = 'reward-images' and (select public.is_admin_up()));

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Events are managed from Admin → Store → "Acara" (moved from the Coffee panel).
-- Run after events-page.sql and store.sql. Admin Store / Admin Umum / Owner can manage
-- events and event categories (can_manage_store() = admin_store, admin, owner).
-- Anon read policies are unchanged.
-- ---------------------------------------------------------------------------

drop policy if exists "Read events" on public.events;
create policy "Read events" on public.events for select to authenticated
  using (is_active or (select public.can_manage_store()));
drop policy if exists "Staff insert events" on public.events;
create policy "Staff insert events" on public.events for insert to authenticated
  with check ((select public.can_manage_store()));
drop policy if exists "Staff update events" on public.events;
create policy "Staff update events" on public.events for update to authenticated
  using ((select public.can_manage_store())) with check ((select public.can_manage_store()));
drop policy if exists "Staff delete events" on public.events;
create policy "Staff delete events" on public.events for delete to authenticated
  using ((select public.can_manage_store()));

drop policy if exists "Members read event categories" on public.event_categories;
create policy "Members read event categories" on public.event_categories for select to authenticated
  using (is_active or (select public.can_manage_store()));
drop policy if exists "Admin insert event categories" on public.event_categories;
create policy "Admin insert event categories" on public.event_categories for insert to authenticated
  with check ((select public.can_manage_store()));
drop policy if exists "Admin update event categories" on public.event_categories;
create policy "Admin update event categories" on public.event_categories for update to authenticated
  using ((select public.can_manage_store())) with check ((select public.can_manage_store()));
drop policy if exists "Admin delete event categories" on public.event_categories;
create policy "Admin delete event categories" on public.event_categories for delete to authenticated
  using ((select public.can_manage_store()));

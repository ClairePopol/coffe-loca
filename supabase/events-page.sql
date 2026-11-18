-- ---------------------------------------------------------------------------
-- Public Events page (/events): categories + extra event fields
-- Run after content.sql and rewards.sql (needs public.events and public.is_admin_up()).
--
--   • event_categories: Riftbound, Pokémon, ... managed by Admin Umum + Owner in the admin panel.
--   • events gets category_id, fee (IDR), registration_url.
--   • Active events + active categories become readable WITHOUT login (anon). Inactive ones stay
--     visible to Admin Umum + Owner only (they are signed in, so they use the authenticated policy). Writes are unchanged (Admin Umum + Owner).
-- ---------------------------------------------------------------------------

create table if not exists public.event_categories (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists event_categories_name_key on public.event_categories (lower(name));
alter table public.event_categories enable row level security;

-- Two policies, one per role: is_admin_up() is NOT executable by anon (rewards.sql revokes it), and a policy
-- shared with anon would still evaluate it -> "permission denied for function is_admin_up".
drop policy if exists "Read event categories" on public.event_categories;
drop policy if exists "Public read active event categories" on public.event_categories;
create policy "Public read active event categories" on public.event_categories for select to anon
  using (is_active);
drop policy if exists "Members read event categories" on public.event_categories;
create policy "Members read event categories" on public.event_categories for select to authenticated
  using (is_active or (select public.is_admin_up()));
drop policy if exists "Admin insert event categories" on public.event_categories;
create policy "Admin insert event categories" on public.event_categories for insert to authenticated
  with check ((select public.is_admin_up()));
drop policy if exists "Admin update event categories" on public.event_categories;
create policy "Admin update event categories" on public.event_categories for update to authenticated
  using ((select public.is_admin_up())) with check ((select public.is_admin_up()));
drop policy if exists "Admin delete event categories" on public.event_categories;
create policy "Admin delete event categories" on public.event_categories for delete to authenticated
  using ((select public.is_admin_up()));

-- Starter categories (only when the table is empty, so renamed / deleted ones never come back).
insert into public.event_categories (name, sort_order)
select v.name, v.ord from (values ('Riftbound', 1), ('Pokémon', 2), ('Digimon', 3), ('One Piece', 4), ('Lorcana', 5), ('Boardgame', 6), ('Coffee & Umum', 7)) as v(name, ord)
where not exists (select 1 from public.event_categories);

alter table public.events add column if not exists category_id bigint references public.event_categories(id) on delete set null;
alter table public.events add column if not exists fee integer check (fee is null or fee >= 0);
alter table public.events add column if not exists registration_url text;
alter table public.events drop constraint if exists events_registration_url_check;
-- http(s) only: the value is rendered as a link, so javascript: / data: URLs must never get in.
alter table public.events add constraint events_registration_url_check
  check (registration_url is null or (char_length(registration_url) <= 300 and registration_url ~* '^https?://'));
create index if not exists events_category_idx on public.events (category_id);
create index if not exists events_date_idx on public.events (event_date);

-- Public read (was members only). Split per role for the same reason as above.
drop policy if exists "Read events" on public.events;
create policy "Read events" on public.events for select to authenticated
  using (is_active or (select public.is_admin_up()));
drop policy if exists "Public read active events" on public.events;
create policy "Public read active events" on public.events for select to anon
  using (is_active);

-- Anonymous visitors only need the display columns (not created_by, which points at a staff account).
revoke select on public.events from anon;
grant select (id, title, detail, event_date, time_text, is_active, category_id, fee, registration_url, created_at) on public.events to anon;
grant select on public.event_categories to anon;

notify pgrst, 'reload schema';

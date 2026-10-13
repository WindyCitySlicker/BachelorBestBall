-- Irish Course Invitational live scoring backend (Supabase)
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- Tournament scores/names are intentionally readable/writable by anonymous visitors
-- to the public site. Do not store private/personal data in this table.
create table if not exists public.tournament_state (
  id text primary key check (id = 'irish-course-invitational'),
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.tournament_state enable row level security;
drop policy if exists "Public can read tournament state" on public.tournament_state;
create policy "Public can read tournament state"
  on public.tournament_state for select to anon, authenticated using (true);
drop policy if exists "Public can insert tournament state" on public.tournament_state;
create policy "Public can insert tournament state"
  on public.tournament_state for insert to anon, authenticated with check (id = 'irish-course-invitational');
drop policy if exists "Public can update tournament state" on public.tournament_state;
create policy "Public can update tournament state"
  on public.tournament_state for update to anon, authenticated
  using (id = 'irish-course-invitational') with check (id = 'irish-course-invitational');
alter table public.tournament_state replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'tournament_state'
  ) then
    alter publication supabase_realtime add table public.tournament_state;
  end if;
end $$;

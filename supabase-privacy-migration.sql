-- Irish Course Invitational privacy migration
-- Run only after deploying the tournament-api Edge Function and configuring its secrets.
-- Take a database backup first. This preserves the existing tournament_state row and scores.
create table if not exists public.tournament_sessions (
  token_hash text primary key,
  role text not null check (role in ('admin', 'group')),
  group_id integer null check (group_id between 1 and 3),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint group_session_has_group check (
    (role = 'admin' and group_id is null) or
    (role = 'group' and group_id is not null)
  )
);

alter table public.tournament_sessions enable row level security;
revoke all on public.tournament_sessions from anon, authenticated;
grant all on public.tournament_sessions to service_role;

-- Remove the old permissive policies on the tournament record.
drop policy if exists "Public can read tournament state" on public.tournament_state;
drop policy if exists "Public can insert tournament state" on public.tournament_state;
drop policy if exists "Public can update tournament state" on public.tournament_state;
drop policy if exists "Tournament state is publicly readable" on public.tournament_state;
drop policy if exists "Tournament state is publicly writable" on public.tournament_state;

alter table public.tournament_state enable row level security;
revoke all on public.tournament_state from anon, authenticated;
grant all on public.tournament_state to service_role;

-- Do not grant anon/authenticated access to tournament_sessions or tournament_state.
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY server-side and validates each session.

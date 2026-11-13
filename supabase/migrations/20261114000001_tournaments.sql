-- Cloud-synced Tournaments and King of the Court.
-- Persists active and finished tournament state (brackets, streaks, standings, and matches)
-- in Postgres so every player in the league can view live brackets on their own device.
-- Safe to repeat.

create table if not exists public.tournaments (
  id          text primary key,
  name        text not null,
  format      text not null check (format in ('king_of_court', 'single_elimination', 'round_robin')),
  status      text not null default 'active' check (status in ('active', 'finished')),
  state       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tournaments_status_idx on public.tournaments (status, updated_at desc);

alter table public.tournaments enable row level security;
grant select, insert, update, delete on public.tournaments to service_role;

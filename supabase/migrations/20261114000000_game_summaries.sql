-- Materialized game summaries for instant O(1) box score and stats loading.
-- When a game finishes, its final score, winner, roster, events, and player box score lines
-- are stored here. listGames() reads from this table instead of replaying thousands of events.
-- Safe to repeat.

create table if not exists public.game_summaries (
  game_id      bigint primary key references public.games (id) on delete cascade,
  score_a      int not null default 0,
  score_b      int not null default 0,
  winner       text check (winner in ('A', 'B')),
  lines        jsonb not null default '[]'::jsonb,
  roster       jsonb not null default '[]'::jsonb,
  events       jsonb not null default '[]'::jsonb,
  computed_at  timestamptz not null default now()
);

alter table public.game_summaries enable row level security;
grant select, insert, update, delete on public.game_summaries to service_role;

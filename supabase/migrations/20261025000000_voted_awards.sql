-- Stores community / peer-voted awards (e.g. Most Spectacular Player).
-- Enables recording vote winners per period (e.g. '2026', '2026-Q4', '2026-10')
-- decided between players by highlight mixtapes or interaction.

create table if not exists public.voted_awards (
  id bigint generated always as identity primary key,
  period_key text not null,
  award_id text not null,
  player_id bigint not null references public.players (id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (period_key, award_id)
);

create index if not exists voted_awards_period_idx on public.voted_awards (period_key);
create index if not exists voted_awards_player_idx on public.voted_awards (player_id);

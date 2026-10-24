-- Adds injured status to players.
-- An injured player's stats remain frozen (not diluted with zeros).
-- When their absence drops them below the 70% game qualification threshold,
-- they become inactive on the official leaderboard until they return.
alter table public.players
  add column if not exists injured boolean not null default false;

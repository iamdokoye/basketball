-- Stores shot location zones for half-court pickup basketball heatmaps.
-- Zones:
--   'paint'       -> Rim & Key (0-8 ft)
--   'mid_left'    -> Mid-range Left & Baseline
--   'mid_right'   -> Mid-range Right & Baseline
--   'three_left'  -> 3PT Left Wing & Corner
--   'three_right' -> 3PT Right Wing & Corner
--   'three_top'   -> 3PT Top of the Arc

create table if not exists public.shot_zones (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games (id) on delete cascade,
  player_id bigint not null references public.players (id) on delete cascade,
  zone text not null check (zone in ('paint', 'mid_left', 'mid_right', 'three_left', 'three_right', 'three_top')),
  made boolean not null,
  pts int not null check (pts in (2, 3)),
  created_at timestamptz not null default now()
);

create index if not exists shot_zones_player_idx on public.shot_zones (player_id);
create index if not exists shot_zones_game_idx on public.shot_zones (game_id);

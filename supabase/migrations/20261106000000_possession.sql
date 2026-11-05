-- New play type POSS: the scorekeeper says which team has the ball, with a fresh 24s shot clock.
-- Like a timeout it belongs to a team, not a player, so it uses events.team and no player_id.
-- Everything else about possession and the shot clock is worked out from the existing plays.
-- Run once in the Supabase SQL Editor. Until it is run, tapping "Ball: Team A/B" fails to save and
-- nothing else changes. Safe to repeat.

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'MAKE2', 'MISS2', 'MAKE3', 'MISS3', 'MAKE_FT', 'MISS_FT',
  'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'FOUL', 'DEFL', 'OOB',
  'SUB_IN', 'SUB_OUT',
  'PAUSE', 'RESUME', 'TIMEOUT', 'POSS'
));

-- Clock plays may omit the player; a possession must name its team.
alter table public.events drop constraint if exists events_player_required;
alter table public.events add constraint events_player_required
  check (player_id is not null or type in ('PAUSE', 'RESUME', 'TIMEOUT', 'POSS'));
alter table public.events drop constraint if exists events_poss_team;
alter table public.events add constraint events_poss_team
  check (type <> 'POSS' or team is not null);

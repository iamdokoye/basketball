-- Game clock and timeouts.
--  * New play types: PAUSE, RESUME (the game clock) and TIMEOUT.
--  * These plays don't belong to a player, so events.player_id becomes optional, and a new
--    events.team records which team a timeout was called for.
--  * record_group() learns about both.
-- Run this once in the Supabase SQL Editor. Existing games are unaffected.

alter table public.events alter column player_id drop not null;
alter table public.events add column if not exists team text check (team in ('A', 'B'));

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'MAKE2', 'MISS2', 'MAKE3', 'MISS3', 'MAKE_FT', 'MISS_FT',
  'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'FOUL', 'DEFL',
  'SUB_IN', 'SUB_OUT',
  'PAUSE', 'RESUME', 'TIMEOUT'
));

-- Only clock plays may omit the player, and a timeout must say who called it (a player or a team).
alter table public.events drop constraint if exists events_player_required;
alter table public.events add constraint events_player_required
  check (player_id is not null or type in ('PAUSE', 'RESUME', 'TIMEOUT'));
alter table public.events drop constraint if exists events_timeout_who;
alter table public.events add constraint events_timeout_who
  check (type <> 'TIMEOUT' or player_id is not null or team is not null);

-- One round trip, safe to repeat (a re-sent group is ignored).
-- p_events: [{ "player_id": 1 | null, "type": "MAKE2", "team": "A" | null }, ...]
-- Returns: 'ok' | 'not_found' | 'not_live' | 'bad_request' | 'bad_player'
create or replace function public.record_group(
  p_game_id bigint,
  p_grp     uuid,
  p_at      timestamptz,
  p_events  jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_bad    int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_grp::text, 0));

  select status into v_status from public.games where id = p_game_id;
  if v_status is null then return 'not_found'; end if;
  if v_status <> 'live' then return 'not_live'; end if;

  if jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) = 0
     or jsonb_array_length(p_events) > 8 then
    return 'bad_request';
  end if;

  if exists (select 1 from public.events where game_id = p_game_id and grp = p_grp) then
    return 'ok';
  end if;

  -- Any player named must be on this game's roster (clock plays name none).
  select count(*) into v_bad
  from jsonb_array_elements(p_events) as e
  where (e->>'player_id') is not null
    and not exists (
      select 1 from public.game_players gp
      where gp.game_id = p_game_id and gp.player_id = (e->>'player_id')::bigint
    );
  if v_bad > 0 then return 'bad_player'; end if;

  -- The table's CHECK constraints reject an unknown type, a missing player on a normal play,
  -- or a timeout with no caller, and nothing is inserted.
  insert into public.events (game_id, player_id, type, grp, at, team)
  select p_game_id, (e->>'player_id')::bigint, e->>'type', p_grp, p_at, nullif(e->>'team', '')
  from jsonb_array_elements(p_events) as e;

  return 'ok';
end;
$$;

revoke all on function public.record_group(bigint, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_group(bigint, uuid, timestamptz, jsonb) to service_role;

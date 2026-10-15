-- Records one scorekeeper action (a group of linked events) in a single database round trip.
-- Safe to call twice with the same group id: the second call does nothing. That lets a phone
-- that lost signal re-send its queued plays without double counting.
--
-- Returns: 'ok' | 'not_found' | 'not_live' | 'bad_request' | 'bad_player'
create or replace function public.record_group(
  p_game_id bigint,
  p_grp     uuid,
  p_at      timestamptz,
  p_events  jsonb  -- [{ "player_id": 1, "type": "MAKE2" }, ...]
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_bad    int;
begin
  -- Serialise concurrent attempts to record the same group.
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

  select count(*) into v_bad
  from jsonb_array_elements(p_events) as e
  where not exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.player_id = (e->>'player_id')::bigint
  );
  if v_bad > 0 then return 'bad_player'; end if;

  -- events.type has a CHECK constraint, so an unknown type raises and nothing is inserted.
  insert into public.events (game_id, player_id, type, grp, at)
  select p_game_id, (e->>'player_id')::bigint, e->>'type', p_grp, p_at
  from jsonb_array_elements(p_events) as e;

  return 'ok';
end;
$$;

revoke all on function public.record_group(bigint, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_group(bigint, uuid, timestamptz, jsonb) to service_role;

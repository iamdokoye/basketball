-- Timed basketball games (quarters, countdowns, buzzer beaters).
-- Adds game_type ('target' | 'timed'), quarter_minutes (e.g. 10 for FIBA, 12 for NBA, 15, etc.),
-- and quarter_count (default 4 quarters). Existing games default to 'target' (20 pts).

alter table public.games
  add column if not exists game_type text not null default 'target' check (game_type in ('target', 'timed')),
  add column if not exists quarter_minutes int not null default 10 check (quarter_minutes > 0),
  add column if not exists quarter_count int not null default 4 check (quarter_count > 0);

-- Updated create_game that accepts game_type, quarter_minutes, and quarter_count with safe defaults.
create or replace function public.create_game(
  p_target int,
  p_win_by int,
  p_players jsonb,
  p_game_type text default 'target',
  p_quarter_minutes int default 10,
  p_quarter_count int default 4
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  gid bigint;
begin
  insert into public.games (target, win_by, game_type, quarter_minutes, quarter_count)
  values (
    p_target,
    p_win_by,
    coalesce(p_game_type, 'target'),
    coalesce(p_quarter_minutes, 10),
    coalesce(p_quarter_count, 4)
  )
  returning id into gid;

  insert into public.game_players (game_id, player_id, team, starter)
  select gid, (p->>'id')::bigint, p->>'team', coalesce((p->>'starter')::boolean, true)
  from jsonb_array_elements(p_players) as p;

  return gid;
end;
$$;

revoke all on function public.create_game(int, int, jsonb, text, int, int) from public, anon, authenticated;
grant execute on function public.create_game(int, int, jsonb, text, int, int) to service_role;

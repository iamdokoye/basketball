-- Pickup League schema.
-- The app talks to Supabase only from the server (service role), so RLS is
-- enabled with no policies: the public anon key can read/write nothing.

create table public.players (
  id          bigint generated always as identity primary key,
  name        text not null check (length(btrim(name)) between 1 and 40),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index players_name_ci on public.players (lower(name));

create table public.games (
  id         bigint generated always as identity primary key,
  played_at  timestamptz not null default now(),
  status     text not null default 'live' check (status in ('live', 'final')),
  target     int  not null default 20 check (target > 0),
  win_by     int  not null default 1 check (win_by > 0)
);

create table public.game_players (
  game_id    bigint not null references public.games (id) on delete cascade,
  player_id  bigint not null references public.players (id),
  team       text   not null check (team in ('A', 'B')),
  starter    boolean not null default true, -- on court at tip-off; false = bench
  primary key (game_id, player_id)
);

-- Every scorekeeper tap is an event. Box scores, ratings, plus/minus and
-- minutes are all derived from this log. Events from one action (e.g. make +
-- assist, or sub out + sub in) share a grp so they can be undone together.
create table public.events (
  id         bigint generated always as identity primary key,
  game_id    bigint not null references public.games (id) on delete cascade,
  player_id  bigint not null references public.players (id),
  type       text   not null check (type in (
    'MAKE2', 'MISS2', 'MAKE3', 'MISS3', 'MAKE_FT', 'MISS_FT',
    'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'FOUL', 'DEFL',
    'SUB_IN', 'SUB_OUT'
  )),
  grp        uuid   not null,
  at         timestamptz not null default now()
);
create index events_game_id_idx on public.events (game_id, id);
create index events_grp_idx on public.events (game_id, grp);

-- Creates a game and its roster atomically.
-- p_players: [{ "id": 1, "team": "A", "starter": true }, ...]
create function public.create_game(p_target int, p_win_by int, p_players jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  gid bigint;
begin
  insert into public.games (target, win_by) values (p_target, p_win_by)
  returning id into gid;

  insert into public.game_players (game_id, player_id, team, starter)
  select gid, (p->>'id')::bigint, p->>'team', coalesce((p->>'starter')::boolean, true)
  from jsonb_array_elements(p_players) as p;

  return gid;
end;
$$;

alter table public.players      enable row level security;
alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.events       enable row level security;

grant select, insert, update, delete on
  public.players, public.games, public.game_players, public.events
  to service_role;

revoke all on function public.create_game(int, int, jsonb) from public, anon, authenticated;
grant execute on function public.create_game(int, int, jsonb) to service_role;

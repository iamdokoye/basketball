-- One-off import: pickup game played Saturday 10 Oct 2026, Team Lime 18 - 21 Team Blue.
--
-- Source: three screenshots of per-player totals from another tracker (no play-by-play), so the
-- plays below are REBUILT from those totals. What is exact and what is estimated:
--   exact:     points, makes, assists, offensive/defensive rebounds, fouls, Joe's missed free throw,
--              the number of missed shots per player, and the final score.
--   estimated: whether each missed shot was a 2 or a 3 (split by each player's mix of made 2s/3s),
--              the order and timing of plays, and the clock (8:00 AM start, 25 minutes, nobody subbed,
--              so every player shows 25:00 and the same plus/minus).
--   not in the source, so zero: steals, blocks, deflections, turnovers.
-- The ratings shown in the screenshots came from that other app. Ours are recalculated from the plays.
--
-- Teams: Team Lime = A, Team Blue = B. Game to 20, win by 1.
-- Player names: the screenshot's first names are matched to the full names on the Players page:
-- Chibikes = Daniel Okoye, Joshua = Kenoye Joshua, Billy = Billy Uko, Whyte = Whyte Dibaal,
-- William = William Mark, Joe = Joseph Eshiett, Ephraim = Ephraim Benjamin. If any is wrong, change
-- the second column of the roster below before running.
--
-- Run once in the Supabase SQL Editor. It stops with a clear message if a player can't be found
-- (nothing is saved), and does nothing if this game was already imported.

do $import$
declare
  v_start   timestamptz := timestamptz '2026-10-10 08:00:00+01';  -- 8:00 AM Lagos
  v_gid     bigint;
  v_missing text;
begin
  if exists (select 1 from public.games where played_at = v_start) then
    raise notice 'This game is already imported (game starting %). Nothing done.', v_start;
    return;
  end if;

  create temp table _roster (label text, db_name text, team text, pid bigint) on commit drop;
  insert into _roster (label, db_name, team) values
    ('Billy', 'Billy Uko', 'A'),
    ('Whyte', 'Whyte Dibaal', 'A'),
    ('William', 'William Mark', 'A'),
    ('Joshua', 'Kenoye Joshua', 'B'),
    ('Joe', 'Joseph Eshiett', 'B'),
    ('Chibikes', 'Daniel Okoye', 'B'),
    ('Ephraim', 'Ephraim Benjamin', 'B');

  update _roster r set pid = p.id
  from public.players p
  where lower(btrim(p.name)) = lower(r.db_name);

  select string_agg(db_name, ', ') into v_missing from _roster where pid is null;
  if v_missing is not null then
    raise exception 'No player named: %. Add them on the Players page (or fix the name in this script) and run it again.', v_missing;
  end if;

  insert into public.games (played_at, status, target, win_by)
  values (v_start, 'final', 20, 1)
  returning id into v_gid;

  insert into public.game_players (game_id, player_id, team, starter)
  select v_gid, pid, team, true from _roster;

  -- (play number, seconds from tip-off, player, type). Rows with the same play number are one
  -- linked action (a make and its assist, a miss and its rebound), as when scored live.
  create temp table _plays (play int, t_sec int, label text, type text) on commit drop;
  insert into _plays (play, t_sec, label, type) values
    (1, 0, 'William', 'MAKE2'),
    (2, 38, 'Chibikes', 'MISS3'),
    (2, 38, 'Ephraim', 'OREB'),
    (3, 75, 'William', 'MAKE2'),
    (4, 113, 'Ephraim', 'MISS2'),
    (5, 150, 'William', 'MISS2'),
    (5, 150, 'Ephraim', 'DREB'),
    (6, 188, 'Chibikes', 'MISS3'),
    (7, 225, 'Whyte', 'MISS3'),
    (7, 225, 'Billy', 'OREB'),
    (8, 263, 'Joe', 'MAKE2'),
    (9, 300, 'Billy', 'MAKE2'),
    (9, 300, 'Whyte', 'AST'),
    (10, 338, 'Billy', 'FOUL'),
    (11, 375, 'Joe', 'MISS2'),
    (12, 413, 'Whyte', 'MISS2'),
    (13, 450, 'Joe', 'MISS3'),
    (14, 488, 'Billy', 'MISS2'),
    (14, 488, 'Whyte', 'OREB'),
    (15, 525, 'Joe', 'MAKE3'),
    (16, 563, 'Whyte', 'MISS3'),
    (17, 600, 'Ephraim', 'MAKE2'),
    (18, 638, 'Whyte', 'FOUL'),
    (19, 675, 'Whyte', 'MISS2'),
    (20, 713, 'Joe', 'MISS2'),
    (21, 750, 'Billy', 'MISS2'),
    (22, 788, 'Chibikes', 'MAKE3'),
    (23, 825, 'Whyte', 'FOUL'),
    (24, 863, 'Joe', 'MISS_FT'),
    (25, 900, 'Whyte', 'MAKE2'),
    (26, 938, 'Chibikes', 'MISS3'),
    (27, 975, 'William', 'MAKE3'),
    (28, 1013, 'Chibikes', 'MAKE3'),
    (29, 1050, 'Joe', 'FOUL'),
    (30, 1088, 'Whyte', 'MAKE3'),
    (30, 1088, 'William', 'AST'),
    (31, 1125, 'Ephraim', 'MISS2'),
    (31, 1125, 'William', 'DREB'),
    (32, 1163, 'Whyte', 'MISS2'),
    (32, 1163, 'Joshua', 'DREB'),
    (33, 1200, 'Chibikes', 'MAKE3'),
    (34, 1238, 'Billy', 'MAKE2'),
    (34, 1238, 'Whyte', 'AST'),
    (35, 1275, 'Joe', 'MAKE2'),
    (36, 1313, 'Billy', 'MAKE2'),
    (36, 1313, 'Whyte', 'AST'),
    (37, 1350, 'Chibikes', 'MISS3'),
    (37, 1350, 'Joshua', 'OREB'),
    (38, 1388, 'Whyte', 'MISS2'),
    (38, 1388, 'Joshua', 'DREB'),
    (39, 1425, 'Ephraim', 'MISS2'),
    (40, 1463, 'Whyte', 'MISS3'),
    (41, 1500, 'Chibikes', 'MAKE3');

  insert into public.events (game_id, player_id, type, grp, at)
  select v_gid, r.pid, p.type, g.grp, v_start + p.t_sec * interval '1 second'
  from _plays p
  join _roster r on r.label = p.label
  join (select play, gen_random_uuid() as grp from (select distinct play from _plays) d) g on g.play = p.play
  order by p.play;

  raise notice 'Imported game % (Lime 18 - 21 Blue, 41 plays).', v_gid;
end
$import$;

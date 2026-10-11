-- One-off import: game 2 on Saturday 10 Oct 2026, Team Lime 21 - 16 Team Blue.
-- Same day as 20261010_lime_vs_blue.sql (game 1), so run that one first if you haven't.
--
-- Source: three screenshots of per-player totals from another tracker (no play-by-play), so the
-- plays below are REBUILT from those totals. What is exact and what is estimated:
--   exact:     points, makes, assists, defensive rebounds, fouls, free throws made and missed, the
--              number of missed shots per player, and the final score.
--   estimated: the order and timing of plays, and the clock (8:45 AM start, 25 minutes, nobody
--              subbed, so every player shows 25:00 and the same plus/minus), and that every missed
--              shot was a 2 (Chibikes made one three and five twos, so his single miss is a 2 too).
--   not in the source, so zero: steals, blocks, deflections, turnovers, offensive rebounds.
-- The screenshots were taken while the form was still being edited (Idoreyin's and Chibikes' 2PT boxes
-- showed "01" and "05"). They are read as 1 and 5, and Joshua's 4 twos as typed; that is what makes
-- the score 21-16. Change the plays below if any of those were different.
-- The ratings in the screenshots came from that other app. Ours are recalculated from the plays.
--
-- Teams: Team Lime = A, Team Blue = B. Game to 20, win by 1.
-- Player names: "Chibikes" is Daniel Okoye, "Joshua" is Kenoye Joshua, "Ayomi" is B Yomi. Idoreyin,
-- Kingsley and Joe are matched by the names shown. If your Players page spells any differently,
-- change the second column of the roster below before running.
--
-- Run once in the Supabase SQL Editor. It stops with a clear message if a player can't be found
-- (nothing is saved), and does nothing if this game was already imported.

do $import$
declare
  v_start   timestamptz := timestamptz '2026-10-10 08:45:00+01';  -- 8:45 AM Lagos
  v_gid     bigint;
  v_missing text;
begin
  if exists (select 1 from public.games where played_at = v_start) then
    raise notice 'This game is already imported (game starting %). Nothing done.', v_start;
    return;
  end if;

  create temp table _roster (label text, db_name text, team text, pid bigint) on commit drop;
  insert into _roster (label, db_name, team) values
    ('Idoreyin', 'Idoreyin', 'A'),
    ('Chibikes', 'Daniel Okoye', 'A'),
    ('Kingsley', 'Kingsley', 'A'),
    ('Joshua', 'Kenoye Joshua', 'B'),
    ('Ayomi', 'B Yomi', 'B'),
    ('Joe', 'Joe', 'B');

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
    (1, 0, 'Idoreyin', 'MAKE2'),
    (2, 54, 'Joshua', 'MAKE2'),
    (3, 107, 'Joe', 'MISS2'),
    (4, 161, 'Chibikes', 'MAKE2'),
    (5, 214, 'Joe', 'MISS2'),
    (6, 268, 'Chibikes', 'MAKE3'),
    (6, 268, 'Kingsley', 'AST'),
    (7, 321, 'Chibikes', 'MAKE2'),
    (7, 321, 'Kingsley', 'AST'),
    (8, 375, 'Joshua', 'MAKE2'),
    (9, 429, 'Joe', 'MAKE2'),
    (10, 482, 'Chibikes', 'MISS2'),
    (10, 482, 'Ayomi', 'DREB'),
    (11, 536, 'Ayomi', 'FOUL'),
    (12, 589, 'Chibikes', 'MAKE_FT'),
    (13, 643, 'Chibikes', 'MISS_FT'),
    (13, 643, 'Joshua', 'DREB'),
    (14, 696, 'Ayomi', 'MAKE2'),
    (15, 750, 'Ayomi', 'FOUL'),
    (16, 804, 'Kingsley', 'MAKE_FT'),
    (17, 857, 'Kingsley', 'MISS_FT'),
    (17, 857, 'Joshua', 'DREB'),
    (18, 911, 'Joshua', 'MAKE2'),
    (18, 911, 'Joe', 'AST'),
    (19, 964, 'Kingsley', 'MAKE2'),
    (20, 1018, 'Joe', 'MAKE2'),
    (20, 1018, 'Joshua', 'AST'),
    (21, 1071, 'Joshua', 'MAKE2'),
    (22, 1125, 'Kingsley', 'MAKE2'),
    (23, 1179, 'Kingsley', 'MISS2'),
    (23, 1179, 'Joshua', 'DREB'),
    (24, 1232, 'Joe', 'MISS2'),
    (25, 1286, 'Chibikes', 'MAKE2'),
    (25, 1286, 'Kingsley', 'AST'),
    (26, 1339, 'Joe', 'MISS2'),
    (27, 1393, 'Chibikes', 'MAKE2'),
    (28, 1446, 'Joe', 'MAKE2'),
    (28, 1446, 'Joshua', 'AST'),
    (29, 1500, 'Chibikes', 'MAKE2');

  insert into public.events (game_id, player_id, type, grp, at)
  select v_gid, r.pid, p.type, g.grp, v_start + p.t_sec * interval '1 second'
  from _plays p
  join _roster r on r.label = p.label
  join (select play, gen_random_uuid() as grp from (select distinct play from _plays) d) g on g.play = p.play
  order by p.play;

  raise notice 'Imported game % (Lime 21 - 16 Blue, 29 plays).', v_gid;
end
$import$;

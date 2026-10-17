-- Marks games whose play order is not real, so clutch and game-winner stats can skip them.
--  * A game imported from totals (Games > Import) has its plays rebuilt: the numbers are exact but
--    the order is made up.
--  * A finished game whose scoring was edited after the fact (Edit box score) no longer has a true
--    last basket either.
-- Run this once in the Supabase SQL Editor. Until then every game counts for clutch stats.

alter table public.games
  add column if not exists estimated_order boolean not null default false;

-- Backfill: games from the one-off SQL imports (and any other import) have every play on a whole
-- second, which a game scored live never has.
update public.games g
set estimated_order = true
where exists (select 1 from public.events e where e.game_id = g.id)
  and not exists (
    select 1 from public.events e
    where e.game_id = g.id and e.at <> date_trunc('second', e.at)
  );

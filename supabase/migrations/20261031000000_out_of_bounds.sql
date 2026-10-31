-- New play type OOB: the ball went out of bounds after a missed shot, so no rebound was possible.
-- It is recorded against the shooter's miss (same group) and adds no stat; it only tells us the
-- missing rebound is real rather than forgotten. Run once in the Supabase SQL Editor.
-- Until it is run, saving an out-of-bounds play fails and nothing else changes.

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'MAKE2', 'MISS2', 'MAKE3', 'MISS3', 'MAKE_FT', 'MISS_FT',
  'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'FOUL', 'DEFL', 'OOB',
  'SUB_IN', 'SUB_OUT',
  'PAUSE', 'RESUME', 'TIMEOUT'
));

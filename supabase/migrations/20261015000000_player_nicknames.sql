-- Nicknames for players ("Chibikes" for Daniel Okoye). Shown on the Players pages and understood by
-- voice entry. Safe to run more than once.
alter table public.players
  add column if not exists nicknames text[] not null default '{}';

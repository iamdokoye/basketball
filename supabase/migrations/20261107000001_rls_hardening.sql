-- Close the two tables that were created after the initial schema and never had Row Level
-- Security turned on: shot_zones and voted_awards. The app talks to the database only from the
-- server with the service role, which bypasses RLS, so nothing changes in how it works. With RLS
-- on and no policies, the publishable/anon key can read and write nothing even if a future config
-- starts auto-exposing new tables.
-- Safe to run more than once.

alter table public.shot_zones   enable row level security;
alter table public.voted_awards enable row level security;

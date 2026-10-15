-- Supabase security advisor fixes. Safe to run more than once, and on a database that already has
-- the earlier files. (The earlier files now include the search_path line too, so a fresh setup
-- needs nothing extra.)

-- Pin the search path of our two functions so a role can't change which objects they resolve.
-- Both already use fully qualified names (public.games, ...), so nothing else changes.
alter function public.create_game(int, int, jsonb) set search_path = '';
alter function public.record_group(bigint, uuid, timestamptz, jsonb) set search_path = '';

-- rls_auto_enable() is a helper Supabase installs (it turns on row level security for new tables).
-- It doesn't need to be callable through the public API, and the app never calls it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

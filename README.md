# Pickup League

Stat tracker for 3v3 pickup games (2s and 3s, first to 20 by default). Next.js + Supabase.

## Run it locally

You need Docker (or Colima) and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm install
supabase start          # local Postgres + API; applies supabase/migrations automatically
supabase status -o env  # copy API_URL and SERVICE_ROLE_KEY
cp .env.example .env.local   # then fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Add your friends under **Players**, then **Start a game**.

## Deploy so everyone can see it

1. Create a project at [supabase.com](https://supabase.com).
2. Link and push the schema: `supabase link --project-ref <ref>` then `supabase db push`.
3. In your host (e.g. Vercel) set `SUPABASE_URL` (Project URL) and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
4. Deploy.

The service role key is used only in server code (`lib/supabase.ts` imports `server-only`). Row Level Security is on with no policies, so the public anon key can't read or write anything. The app itself has no login yet, so anyone with the link can record stats. See "Next steps" below.

## How scoring works

One person keeps stats on their phone. Tap a player, then the action. Related stats are linked so you only tap once more:

- **Made shot** asks for the assist.
- **Missed shot** asks who rebounded (teammate = offensive, opponent = defensive).
- **Free throws** are one tap each (made +1, missed).
- **Steal** asks whose ball it was and logs their turnover.
- **Block** asks whose shot it was and logs the miss, then asks for the rebound.
- **Subs:** tap "Sub out…" on a player, or tap a bench chip to sub in. Only players on the court appear in assist, rebound and steal prompts.

Every tap is stored as an event. Box scores, averages, shooting percentages, plus/minus and minutes are computed from that log. **Undo last** removes a whole linked action, the play log lets you delete any earlier play, and a finished game can be reopened to fix stats.

## Stats

Per player per game: 2PT, 3PT and FT makes/attempts, points, offensive/defensive rebounds, assists, steals, blocks, deflections, turnovers, fouls, plus/minus and minutes on court.

Minutes are wall-clock time between sub in and sub out (the game has no clock), so a long water break counts. Plus/minus is team points minus opponent points while the player is on the court.

**Rating** (used for rankings) is Hollinger's Game Score averaged per game:
`PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA − FTM) + 0.7·OREB + 0.3·DREB + STL + 0.7·AST + 0.7·BLK − 0.4·PF − TOV`.
Players need 3 games to get a rank (fewer if nobody has played that many yet).

## Design

`docs/ui-design-prompt.md` is a ready-to-paste prompt for Google Stitch or Lovable.

## Next steps

- Login or a shared passcode so only your group can write.
- Queue plays offline for courts with bad signal.

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

## Who can edit

| | Public (no password) | Admin |
|---|---|---|
| View stats, rankings, games, live scores | Always | Always |
| Start games, score, undo, finish games, add players | **Only during the open window** | Any time |
| Rename or archive players, reopen or delete games | Never | Any time |

The open window is **Saturdays 6:00 AM – 1:00 PM** in `LEAGUE_TIMEZONE` (default `Africa/Lagos`). A live countdown in the header and on Home shows when it opens (or closes), and the page flips by itself when the time comes. Outside the window everyone sees a read-only view, and a live game can still be followed (it refreshes every few seconds).

Set these in `.env.local` and in your host's environment variables:

```
LEAGUE_TIMEZONE=Africa/Lagos
ADMIN_PASSWORD=<choose a long, unique password>
# optional
# LEAGUE_WINDOW=Sat 06:00-13:00          day and 24h start-end, in LEAGUE_TIMEZONE
# LEAGUE_WINDOW_GRACE_MIN=0              keep scoring open this many minutes after the window ends
```

Sign in at `/admin` (the pill in the header). The session lasts 30 days on that device, and changing `ADMIN_PASSWORD` signs everyone out. If `ADMIN_PASSWORD` is unset nobody can sign in as admin. The rules are enforced on the server in every action, not just by hiding buttons.

A game that is still running when the window closes can't be saved to by the public, so set `LEAGUE_WINDOW_GRACE_MIN` if games tend to run over.

## Game day: live sync, offline, install

- **Live sync:** every phone that has a game open checks the server every few seconds, so plays recorded on another phone appear on yours (and a play someone undoes disappears). Your own taps show instantly. A phone that isn't on screen pauses checking to save battery and catches up the moment you switch back.
- **Offline queue:** if a phone loses signal, plays still show instantly and wait in a queue saved on the phone (the badge says "Offline · 2 plays waiting to send"). They're sent in order when the signal returns, even after a reload. Sending is safe to repeat: the server ignores a play it already has. **Finish game** waits until the queue is empty so no play is lost.
- **Faster saves (one-time SQL):** run `supabase/migrations/20261012000000_record_group.sql` in the Supabase SQL Editor. It lets a save use one database round trip instead of four. The app works without it (it falls back to the slower path), so this is optional but recommended.
- **Add to Home Screen:** on Android, Chrome shows an **Install** button on Home; on iPhone, Safari → Share → **Add to Home Screen**. The app then opens full-screen with its own icon.

## Game clock and timeouts

- **Game clock:** a stopwatch at the top of the scoreboard. It starts with the first play (or tap **Start**), **Pause** and **Resume** handle breaks, and everyone watching sees the same time. Paused time and timeouts are left out of every player's minutes and out of the idle decay in the rating, so a water break doesn't count as playing time.
- **Timeouts:** tap **Timeout**, then pick **who called it**: a team, or a specific player on the court. The clock pauses and a 60-second countdown runs (it turns red and counts up if the timeout runs over). Tap **Resume play** to end it, so the real length is recorded. The scoreboard shows each team's timeouts so far (`TO 1–0`), the play log names who called each one, and the finished game lists them with their lengths and the total game time.
- Pause, resume and timeouts are plays like any other: they can be undone, show up on other phones, and wait in the queue if the signal drops.
- **One-time SQL:** run `supabase/migrations/20261013000000_game_clock_and_timeouts.sql` in the Supabase SQL Editor. Until then the clock and timeout buttons show a message instead of saving, and everything else works as before. It also updates `record_group`, so run it even if you already ran the earlier file.
- `TIMEOUT_SECONDS` in `lib/clock.ts` sets the countdown length.

## Database security (one-time SQL)

Run `supabase/migrations/20261014000000_function_hardening.sql` in the Supabase SQL Editor. It clears the security advisor warnings: it pins the search path of `create_game` and `record_group`, and stops the public API from calling Supabase's `rls_auto_enable()` helper. The app talks to the database only from the server with the service key, so nothing changes in how it works.

## Voice and quick entry

- On the scorekeeper, **hold Hold to talk** and say a play, e.g. "Daniel scores 2, assisted by Joe", "Billy misses a three, rebound William", "Whyte steals from Daniel", "Joshua comes in for Ephraim", "timeout team B", "pause the clock", "undo that". Or type the same sentence in the box under it. Several plays in one sentence work ("…, then …").
- **Nothing is recorded until you confirm.** A sheet shows what was understood, one line per play. If a name could be two people, or the points weren't said, it asks you to pick. You can edit the heard text and tap **Re-read**, drop a line with ✕, or Cancel.
- Names are matched loosely (first name, surname, near spellings like "Danial"), preferring players on the court. **Nicknames** (e.g. Chibikes = Daniel Okoye) are saved on that phone only.
- It uses the browser's built-in speech recognition, so it's free, but it only exists in some browsers: **Chrome on Android works best** (Chrome sends the audio to Google to turn it into text). iPhone Safari is unreliable, and often missing once the app is added to the Home Screen; typing always works. Noisy courts hurt accuracy, which is what the confirm step is for.
- The sentence-to-plays logic is in `lib/voice.ts` (plain text in, plays out), so it can be tested without a microphone.

## Planned

- **Timed games:** an optional time cap, so a game can end at, say, 15 minutes by score when nobody has reached the target. The game clock above is the groundwork for it.

## Share, balance, records

- **Game recap:** on a finished game, **Share** opens the phone's share sheet (e.g. WhatsApp) with a text summary: score, teams, player of the game and standouts, plus a link to the box score. **Copy recap** does the same to the clipboard.
- **Player of the game:** the best rating in the game (ties go to the winning team), shown on the game page and starred in the box score.
- **Balance teams:** on New game, tap everyone who's playing and press **Balance teams**. It splits them into the two most even teams from ratings and win rates (people with few games count as average), and **Shuffle** gives another fair split.
- **Records and streaks** (`/records`): single-game highs, biggest win, win streaks, best month.
- **Duos and rivals** (`/chemistry`): win rate for teammates, and head-to-head records. Each profile also lists its record with and against every other player.
- **Trophy shelf:** each profile shows weekly and monthly MVPs, month awards and player-of-the-game counts. Weekly and monthly honours only count once the week or month is over.

## Importing and fixing past games (admin)

- **Import a game** (`Games` → **Import**): for a game that was tracked somewhere else. Pick the date, start time and length, add the players to Team A or B, and type each player's totals (2s, 3s and free throws made and missed, rebounds, assists, steals, blocks, turnovers, fouls, deflections). The score updates as you type and a tied game can't be saved. The plays are rebuilt from the totals: every number comes out exactly, assists and rebounds are attached to a teammate's basket or an opponent's miss where one exists, and the game ends on the winning basket. The order and timing of plays are made up, and everyone counts as on court the whole game (so minutes and plus/minus are the same for all). Times use `LEAGUE_TIMEZONE`.
- **Edit box score** (on a finished game): the same number boxes, pre-filled from the game. A higher number adds plays at the end of the game, a lower one removes that player's latest plays of that kind. Added points count toward plus/minus for whoever is on court at the end. No SQL needed for either.

## Seasons, standings, clutch and the weekly digest

- **Seasons** are worked out from each game's date, so nothing is stored and nothing needs resetting: the first game of a new season opens it, and the old one keeps its table. `LEAGUE_SEASON` sets the length: `year` (default), `half` (Jan-Jun, Jul-Dec) or `quarter`. Changing it re-sorts every past game into the new seasons.
- **Standings** (`/standings`, linked from Home and Rankings): wins, losses, win rate, rating, plus/minus, last five results and the current streak, for one season or all time. Ranked by win rate, then wins, then rating; players need 3 games in the season to be ranked. **Rankings** has the same season picker and shows the current season by default.
- **Season honours:** when a season is over, its best win rate earns **Season champion** and its best rating **Season MVP** on the trophy shelf (same 3-game rule).
- **Clutch** (`/records#clutch`): a *game-winner* is the last basket of a game decided by 3 or fewer, scored by the winning team. *Clutch points* are scored when a team is within 5 of the target and the game is within 3. Each profile shows a player's game-winners and clutch points. Games added with Import, or whose scoring was edited with Edit box score, are skipped, because their order of plays isn't real.
- **Profile:** a rating trend over the last 15 games (hover, tap or use the arrow keys to read each game) and personal bests: points, rebounds, assists, steals, blocks, threes, rating and longest win streak.
- **Weekly digest** (`/digest`, linked from Home): results, MVP of the week, the next best performers, the best single game, game-winners, records set that week (once there are earlier games to beat) and the season standings as they stood after that week, as text for the group chat. **Share** opens the phone's share sheet; **Copy digest** copies it. Pick any past week.
- **One-time SQL:** run `supabase/migrations/20261015000000_estimated_order.sql` in the Supabase SQL Editor. It adds a flag so imported games stay out of the clutch stats, and flags games already imported with the SQL scripts. Until you run it, every game counts for clutch and Import still works.

## MVPs and awards

- **MVP of the week:** the best average rating across that week's finished games. A week runs Saturday to Friday (it starts on your game day), so midweek this is last Saturday's games. If this week has no finished game yet, the most recent week with games is shown.
- **MVP of the month:** the same, across the calendar month.
- **Month awards card:** appears once a month has ended: MVP, Top Scorer, Best Shooter (effective FG%), Best Finisher (2-point %), Best Playmaker (assists), Best Defender (steals + blocks + deflections), Board Man (rebounds), Winner (win rate) and Difference Maker (plus/minus). One player can win several.
- To be considered, a player needs at least half as many games as the busiest player that month. The two percentage awards also need real shot volume, so a lucky 1-for-1 night can't win. Awards with no qualifying player show "No winner".
- Weeks and months use `LEAGUE_TIMEZONE`.

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

Minutes are playing time on the game clock, from the first recorded play to the last, minus time on the bench. Pausing the clock (or a timeout) stops the count; if nobody uses the clock, it is simply wall-clock time. Plus/minus is team points minus opponent points while the player is on the court.

**Rating** is a score out of 10 (`lib/rating.ts`), used for rankings, MVPs, awards, player of the game and team balancing.

- **Start:** every player who takes the court starts a game at **6.5**, whether they start or check in off the bench. Someone who never plays isn't rated.
- **Production** moves it up or down: `PTS + 0.4·FGM − 0.7·FGA − 0.4·(missed FT) + 0.7·OREB + 0.3·DREB + STL + 0.7·AST + 0.7·BLK + 0.3·deflections − 0.4·PF − TOV` (Hollinger's Game Score, plus deflections).
- **Pace:** the same line counts for more in a low-scoring game (scaled against a typical game to 20, about 36 points in total).
- **Time on the floor:** a lot in few minutes counts for more (and a bad stint hurts more), capped so a 30-second cameo can't explode. Short stints also count for less when averaging games.
- **Team impact:** plus/minus (how your team did while you were on court) nudges it slightly.
- **Idle decay:** a player with no recorded action at all (no shot, rebound, assist, steal, block, deflection, turnover or foul) stays at 6.5 for a short stint (the first 8% of the game on court is a grace period, which also covers a quick cameo or a sub who just checked in). Past that the rating sinks the longer they stay on court: about 5.9 after a third of the game, about 4.5 for a whole game. Any recorded action, even a foul, ends it. Starters and subs follow the same rule.
- **Did not play:** a player who never takes the court has no rating; the box score shows `–` and `DNP`.
- **Curve:** the result is squeezed onto a curve between **3.0 and 10.0**; 10 is nearly unreachable. Rough guide: a short cameo with nothing recorded 6.5, a normal game about 7, strong about 8 to 9, awful or a whole game of nothing about 4 to 4.5.
- **Averages** (season, week, month) weight each game by the share of the game played. A player is ranked once they've played 3 games (fewer if nobody has played that many yet).
- **Not included:** positional benchmarking, since pickup 3v3 has no positions. Each player gets one rating per game, built from all their minutes (it isn't reset on every substitution).

## Design

`docs/ui-design-prompt.md` is a ready-to-paste prompt for Google Stitch or Lovable.

## Next steps

- Login or a shared passcode so only your group can write.
- Queue plays offline for courts with bad signal.

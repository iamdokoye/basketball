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

## Nicknames

- On the **Players** page, tap **Nicknames** on a player (or open their profile) to add what people call them, e.g. "Chibikes" for Daniel Okoye. Up to 5 per player. They show as "aka …" on the Players page and profile.
- Voice entry listens for them, so "Chibikes scores a three" is recorded for Daniel Okoye. Words the voice parser already uses for plays ("block", "three", "assist"…) can't be nicknames, and the editor says so.
- Anyone can edit nicknames while scoring is open (Saturday window), and the admin can any time.
- **One-time SQL:** run `supabase/migrations/20261015000000_player_nicknames.sql` in the Supabase SQL Editor. Until then the Nicknames button shows a message instead of saving, and everything else works as before.

## Voice and quick entry

- On the scorekeeper, **hold Hold to talk** and say a play, e.g. "Daniel scores 2, assisted by Joe", "Billy misses a three, rebound William", "Whyte steals from Daniel", "Joshua comes in for Ephraim", "timeout team B", "pause the clock", "undo that". Or type the same sentence in the box under it. Several plays in one sentence work ("…, then …").
- **Clear sentences save straight away.** If everything is settled, the play is saved at once and a "Saved … Undo" message shows for 5 seconds. Tap **Undo** to take it back (a sentence with several plays is undone together). "Clear" means: every name matched exactly one player (a full name, first or last name, or a nickname), the shot was said to be a 2, 3 or free throw, nothing in the sentence was left over, nobody is on the bench, and there are at most 4 plays.
- **Anything else asks first.** A sheet shows what was understood, says why it is asking (for example "Not sure who "josef" is" or "Wasn't sure if it was a 2 or a 3"), and has one line per play. If a name could be two people or the points weren't said, it asks you to pick. You can edit the heard text and tap **Re-read**, drop a line with ✕, or Cancel. Near spellings like "Danial" are a good guess but still a guess, so they are asked about, and so is "undo that".
- **Switch it off** with **Save clear plays without asking** under the box (per phone) if you want the confirm sheet every time.
- Names are matched loosely (first name, surname, near spellings like "Danial"), preferring players on the court. Nicknames come from the Players page (shared by everyone); the scorekeeper's own **Nicknames** panel adds extras saved on that phone only.
- It uses the browser's built-in speech recognition, so it's free, but it only exists in some browsers: **Chrome on Android works best** (Chrome sends the audio to Google to turn it into text). iPhone Safari is unreliable, and often missing once the app is added to the Home Screen; typing always works. Noisy courts hurt accuracy, which is what the confirm step is for.
- The sentence-to-plays logic is in `lib/voice.ts` (plain text in, plays out), so it can be tested without a microphone.

## Voice server (better speech recognition, self-hosted)

`voice-server/` is a small Docker service that runs Whisper on your own server, for far better name recognition than the phone's built-in speech engine (and it works on iPhone). See `voice-server/README.md` for the Coolify setup. It is not connected to the app yet.

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

## Title cards

After a game session, every stat leader gets a trading card with a title, and the title gets bigger the longer the stretch they led. See them at **Cards** (Home has a strip of the latest week's cards).

| Card | Week | Month | Year |
|---|---|---|---|
| 🌟 All-rounder (best average rating) | ⭐ The Chosen One | 👑 The Supreme One | 🐐 The GOAT |
| 🔥 Scorer (points per game) | 🔥 Flamethrower | 🌋 Inferno | ☄️ Supernova |
| 🎯 Shooter (effective FG%, with real volume) | Sharpshooter | Deadeye | The Marksman |
| 🦍 Rebounder (rebounds per game) | Dominator | Glass Titan | The Colossus |
| 🪄 Assister (assists per game) | Dime Dropper | Maestro | 🧠 The Architect |
| 🥷 Stealer (steals per game) | Pickpocket | Phantom Thief | The Heist Master |
| 🧱 Blocker (blocks per game) | Roadblock | Great Wall | 🏰 The Fortress |
| 🧊 Clutch (game-winners, then clutch points) | Cool Hand | Ice Veins | 🥶 Absolute Zero |

- **Levels:** Week is the game week (game day to the Friday after), Month is the calendar month, Year is the calendar year, all in `LEAGUE_TIMEZONE`. The card frame is bronze, steel blue or gold (with a slow shine) to match. Each card shows the winner and the big number, with two buttons: **Save** downloads the card as a picture (a 1080 x 1350 PNG, which WhatsApp and Instagram show uncropped), and **Share** sends that picture through the phone's share sheet (WhatsApp, Instagram, Messages...) with the text and a link. If the browser can't share pictures it shares the text and link instead, and if it can't share at all it copies them. The picture is drawn on your phone, so it costs the server nothing, works offline, and the emoji match the phone's own.
- **Who qualifies:** the same rules as the month awards: a player needs at least half as many games as the busiest player in that stretch, and shooters need real shot volume. A card is left out when nobody earned it (no steals, no close finishes). Clutch uses the play-by-play, so games added with Import or edited later are skipped.
- **When they drop:** on a game day the current week, month and year cards stay face-down until **3 PM** league time (a countdown shows), so nobody gets spoilers mid-session. Set `LEAGUE_CARDS_HOUR` (0 to 23, default 15) to change it. Past periods are always open. Current month and year cards say "Leading so far" until the period ends.
- The weekly digest lists the week's titles.

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

One person keeps stats on their phone. Pick the scoring style on the scorekeeper (it is remembered per phone, so two scorers can use different ones):

- **Quick** (default): every player card has **+2 +3 Miss 2 Miss 3** buttons. One tap saves the shot straight away. A strip then offers the detail: **who assisted** after a make, **who rebounded** after a miss (offensive teammates and defensive opponents). Tap a name to add it to that play, tap **Skip**, or ignore it and it fades after 10 seconds, leaving the play as saved. Tap a player's name for the full menu (free throws, steals, blocks, fouls, subs…).
- **Pad**: tap a player once to select them, then tap actions in the bar at the bottom of the screen (+2, +3, misses, free throws, rebounds, assist, steal, block, turnover, foul, deflection, sub, undo). The player stays selected, so a run of plays by the same person is one tap each, and nothing pops up over the screen. Steals ask whose ball it was and blocks ask whose shot it was in the same chip strip.
- **Classic**: tap a player, then choose from the menu, with a question after each shot, as before.

In every style the play is saved and shown at once, related stats are linked into one play (a make and its assist, a miss and its rebound, a steal and the turnover, a block and the missed shot), and **Undo last** removes the whole play. The screen stays awake while you are scoring. Voice and typed entry work in every style.

Quick and Pad add the detail to the play that was just saved by replacing it with a copy that carries the extra event, so only the latest play can be annotated. If the phone is offline the swap waits in the same queue as everything else and arrives in order.

**Subs and late arrivals.** Tap a bench chip to sub someone in, or "Sub out…" on a player. For someone who wasn't picked when the game started, each team has a **Late arrival** button: search the league's players, or type a new name to add a guest (they become a normal player in the league). They join that team's bench and a "checks in" sheet asks who comes out. A short-handed team also gets **Join the court**, so nobody has to come out. Closing the sheet leaves them on the bench. Every phone watching the game picks the new player up within a few seconds, and their minutes count from when they check in. A game can have at most 12 players.

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

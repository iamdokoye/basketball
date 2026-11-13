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
| Preview locked cards, slideshows & in-progress awards | Locked until end of period / 2 PM | Any time (with disclaimer confirmation) |

The open window is **Saturdays 6:00 AM – 1:00 PM** in `LEAGUE_TIMEZONE` (default `Africa/Lagos`). A live countdown in the header and on Home shows when it opens (or closes), and the page flips by itself when the time comes. Outside the window everyone sees a read-only view, and a live game can still be followed (it refreshes every few seconds).
- **Admin preview & disclaimers:** When signed in as admin, you can preview and verify any content normally locked for regular players (cards before 2 PM or before month/year end, in-progress month awards, and recap slideshows for active periods). An explicit confirmation disclaimer asks if you really want to view the locked content before revealing spoilers.
- **Spectating:** every live game on Home has a **Watch live** button (or open `/games/<id>?watch=1`). It shows the live scoreboard and play log with nothing tappable, and updates by itself, even for someone who is allowed to score. **Stop watching** returns to the normal game page.

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
- **Delta cursor sync:** live sync passes a cursor (`since` event id, event count, and roster count). When no new play happened, the server returns a 50-byte `notModified` response instead of transmitting the entire event history, slashing mobile data usage by over 95% at the court. When plays are added, only the new plays are transferred.
- **Offline queue:** if a phone loses signal, plays still show instantly and wait in a queue saved on the phone (the badge says "Offline · 2 plays waiting to send"). They're sent in order when the signal returns, even after a reload. Sending is safe to repeat: the server ignores a play it already has. **Finish game** waits until the queue is empty so no play is lost.
- **Instant game loading & summaries (one-time SQL):** run `supabase/migrations/20261114000000_game_summaries.sql` in the Supabase SQL Editor. When a game finishes, its final box score, score, and roster are stored in `game_summaries`. This lets Home, Rankings, Standings, and Records load in a single fast query without re-evaluating thousands of historical events. The app works without it (it falls back to computing from events and caches the result in server memory).
- **Faster saves (one-time SQL):** run `supabase/migrations/20261012000000_record_group.sql` in the Supabase SQL Editor. It lets a save use one database round trip instead of four. The app works without it (it falls back to the slower path), so this is optional but recommended.
- **Rebound prompt and out of bounds (one-time SQL):** after a missed shot the rebound chips now stay up until you pick who rebounded, tap **Out of bounds**, or tap **Skip** (or record the next play). Out of bounds adds no stat; it just tells us the missing rebound is real, so the rating weights can be measured properly. Run `supabase/migrations/20261031000000_out_of_bounds.sql` in the Supabase SQL Editor to enable it. Until then a miss with "Out of bounds" still saves, just without the marker.
- **Add to Home Screen:** on Android, Chrome shows an **Install** button on Home; on iPhone, Safari → Share → **Add to Home Screen**. The app then opens full-screen with its own icon.
- **Offline PWA Shell & Service Worker:** An automatic service worker (`public/sw.js`) caches application shells, fonts, and static assets with network-first navigation and offline fallback. If connection drops on outdoor courts or the page is refreshed while offline, the app opens instantly and continues buffering plays into the outbox.

## Game clock, timeouts and timed games

- **Timed quarter games:** when creating a game, choose between **Target Score** (e.g. First to 20) and **Timed Quarters**:
  - **Presets:** 10 min/quarter (FIBA standard · 40m total), 12 min/quarter (NBA standard · 48m total), 15 min/quarter, 5 min/quarter sprint, or custom minutes and quarter counts.
  - **Live Quarter Countdown:** live broadcast-style countdown timer with tenths of a second in the final minute (`0:45.3`), amber warning under 60 seconds, and flashing alert under 10 seconds.
  - **Quarter buzzers & transitions:** retro arcade buzzer sounds when a quarter expires at 0:00, with smooth quarter transition controls (`Start Q2 ▶`, `Start Q3 ▶`, `Start Q4 ▶`, or `Start Overtime ▶` if tied at regulation).
  - **Buzzer Beater detection:** made shots in the dying seconds of a quarter or game trigger arena celebrations, simultaneous buzzer + cheer audio, and a celebratory alert banner.
  - **Shot clock and possession (24s / 14s):** the **⏱️ 24s** panel (on by default in timed games) shows who has the ball and the shot clock, both worked out from the plays you log, so they survive a reload and spectators see them too. A made basket gives the other team 24s; a defensive rebound or steal gives that team 24s; a turnover gives the other team 24s; an offensive rebound or a defensive foul sets 14s (never lower than what was left); a miss, out of bounds or free throws switch the clock off until the next play. It only counts while the game clock runs (pauses and timeouts freeze it), and it switches off when less than 24s remains in the quarter. At the start of a period nobody has the ball until you tap **Ball: Team A/B** (a fresh 24s, also the fix when the app guessed wrong). When it hits 0 the clock turns red and buzzes once; **Violation (TO)** then charges a turnover to a player on the team that had the ball (it asks which team if the ball isn't known). One-time SQL: run `supabase/migrations/20261106000000_possession.sql` for the **Ball** buttons to save; everything else works without it.
  - **Quarter-by-quarter box score:** finished games display a breakdown table showing points scored in each quarter and overtime (Q1, Q2, Q3, Q4, OT).
- **Game clock:** a stopwatch at the top of the scoreboard. It starts with the first play (or tap **Start**), **Pause** and **Resume** handle breaks, and everyone watching sees the same time. Paused time and timeouts are left out of every player's minutes and out of the idle decay in the rating, so a water break doesn't count as playing time.
- **Timeouts:** tap **Timeout**, then pick **who called it**: a team, or a specific player on the court. Triggers a referee whistle, pauses the clock, and runs a 60-second countdown with a 10-second warning whistle. Tap **Resume play** to end it, so the real length is recorded. The scoreboard shows each team's timeouts so far (`TO 1–0`), the play log names who called each one, and the finished game lists them with their lengths and the total game time.
- **FIBA breaks (timed games):** when a quarter's buzzer sounds the clock pauses itself and a break countdown starts: **2 minutes** between quarters (and before overtime) and **15 minutes at halftime**. The banner shows the time left and the whistle blows when it runs out; tap **Start Q…** whenever you're ready. Break time never counts as playing time.
- **FIBA timeouts (timed games):** each timeout is 60 seconds. Each team gets **2 timeouts in the first half and 3 in the second** (at most 2 of them in the last 2 minutes of the 4th quarter) and **1 per overtime**; unused ones don't carry over. The scoreboard shows timeouts left (`TO left 2–3`), the Timeout sheet shows each team's allowance, and a team with none left (or a call during a break) is turned away, including when it is said by voice. Target-score games keep unlimited timeouts.
- **One-time SQL:** run `supabase/migrations/20261105000000_timed_games.sql` in the Supabase SQL Editor to enable timed game columns and RPC params. (The app gracefully falls back to legacy target score mode if not yet applied).

## Database security (one-time SQL)

Run `supabase/migrations/20261014000000_function_hardening.sql` in the Supabase SQL Editor. It clears the security advisor warnings: it pins the search path of `create_game` and `record_group`, and stops the public API from calling Supabase's `rls_auto_enable()` helper. The app talks to the database only from the server with the service key, so nothing changes in how it works.

Also run `supabase/migrations/20261107000001_rls_hardening.sql`. It turns on Row Level Security for the two later tables (`shot_zones` and `voted_awards`), which were created after the initial schema and never had it enabled. With no policies, the publishable/anon key can read and write nothing; the server keeps working because it uses the service role.

## Your page (who is this device?)

- **Pick your name once:** tap the person icon in the header (or open `/me`) and choose your name. This device then remembers you: the icon becomes your initials, and **My page** (`/me`) shows your rank and rating, your last game, trophies, milestone progress, rating trend, recent games, badges and scouting report, plus a banner if you're in a live game. **Not you? Switch** at the bottom forgets the choice.
- **No accounts and no password.** It only personalises what you see. It grants no permissions: scoring and admin still follow the open window and the admin password, and every stat shown is already public. Anyone can pick any name, the same trust model as scoring.
- **How it stays put:** a signed, HTTP-only cookie (`pl_me`) lasts 400 days (the most Chrome allows) and is renewed whenever it is more than 2 weeks old, so anyone who opens the app now and then never expires. A copy of the player id is also kept in the browser's local storage; if the browser drops the cookie but keeps that, the cookie is restored on the next visit. In an installed app the browser is asked not to evict the site's storage. Archiving a player signs their devices out.
- **Installed app on iPhone:** the Home Screen app and Safari keep separate cookies and storage, so the installed app starts unclaimed. Pick your name once inside it. Android Chrome and desktop installs share the browser's cookies and need nothing extra.
- Cookies are signed with a key derived from `SUPABASE_SERVICE_ROLE_KEY` (or `ADMIN_PASSWORD` if that is missing). Rotating that key signs everyone out of their device identity; they just pick their name again. No SQL is needed.
- The cookie code is in `lib/identity.ts` (server) and `app/components/IdentitySync.tsx` (browser); `getMe()` is how any page asks who this device is.

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

## Voice server (Whisper AI speech recognition, optional)

`voice-server/` is a small Docker service that runs Whisper on CPU through faster-whisper. When configured via `VOICE_SERVER_URL` and `VOICE_SERVER_TOKEN` in `.env.local` or hosting settings, the app proxies audio recordings to it via `/api/voice/transcribe`, unlocking voice entry on **iPhones (iOS Safari & Home Screen PWA)** and delivering superior recognition for names and nicknames in noisy court environments.

If unset, the app gracefully falls back to browser-native speech recognition (Chrome on Android) or keyboard entry. Scorers on devices supporting both can toggle between Browser Speech and Whisper AI in the scorekeeper. See `voice-server/README.md` for Coolify / Docker deployment instructions.

## Planned

- **Timed games:** an optional time cap, so a game can end at, say, 15 minutes by score when nobody has reached the target. The game clock above is the groundwork for it.

## Share, balance, records

- **Game recap:** on a finished game, **Share** opens the phone's share sheet (e.g. WhatsApp) with a text summary: score, teams, player of the game and standouts, plus a link to the box score. **Copy recap** does the same to the clipboard.
- **Box score picture:** the same page has **Save** and **Share** for a 1080 × 1350 PNG of the full box score (both teams, every stat column, player of the game). It is drawn on the phone, like the title cards, and sharing sends the picture itself when the phone allows it.
- **Link previews:** links pasted into WhatsApp, X or Slack unfurl with a generated picture — the scoreboard for a game, the player's rank and averages for a profile, and the league card for the site. Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://pickup.example.com`) in production so the previews point at the right address.
- **Player of the game:** the best rating in the game (ties go to the winning team), shown on the game page and starred in the box score.
- **Balance teams:** on New game, tap everyone who's playing and press **Balance teams**. It splits them into the two most even teams from ratings and win rates (people with few games count as average), and **Shuffle** gives another fair split.
- **Records and streaks** (`/records`): single-game highs, biggest win, win streaks, best month.
- **Duos and rivals** (`/chemistry`): win rate for teammates, and head-to-head records. Each profile also lists its record with and against every other player.
- **Trophies & honors:** each profile shows their trophy shelf: yearly and quarterly major honors (MVP, Rookie of the Year, DPOY, Sixth Man, Most Improved, Clutch), monthly and weekly MVPs, month awards, season honors, and player-of-the-game counts. Periodic honours only count once that week, month, quarter or year is over.

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
- **When they drop:** on a game day the current week's cards stay face-down until **2 PM** league time (a countdown shows), so nobody gets spoilers mid-session. Set `LEAGUE_CARDS_HOUR` (0 to 23, default 14) to change it. Month and year cards stay face-down until the month or year is **over** (a countdown shows how long is left); the cards tab only lists finished months and years, and a link to an unfinished one just opens the latest finished one. Past periods are always open.
- **Recap slideshows:** a finished month or year has a **Watch the recap** button above its cards. It is a full-screen slideshow with music: the period's numbers, then each category winner revealed with a drumroll (the all-rounder last), then **Player of the Month / Year** (whoever won the most cards), then everyone's titles. Tap the right side for next and the left edge for back, or use the pause, mute and close buttons. The **month** show is short and bright (blue, confetti, a bouncy groove). The **year** show is longer and grander (black and gold, turning light rays, fireworks, a month-by-month MVP roll call, a slower anthem with strings, brass and timpani). The music is made on the phone with the Web Audio API, so there are no audio files, and it starts only when you tap **Play with sound**. Nothing is stored; the show is built from the same games as the cards.
- The weekly digest lists the week's titles.
- **WhatsApp & Instagram Story Card Exporter:** Any award card (weekly, monthly, or yearly) can be saved or shared as a crisp 1080×1350 PNG (4:5 story aspect ratio) directly into WhatsApp, Instagram, or group chats with full graphical styling.
- **Shot chart & visual heatmap:** On the scorekeeper, open **🗺️ Court Shot**, pick the shooter and tap the spot the shot came from. The location is saved with the shot (tap **Make** or **Miss** first), so it is undone with the play, queued offline with it, and shows up on every phone. The half-court diagram then appears on the player profile (`/players/[id]`), on the finished game, and league-wide under **Records → Shooting by zone**, with made/attempted, frequency, and hot (🔥) / cold (❄️) markers against the league benchmark. Shots made before this existed have no location: the player card shows how many shots are actually charted and estimates the rest from the league's usual mix, and a game with no charted shots shows no chart at all.
- **Live court momentum & "On Fire" heat check:**
  - **On Fire badge:** When a player makes 2+ consecutive field goals without a miss, a glowing flame badge (`🔥 ON FIRE`) appears on their live card, scorekeeper row, and game recaps.
  - **Court momentum meter:** A live tug-of-war meter showing which team controls game energy and active scoring runs (e.g. `6-0 run`).
- **Retro arcade court audio & soundboard:** Synthesized entirely in the browser with the Web Audio API (zero audio files to download or host). Automatically plays snappy swish sounds on makes, metallic rim clanks on misses, flame whooshes on heat checks, and classic arcade buzzers on game-winners. Features a floating soundboard with instant mute toggle.
- **One-time SQL:** run `supabase/migrations/20261107000000_shot_locations.sql` in the Supabase SQL Editor to store shot locations. Until then a shot from the court pad still saves; only its spot is dropped. (The older `20261026000000_shot_zones.sql` table is no longer used.)

## Tale of the tape, team builder & tournaments

- **Tale of the tape (`/compare`):** Head-to-head rivalry comparison between any two players.
  - **Direct matchup record:** Wins against each other, head-to-head points per game, score margins, and full direct match history log.
  - **Teammate synergy:** Record, win percentage, and chemistry when playing together on the same squad.
  - **Side-by-side stat battle:** Direct category-by-category showdown across PER rating, win rate, PPG, RPG, APG, SPG, BPG, TS%, 3P%, clutch points, and plus/minus with leaders highlighted.
  - **Trophy shelf face-off:** MVPs, Player of the Game, All-Star Three, Best Trio, DPOY, Clutch, 6MOY, and MIP side-by-side.
  - **Banter generator:** 1-click button to copy or share formatted group chat trash talk.
- **Fair team builder & captains live draft (`/builder`):**
  - **Court check-in:** Tap players present at today's run.
  - **Auto-balance engine:** Generates balanced 2, 3, or 4 teams using player strength, ratings, and pair chemistry synergy. 1-click sends squads directly into a new game or King of the Court.
  - **Captains live draft:** Two captains run a real-time snake draft with live projected team ratings and captain chemistry synergy indicators.
- **Tournament hub & King of the Court (`/tournaments`):**
  - **King of the Court (Winner Stays On):** Automated court rotation and reign streak tracking (first to 3 wins takes the crown).
  - **Single-elimination:** Semi-finals into the Championship Gold-Medal Game.
  - **Round-robin:** Standings table tracking points for, against, differential, and streaks, with top seeds advancing to the Final.
  - Integrates directly with the app's official scorekeeper and feeds winning teams into tournament awards.
  - **Cloud sync & live bracket updates (one-time SQL):** run `supabase/migrations/20261114000001_tournaments.sql` in the Supabase SQL Editor. Live tournament brackets, King of the Court streaks, and standings sync to the cloud and poll live across all devices on court. (Falls back gracefully to phone localStorage if not yet run).

## Seasons, standings, clutch and the weekly digest

- **Seasons** are worked out from each game's date, so nothing is stored and nothing needs resetting: the first game of a new season opens it, and the old one keeps its table. `LEAGUE_SEASON` sets the length: `year` (default), `half` (Jan-Jun, Jul-Dec) or `quarter`. Changing it re-sorts every past game into the new seasons.
- **Standings** (`/standings`, linked from Home and Rankings): wins, losses, win rate, rating, plus/minus, last five results and the current streak, for one season or all time. Ranked by win rate, then wins, then rating; players need 3 games in the season to be ranked. **Rankings** has the same season picker and shows the current season by default.
- **Season honours:** when a season is over, its best win rate earns **Season champion** and its best rating **Season MVP** on the trophy shelf (same 3-game rule).
- **Clutch** (`/records#clutch`): a *game-winner* is the last basket of a game decided by 3 or fewer, scored by the winning team. *Clutch points* are scored when a team is within 5 of the target and the game is within 3. In timed (quartered) games the game-winner is the basket that put the winning team ahead for good, if it came in clutch time and the game ended within 3, and clutch time is the last eighth of regulation (5 minutes of a 4 × 10 game, at most 5) or any overtime, with the score within 3. Each profile shows a player's game-winners and clutch points. Games added with Import, or whose scoring was edited with Edit box score, are skipped, because their order of plays isn't real.
- **Profile:** a rating trend over the last 15 games (hover, tap or use the arrow keys to read each game) and personal bests: points, rebounds, assists, steals, blocks, threes, rating and longest win streak.
- **Weekly digest** (`/digest`, linked from Home): results, MVP of the week, the next best performers, the best single game, game-winners, records set that week (once there are earlier games to beat) and the season standings as they stood after that week, as text for the group chat. **Share** opens the phone's share sheet; **Copy digest** copies it. Pick any past week.
- **One-time SQL:** run `supabase/migrations/20261015000000_estimated_order.sql` in the Supabase SQL Editor. It adds a flag so imported games stay out of the clutch stats, and flags games already imported with the SQL scripts. Until you run it, every game counts for clutch and Import still works.

## MVPs and awards

- **Tournament, quarterly and yearly honors** (`/mvp`):
  - **Most Valuable Player (MVP):** Single most outstanding player of the tournament/period (prioritized from the championship/gold-medal winning team, matching basketball tradition).
  - **All-Star Three ("Team of the Tournament"):** Selection honoring the top 3 individual players of the entire event across all teams.
  - **Team of the Tournament (Best Trio):** The 3-player lineup that played together on the same court with the best winning record and team chemistry.
  - **Team of the Year:** The squad with the highest point total and most dominant multi-tournament run during the season.
  - **Most Spectacular Player:** Community & peer-voted award decided between players based on highlight mixtapes and public interaction (recordable in `/admin`).
  - **Rookie of the Year / Rookie of the Quarter:** Top performing player in their debut season.
  - **Defensive Player of the Year (DPOY):** Best defensive impact across steals, blocks, deflections, and defensive boards.
  - **Sixth Man of the Year / Sixth Man of the Quarter:** Top player predominantly checking in off the bench (majority bench games).
  - **Most Improved Player:** Greatest leap in Game Score rating compared to prior play (returning players with established baselines).
  - **Clutch Player of the Year / Clutch Player of the Quarter:** Most clutch points and game-winners in close games.
- **One-time SQL:** run `supabase/migrations/20261025000000_voted_awards.sql` in the Supabase SQL Editor to store peer-voted honors.
- **MVP of the week and month:** the best average rating across that week's or month's finished games. A week runs Saturday to Friday.
- **Month awards card:** appears once a month has ended: MVP, Top Scorer, Best Shooter (effective FG%), Best Finisher (2-point %), Best Playmaker (assists), Best Defender (steals + blocks + deflections), Board Man (rebounds), Winner (win rate) and Difference Maker (plus/minus). One player can win several.
- To be considered, a player needs at least half as many games as the busiest player that period. The percentage awards also need real shot volume. Awards with no qualifying player show "No winner".
- Weeks, months, quarters and years use `LEAGUE_TIMEZONE`.

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
- **Production** moves it up or down: `PTS + 0.25·FGM − 0.50·FGA − 0.40·(missed FT) + 0.40·OREB + 0.20·DREB + 0.75·STL + 0.60·AST + 0.55·BLK + 0.25·deflections − 0.35·PF − 0.80·TOV` (Hollinger's Game Score structure calibrated for 3v3 half-court possession economics). Scoring efficiency is rewarded (+1.75 for a made 2PT, +2.75 for a 3PT, -0.50 for a miss), playmakers and rim protectors are rewarded (~34% basket credit for assists, +0.55 for blocks), defensive rebounds are balanced (+0.20) to honor possession control without overtaking primary scoring, and turnovers (-0.80) penalize giving away possessions.
- **Pace:** the same line counts for more in a low-scoring game (dynamically scaled against each game's target score, ~1.8x target total points).
- **Game length:** the weights are tuned for a game to 20, so production, plus/minus and the number of plays needed to avoid the inactivity decay are rescaled by `20 / target` (limited to ×0.25 to ×3). The same relative performance rates the same in a game to 10, 21 or 50, so ratings stay comparable when averaged across games of different lengths.
- **Time on the floor:** a lot in few minutes counts for more (and a bad stint hurts more), capped so a 30-second cameo can't explode. Cameos under 1 minute are scaled down to 5% game weight when averaging across a season.
- **Team impact:** plus/minus (how your team did while you were on court) nudges it slightly, minute-damped so brief stints don't inherit outsized team runs.
- **Inactivity decay:** a player with no constructive plays (made shots and free throws, rebounds, assists, steals, blocks, deflections) gradually sinks the longer they stay on court with zero involvement (~5.0 for a whole game). Constructive plays smoothly dissolve this decay, while negative plays (misses, fouls, turnovers) never reduce it, so a play that costs rating can never raise it.
- **Did not play:** a player who never takes the court has no rating; the box score shows `–` and `DNP`.
- **Curve:** the result is squeezed onto a curve between **3.0 and 10.0**; 10 is nearly unreachable. Rough guide: a short cameo with nothing recorded 6.5, a normal game about 7, strong about 8 to 9, an off night around 5.
- **Averages** (season, week, month) weight each game by the share of the game played. A player is ranked once they've played 3 games (fewer if nobody has played that many yet).
- **Not included:** positional benchmarking, since pickup 3v3 has no positions. Each player gets one rating per game, built from all their minutes (it isn't reset on every substitution).

## Design

`docs/ui-design-prompt.md` is a ready-to-paste prompt for Google Stitch or Lovable.

## Next steps

- Login or a shared passcode so only your group can write.
- Queue plays offline for courts with bad signal.

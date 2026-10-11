# UI prompt for Stitch / Lovable

Paste everything below the line into Google Stitch or Lovable. It describes the product, every screen, the real data on each screen and the visual direction. The app already exists (Next.js + Supabase), so ask the tool for **visual design and layout only**, and treat the data and flows as fixed.

---

Design a mobile-first web app called **Pickup League**: a stat tracker for a group of friends who play casual 3v3 basketball games to 20 points. One person (the scorekeeper) taps stats on their phone during the game, often outdoors in bright sun with one thumb. Everyone else checks rankings and box scores afterwards.

## Design principles

- **Thumb-first.** Primary actions sit in the bottom half of the screen. Tap targets are at least 56px tall. Nothing important needs precision tapping.
- **Readable in sunlight.** High contrast, big numbers, no thin grey text on white for anything that matters.
- **Fast over fancy.** The scorekeeper records ~100 taps per game. Every extra step costs. Screens should feel instant, with subtle feedback (a quick pop on the score, a haptic-style press state), not slow animations.
- **Sporty but clean.** Think a modern sports-app scoreboard (NBA app, Strava, Linear's restraint), not a 2000s stats site. Confident and bold with generous spacing.

## Visual direction

- Palette: warm off-white page background (#F5F3EF), near-black ink (#1C1917) for the header and scoreboard, **orange (#EA580C) for Team A and brand actions**, **blue (#0284C7) for Team B**, emerald for makes and wins, rose for misses, turnovers and fouls, indigo for substitutions. Medal colours (gold, silver, bronze) for ranks 1 to 3.
- Typography: a bold geometric or grotesque sans (Inter, Manrope or similar). Very heavy weight for scores and names, tabular numerals everywhere stats appear. Small uppercase tracked labels for section headings.
- Shapes: large rounded corners (16 to 24px) on cards, fully rounded pills for buttons and filters, soft shadows plus a 1px stone-200 ring.
- Player avatars: coloured circles with initials (no photos), colour chosen per player.
- Dark scoreboard card at the top of the live game; everything else on light cards.
- Provide light mode only; make sure contrast holds up outdoors.

## Navigation

Bottom tab bar on mobile with four tabs and icons: **Home, Rankings, Games, Players**. On desktop (md and up) the tabs move into a top bar next to the logo, and the content is centred in a ~768px column. Top header is near-black with a basketball logo mark and the wordmark.

## Screens

### 1. Home
- Large gradient orange call-to-action card: "Start a game" with a basketball glyph.
- "In progress" list of live games (pulsing LIVE badge).
- **Top players podium:** the top 3 by rating as a podium (1st centre and tallest, gold; 2nd left, silver; 3rd right, bronze) with avatar, name and rating.
- **Category leaders:** a horizontally scrolling row of small cards (Scoring, Rebounds, Assists, Steals, Blocks), each showing the per-game number and the leader's avatar and name.
- **Recent games:** compact cards, each showing date, both teams' player names, both scores (winner in bold), a blue/orange dot per team.

### 2. Rankings
- Title, one-line explanation of the rating, then a horizontally scrolling row of sort pills: Rating, PPG, RPG, APG, SPG, BPG, FG%, Win%, +/-.
- A table with a **sticky first column** (rank medal badge, avatar, name) and horizontally scrollable stat columns: RTG, GP, W-L, PPG, RPG, APG, SPG, BPG, FG%, FT%, +/-. The currently sorted column is highlighted with a light orange tint. Rows for players who have not yet qualified are greyed out with a dash for rank, plus a footnote.

### 3. New game
- A grid of all players (2 columns), each a tappable card with avatar and name. Tapping cycles: unassigned (white) → Team A (orange card) → Team B (blue card) → unassigned. Assigned cards show a small "A Starter" or "B Bench" label. The first three on each team start, anyone after that starts on the bench.
- Settings card: "Play to" number (default 20) and "Win by" (1 or 2).
- Full-width orange pill button: "Tip off · 3 vs 3".

### 4. Live game (the most important screen)
- **Sticky dark scoreboard:** Team A score on the left (orange accent bar), Team B on the right (blue accent bar), "to 20" in the middle. Scores are huge (about 60px, black weight) and pop briefly when they change.
- When a team wins, a green banner appears: "Team A wins!" with a "Finish game" button.
- Two columns of **on-court player cards** (3 per team). Each card: avatar, name, big points number, and a tiny stat line (FG 3/5, FT 1/2, reb, ast, stl, blk, to, pf; foul count turns red at 4+).
- Under each team: a **Bench** strip of pill chips (avatar + name). Tapping one starts a substitution.
- Play log card: "Play log (12) ▼" that expands to a list with a delete (✕) on each play, plus a dark "↶ Undo last" pill, and one line showing the last play.
- Subtle "End game early" text button at the bottom.

**Action sheet (bottom sheet opened by tapping a player card):** header with avatar, name and a one-line summary ("8 pts · 3 reb · 2 ast · 1 pf"). Sections as grids of large buttons:
- Shooting (2×2): Made 2 (+2) and Made 3 (+3) in solid green; Missed 2 and Missed 3 in soft rose.
- Free throws (1×2): FT made (+1) green, FT missed rose.
- Defense (3 across): Steal, Block, Deflection (neutral grey).
- Other (3 across): Off. reb, Def. reb, Assist, Turnover (rose), Foul (rose).
- Substitution (full width, soft indigo): "Sub out…".

**Follow-up sheets** reuse the same bottom-sheet style, with a title, a subtitle question and a button grid of player names:
- After Made shot: "Who assisted?" (teammates + Unassisted).
- After Missed shot: "Who got the rebound?" with a heading "Offensive rebound" (shooter's team) and "Defensive rebound" (opponents), plus a full-width "No rebound / out of bounds".
- After Steal: "Whose ball was it?" (opponents + Skip).
- After Block: "Whose shot was it?" then "Was it a 2 or a 3?".
- Substitution: "Who's coming in?" (bench players) in indigo.

### 5. Games list
Title, "+ New game" pill, and the same compact game cards as Home.

### 6. Game detail (finished game)
- Dark header card: date, FINAL, both scores huge, winner marked with a green "W", players under each score.
- One **box score table per team**, in a card with a coloured dot and "Team A": sticky Player column, then PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, PF, +/-, MIN. Plus/minus is green when positive and red when negative. A totals row, then a footer line with FG%, 3P%, FT%, eFG%, TS%.
- Secondary actions: "Reopen to fix stats" (outlined pill) and "Delete game" (red text).

### 7. Players
Title, an inline "Add a player" input with an orange Add button, then a list of cards (avatar, name, "12 GP · 14.2 pts · 5.1 reb · 3.0 ast") with an Archive link. Archived players are in a muted section with Restore.

### 8. Player profile
- Back link, large avatar, name, "12 games · 8-4 · 21:30 min/g".
- Dark card showing **League rank** (#2) on the left and **Rating** (14.3, in gold) on the right.
- A grid of stat tiles (3 across on mobile, 4 on larger): PPG, RPG, APG, SPG, BPG, TOPG, FG%, 3P%, FT%, eFG%, TS%, +/-.
- Game log table with a sticky Game column ("W 20-14 Sat, Oct 4") and PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, +/-, MIN.

## States to design

Empty states for every list (friendly, one line, with the obvious next action), a loading skeleton for tables, an error toast for "Couldn't save that play" on the live screen, and a confirmation dialog for destructive actions (Delete game, End game early).

## Deliverables

High-fidelity mobile screens (390×844) for all 8 screens above plus the follow-up sheets, then the desktop (1024px) variants of Home, Rankings and Game detail. Export as clean, componentised React + Tailwind where possible. Do not invent extra features or change the data shown.

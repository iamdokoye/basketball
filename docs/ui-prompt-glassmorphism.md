# Prompt for Stitch / Lovable / v0: Minimal + Glassmorphism

Paste everything below the line into the design tool. The app is already built (Next.js, React, Tailwind v4, Supabase), so the tool should produce **visual design and layout only**. The data and flows described are fixed.

---

You are a senior product designer. Design **Pickup League**, a mobile-first web app for a group of friends who play casual 3v3 basketball (games to 20, first to 20 by default). One person, the scorekeeper, taps stats on their phone during the game, often outdoors in bright sun with one thumb. Everyone else checks rankings and box scores afterwards.

The visual style is **minimal glassmorphism**: calm, spacious, frosted-glass surfaces floating over a soft colourful backdrop. Think Apple visionOS and iOS control centre, not a gaming UI. Restraint is the point: a few colours, one typeface, no decoration that doesn't carry information.

## 1. Style rules

### Backdrop (glass needs something behind it)
- Full-screen fixed background: a soft **mesh gradient** with 3 large blurred colour blobs on a pale base. Light theme base `#F4F1EC`; blobs in warm orange `#FDBA74`, sky blue `#7DD3FC` and a hint of lavender `#C4B5FD`, at roughly 35% opacity and 120px+ blur. Keep it low-contrast and slow, with no hard shapes and no images.
- The backdrop never scrolls with content, so glass panels always have something to refract.

### Glass surfaces (the only surface style in the app)
Define three elevations and reuse them everywhere:

| Token | Use | Fill (light) | Blur | Border | Shadow |
|---|---|---|---|---|---|
| `glass-1` | cards, list rows, table containers | `rgba(255,255,255,0.55)` | 16px | 1px `rgba(255,255,255,0.7)` | `0 4px 24px rgba(28,25,23,0.06)` |
| `glass-2` | sticky scoreboard, header, tab bar | `rgba(255,255,255,0.70)` | 24px | 1px `rgba(255,255,255,0.8)` | `0 8px 32px rgba(28,25,23,0.10)` |
| `glass-3` | bottom sheets, dialogs | `rgba(255,255,255,0.82)` | 32px | 1px `rgba(255,255,255,0.9)` | `0 -8px 40px rgba(28,25,23,0.14)` |

- Add a subtle **inner top highlight** (`inset 0 1px 0 rgba(255,255,255,0.8)`) on every glass surface.
- Corner radii: cards 20px, sheets 28px (top corners), buttons and chips fully rounded.
- **Never stack more than two glass layers.** A sheet over a card over the backdrop is the maximum.
- Provide a **solid fallback** (`rgba(255,255,255,0.92)`) for browsers without `backdrop-filter`, and for users with "reduce transparency" enabled.

### Minimalism
- One accent colour per meaning, used sparingly:
  - **Ink** `#1C1917` for text and primary buttons.
  - **Orange** `#EA580C` for Team A and the single brand call to action per screen.
  - **Blue** `#0284C7` for Team B.
  - **Emerald** `#059669` for makes and wins, **rose** `#E11D48` for misses, turnovers and fouls, **indigo** `#4F46E5` for substitutions. These last three appear only as small tints or text, never as large fills.
- No gradients on controls, no drop-shadow stacks, no decorative icons or illustrations, no emoji except the basketball mark in the logo.
- Separate content with **whitespace and hairlines** (`rgba(28,25,23,0.08)`), not boxes inside boxes.
- Generous spacing on an 8px grid: 16px page gutters, 12 to 16px gaps inside cards, 24px between sections.
- Motion: 150 to 200ms ease-out only. Allowed: sheet slide-up, score number "pop" when it changes, press-state scale to 0.98. No parallax, no looping animation except a pulsing LIVE dot.

### Typography
- One family: **Inter** (or Geist). Weights 500, 600, 800 only.
- Scores and key numbers: 800 weight, tabular numerals, tight tracking. Scoreboard digits about 64px.
- Section labels: 11px, 600, uppercase, 0.12em tracking, 55% ink.
- Body 15 to 16px, secondary text 13px at 60% ink. Never go below 11px.

### Legibility (this is used outdoors)
- Text on glass must meet **WCAG AA (4.5:1)** against the *worst-case* backdrop behind it, so raise the glass opacity before lowering text contrast.
- Minimum tap target **56px** on the live-game screen, 44px elsewhere.
- Colour is never the only signal: pair green/red with +/− signs or labels.

### Dark theme
Provide a dark variant with the same structure. Base `#0C0A09`, blobs in deep orange, blue and violet at 25% opacity, glass fills `rgba(255,255,255,0.06 / 0.09 / 0.13)` with `rgba(255,255,255,0.12)` borders, text `#FAFAF9`. Light is the default (better in sun).

## 2. Navigation and layout

- **Mobile:** floating **glass-2 tab bar** pinned to the bottom with 16px side margin, fully rounded, four tabs: Home, Rankings, Games, Players (line icons plus 11px labels). The active tab gets a soft ink-tinted pill behind it and an orange icon. Respect the iOS safe area.
- **Desktop (≥768px):** the tabs move into a slim glass-2 top bar next to the logo. Content is centred in a 768px column. No sidebar.
- Header: small basketball mark and wordmark "Pickup League" on the left. No other chrome.

## 3. Screens (design all of them, mobile 390×844 first)

### 3.1 Home
- A single large **primary glass card** with the label "READY?", the title "Start a game" and an ink circular arrow button at the right. It is the one prominent action. Give it a very faint orange tint (`rgba(234,88,12,0.10)`), not a solid fill.
- **In progress:** glass-1 rows for any live game, with a pulsing orange dot and "LIVE".
- **Top players podium:** three glass-1 columns (2nd, 1st, 3rd) with the 1st raised higher. Each shows an initials avatar, name, rating (e.g. "14.3 rtg") and a rank numeral. Use thin metallic hairlines (gold, silver, bronze) on the borders instead of filled medals.
- **Category leaders:** a horizontally scrolling row of small glass-1 chips: Scoring, Rebounds, Assists, Steals, Blocks. Each has the per-game number (large), the leader's avatar and their name.
- **Recent games:** compact glass-1 rows (see 3.5).

### 3.2 Rankings
- Title "Rankings" and one muted line: "Ranked by average Game Score per game."
- Horizontally scrolling **sort pills**: Rating, PPG, RPG, APG, SPG, BPG, FG%, Win%, +/−. The active pill is solid ink with white text, the others are glass-1.
- One **glass-1 table card**:
  - Sticky first column holding rank, initials avatar and player name. Ranks 1 to 3 get a gold, silver or bronze numeral, the rest are plain.
  - Scrolling columns: RTG, GP, W-L, PPG, RPG, APG, SPG, BPG, FG%, FT%, +/−.
  - The sorted column gets a faint orange wash. Positive +/− is emerald with a plus sign, negative is rose.
  - Rows for players who haven't qualified are 40% opacity with "–" for rank, plus a one-line footnote: "Players need 3 games to get a rank."
- Table rows use hairline dividers only. Because tables are text-heavy, use the more opaque `glass-2` fill for the table body.

### 3.3 New game
- Short intro line: "Tap a player to cycle Team A → Team B → out. The first 3 on each team start; the rest begin on the bench."
- 2-column grid of **player tiles** (glass-1, avatar + name). Tapping cycles:
  - unassigned: neutral glass.
  - Team A: orange-tinted glass (`rgba(234,88,12,0.18)`) with a 1.5px orange border and a small "A · Starter" label.
  - Team B: blue-tinted glass with a blue border and "B · Starter".
  - Bench players show "A · Bench" or "B · Bench" in a lighter tint.
- A glass-1 settings card: "Play to" (number input, default 20) and "Win by" (segmented control: 1 / 2).
- Full-width ink pill button at the bottom: "Tip off · 3 vs 3".

### 3.4 Live game (most important, spend the most effort here)
- **Sticky scoreboard** (glass-2) at the top: Team A score on the left, Team B on the right, "to 20" centred in muted text. Scores are about 64px, weight 800. Each side has a 4px vertical accent bar on its outer edge (orange left, blue right). The score number pops briefly when it changes.
- When a team reaches the target, a slim emerald-tinted glass banner appears under the scoreboard: "Team A wins!" with a "Finish game" ink pill.
- Below, two columns of **on-court player cards** (glass-1), three per team. Each card: initials avatar, name, big points number, then a tiny stat line (`FG 3/5 · FT 1/2 · 4 reb · 2 ast · 1 stl · 0 blk`). The foul count turns rose at 4 or more. The tapped card shows a subtle pressed state.
- Under each team column, a **Bench** strip: small label "BENCH · TAP TO SUB IN" over pill chips (avatar + name) in a slightly dimmer glass.
- A **Play log** glass-1 card:
  - Collapsed: "Play log (12) ▾", the last play as one muted line, and an ink "Undo last" pill.
  - Expanded: a list of plays, each with a small ✕ to delete it.
- A quiet text button at the very bottom: "End game early".
- The tab bar is hidden on this screen so the scorekeeper has the full height.

**Action sheet** (glass-3 bottom sheet, opens when a player card is tapped). Include a drag handle, the avatar and name with a one-line summary ("8 pts · 3 reb · 2 ast · 1 pf") and a close button. Sections with 11px uppercase labels, each a grid of 56px+ buttons:
- **Shooting** (2×2): "Made 2 +2" and "Made 3 +3" in emerald-tinted glass with emerald text; "Missed 2" and "Missed 3" in neutral glass with rose text.
- **Free throws** (1×2): "FT made +1" (emerald tint), "FT missed" (neutral, rose text).
- **Defense** (3 across): Steal, Block, Deflection (neutral glass).
- **Other** (3 across): Off. reb, Def. reb, Assist, Turnover (rose text), Foul (rose text).
- **Substitution** (full width, indigo-tinted glass): "Sub out…".

**Follow-up sheets** reuse the same glass-3 sheet, with a title, a one-line question and a button grid:
- After a made shot: "Who assisted?" (teammates, plus "Unassisted" in neutral).
- After a missed shot: "Who got the rebound?", with sub-heading "Offensive rebound" (shooter's team), "Defensive rebound" (opponents) and a full-width "No rebound / out of bounds".
- After a steal: "Whose ball was it?" (opponents, plus "Skip").
- After a block: "Whose shot was it?" then "Was it a 2 or a 3?".
- Substitution: "Who's coming in?" (bench players, indigo tint). Tapping a bench chip instead asks "Who's coming out?".

### 3.5 Games list and game card
- Title "Games" and a small ink "+ New game" pill.
- Game card (glass-1): date and "Final" (or pulsing LIVE) on the first line; then two rows, each a small team-coloured dot, the player names, and the team score. The winner's row is weight 800, the loser's is muted.

### 3.6 Game detail (finished)
- A glass-2 header card: date, "FINAL", both scores very large, a small emerald "W" next to the winner, players listed under each score.
- One **box-score card per team** with a coloured dot and "Team A". Sticky Player column, then PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, PF, +/−, MIN. Positive +/− emerald, negative rose, both with signs. Totals row in slightly heavier weight. Footer line: "FG 52% · 3P 40% · FT 75% · eFG 58% · TS 61%".
- Secondary actions as quiet text buttons: "Reopen to fix stats" and "Delete game" (rose).

### 3.7 Players
- Title "Players", an inline glass-1 input "Add a player" with an ink "Add" pill.
- List of glass-1 rows: avatar, name, a muted line "12 GP · 14.2 pts · 5.1 reb · 3.0 ast", and an "Archive" text button. An "Archived" section below is at 60% opacity with "Restore".

### 3.8 Player profile
- Back link, large initials avatar, name, muted line "12 games · 8-4 · 21:30 min/g".
- A glass-2 **league card** showing "League rank #2" on the left and "Rating 14.3" on the right (the number in 800 weight).
- A grid of small glass-1 stat tiles (3 across on mobile, 4 on larger screens): PPG, RPG, APG, SPG, BPG, TOPG, FG%, 3P%, FT%, eFG%, TS%, +/−.
- Game log table in a glass-2 card with a sticky Game column ("W 20-14 · Sat, Oct 4") and PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, +/−, MIN.

## 4. States to design

- **Empty states** for every list: one friendly line and the obvious next action, no illustrations.
- **Loading:** skeleton glass rows with a slow shimmer.
- **Error toast** on the live screen: "Couldn't save that play. Check your connection and try again." (rose-tinted glass, auto-dismiss).
- **Confirmation dialogs** (glass-3, centred) for "Delete game" and "End game early".
- **Pressed, focused and disabled** states for every interactive element. Focus rings are 2px ink with 2px offset.

## 5. Components to deliver

Initials avatar (sm 28px, md 40px, lg 64px, 8 muted colours), rank numeral, stat tile, sort pill, player tile (3 team states plus bench), glass card (3 elevations), bottom sheet, action button (neutral, positive, negative, indigo variants), scoreboard, box-score table, tab bar and top bar.

## 6. Deliverables

1. High-fidelity **mobile (390×844)** light-theme screens for all 8 screens in section 3, plus the live-game action sheet and each follow-up sheet.
2. **Desktop (1024px)** variants of Home, Rankings and Game detail.
3. **Dark-theme** versions of Home, Live game with the action sheet open, and Rankings.
4. A short **token sheet**: the colour, glass elevation, radius, spacing and type values above, expressed as CSS custom properties.
5. If code is generated: **React + Tailwind v4**, with the glass styles as reusable classes (`.glass-1`, `.glass-2`, `.glass-3`) built on the CSS variables above, and the `backdrop-filter` plus solid-fallback pattern included.

## 7. Constraints

- Do **not** invent features, change the labels, or change the data shown on any screen.
- Do not add photos, avatars from images, charts, illustrations or extra navigation.
- Keep it minimal: if an element isn't carrying information or an action, remove it.

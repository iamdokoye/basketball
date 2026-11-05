import type { Clock } from "./clock";
import type { GameEvent, RosterEntry, Team } from "./stats";

// Who has the ball and what the shot clock says, worked out from the play log like everything else.
// Because it is derived (not page state), it survives a reload, follows undo, and spectators see it.
//
// How each play moves the ball (FIBA 24s / 14s):
//   made basket        -> the other team, 24
//   defensive rebound  -> the rebounder's team, 24      steal -> the stealer's team, 24
//   offensive rebound  -> the rebounder's team, 14      turnover -> the other team, 24
//   foul               -> the team that was fouled; the clock never goes below 14
//   missed shot / out of bounds -> nobody has it, the clock is off until a rebound or the next play
//   free throws        -> nobody has it, the clock is off
//   POSS (scorekeeper) -> that team, 24
//   a new period       -> the clock is off until someone is given the ball

/** Seconds on the shot clock after a fresh possession, and after an offensive rebound. */
export const SHOT_CLOCK = { full: 24, afterOffReb: 14 } as const;

export type Possession = {
  /** The team with the ball, or null while it is loose or not yet known. */
  team: Team | null;
  /** Seconds the clock was set to at `atGameMs`, or null when the clock is off. */
  startSec: number | null;
  /** Game time (paused time left out) when the clock was last set. */
  atGameMs: number;
  /** Why nobody has the clock, for the label. */
  phase: "idle" | "live" | "loose" | "freeThrows";
};

export type ShotClockReading = {
  /** Whole seconds left (rounded up), or null when the clock is off. */
  sec: number | null;
  /** True once the clock has run out while the game clock is running. */
  violation: boolean;
};

const other = (t: Team): Team => (t === "A" ? "B" : "A");

/** Game-time starts of every period (quarters, then overtimes), as a set for quick lookup. */
function periodStarts(quarterMinutes: number, quarterCount: number, totalMs: number): Set<number> {
  const reg = Math.max(1, quarterMinutes) * 60_000;
  const out = new Set<number>();
  for (let i = 0; i < quarterCount; i++) out.add(i * reg);
  for (let ms = quarterCount * reg; ms <= totalMs; ms += 5 * 60_000) out.add(ms);
  return out;
}

/** The current possession after every play so far. `periods` marks where new periods start (timed games). */
export function buildPossession(
  events: GameEvent[],
  roster: RosterEntry[],
  clock: Clock,
  periods?: { quarterMinutes: number; quarterCount: number },
): Possession {
  const teamOf = new Map(roster.map((p) => [p.id, p.team]));
  const lastAt = events.length ? events[events.length - 1].at : 0;
  const starts = periods
    ? periodStarts(periods.quarterMinutes, periods.quarterCount, clock.gameMs(Math.max(lastAt, 0)) + 5 * 60_000)
    : new Set<number>();

  let st: Possession = { team: null, startSec: null, atGameMs: 0, phase: "idle" };
  const live = (team: Team | null, sec: number, g: number) => {
    st = { team, startSec: sec, atGameMs: g, phase: "live" };
  };
  const dead = (phase: "loose" | "freeThrows", g: number) => {
    st = { team: null, startSec: null, atGameMs: g, phase };
  };
  const leftAt = (g: number) => (st.startSec === null ? null : st.startSec - (g - st.atGameMs) / 1000);

  for (const e of events) {
    const g = clock.gameMs(e.at);
    const t = e.team ?? teamOf.get(e.playerId);

    switch (e.type) {
      case "RESUME":
        // Play restarts at the top of a period: nobody has the ball until the scorekeeper says so.
        if (starts.has(g)) st = { team: null, startSec: null, atGameMs: g, phase: "idle" };
        break;
      case "POSS":
        if (t) live(t, SHOT_CLOCK.full, g);
        break;
      case "MAKE2":
      case "MAKE3":
        if (t) live(other(t), SHOT_CLOCK.full, g);
        break;
      case "MISS2":
      case "MISS3":
      case "OOB":
        dead("loose", g);
        break;
      case "MAKE_FT":
      case "MISS_FT":
        dead("freeThrows", g);
        break;
      case "OREB":
        if (t) live(t, SHOT_CLOCK.afterOffReb, g);
        break;
      case "DREB":
      case "STL":
        if (t) live(t, SHOT_CLOCK.full, g);
        break;
      case "TOV":
        if (t) live(other(t), SHOT_CLOCK.full, g);
        break;
      case "FOUL": {
        if (!t) break;
        if (st.phase === "live" && st.team === t) {
          // The team with the ball fouled: it changes hands.
          live(other(t), SHOT_CLOCK.full, g);
        } else {
          // A defensive foul: the offense keeps the ball and the clock resets to 14 if it was lower.
          const left = leftAt(g);
          live(other(t), Math.max(left ?? 0, SHOT_CLOCK.afterOffReb), g);
        }
        break;
      }
      default:
        break;
    }
  }
  return st;
}

/**
 * What the shot clock reads at wall-clock time `nowMs`. It only counts while the game clock runs
 * (timeouts and pauses freeze it), and it is switched off when less than a full clock remains in the
 * period, as FIBA does. `periodRemainingMs` is that time, for timed games.
 */
export function readShotClock(
  st: Possession,
  clock: Clock,
  nowMs: number,
  periodRemainingMs?: number,
): ShotClockReading {
  if (st.startSec === null) return { sec: null, violation: false };
  const left = st.startSec - (clock.gameMs(nowMs) - st.atGameMs) / 1000;
  if (periodRemainingMs !== undefined && periodRemainingMs / 1000 < left) return { sec: null, violation: false };
  return { sec: Math.max(0, Math.ceil(left)), violation: left <= 0 && clock.running };
}

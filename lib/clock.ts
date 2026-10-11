import type { GameEvent, RosterEntry, Team } from "./stats";

// Game clock and timeouts, derived from the play log like everything else.
//
//  - The clock starts on the first play (or when the scorekeeper taps Start, a RESUME).
//  - PAUSE stops it; RESUME starts it again. A TIMEOUT also stops it, and it stays stopped
//    until a RESUME, so the real length of the timeout is recorded.
//  - Time spent paused is left out of everyone's minutes (see boxScore).
//  - A game with no clock plays at all behaves as before: it runs from the first play to the last.

/** How long a timeout lasts (the countdown shown to everyone). */
export const TIMEOUT_SECONDS = 60;

export type Segment = { start: number; end: number | null };

export type Timeout = {
  grp: string;
  team: Team | null;
  /** The player who called it, or 0 when a team called it. */
  playerId: number;
  at: number;
  /** When play resumed, or null if this timeout is still on. */
  endedAt: number | null;
};

export type Clock = {
  /** Milliseconds of playing time that had elapsed at wall-clock time `at` (paused time excluded). */
  gameMs: (at: number) => number;
  started: boolean;
  /** True while the clock is running (not paused, not in a timeout). */
  running: boolean;
  /** When the current run began (null if paused or not started). */
  runningSince: number | null;
  /** Total playing time banked from finished runs. */
  bankedMs: number;
  timeouts: Timeout[];
  /** The timeout that is on right now, if any. */
  activeTimeout: Timeout | null;
};

const isStop = (t: string) => t === "PAUSE" || t === "TIMEOUT";

/**
 * Builds the clock from the plays in order. `startMs` is when the game was created; the clock never
 * starts before that. `roster` lets a timeout called by a player carry that player's team.
 */
export function buildClock(events: GameEvent[], startMs: number, roster: RosterEntry[] = []): Clock {
  const segs: Segment[] = [];
  let open: Segment | null = null;
  let started = false;
  const timeouts: Timeout[] = [];
  const teamOf = new Map(roster.map((p) => [p.id, p.team]));

  for (const e of events) {
    if (e.type === "TIMEOUT") {
      timeouts.push({ grp: e.grp, team: e.team ?? teamOf.get(e.playerId) ?? null, playerId: e.playerId, at: e.at, endedAt: null });
    } else if (e.type === "RESUME") {
      // Play resumes: close the timeout that was on.
      const on = [...timeouts].reverse().find((t) => t.endedAt === null);
      if (on) on.endedAt = e.at;
    }

    if (!started) {
      if (isStop(e.type)) continue; // nothing to pause yet
      started = true;
      open = { start: Math.max(startMs, e.at), end: null };
      segs.push(open);
      continue;
    }
    if (isStop(e.type)) {
      if (open) {
        open.end = Math.max(open.start, e.at);
        open = null;
      }
    } else if (e.type === "RESUME" && !open) {
      open = { start: e.at, end: null };
      segs.push(open);
    }
    // Any other play while paused is recorded but does not restart the clock.
  }

  const gameMs = (at: number) =>
    segs.reduce((total, s) => total + Math.max(0, Math.min(at, s.end ?? Infinity) - s.start), 0);
  const bankedMs = segs.reduce((t, s) => (s.end === null ? t : t + (s.end - s.start)), 0);
  const activeTimeout = [...timeouts].reverse().find((t) => t.endedAt === null) ?? null;

  return {
    gameMs,
    started,
    running: open !== null,
    runningSince: open ? open.start : null,
    bankedMs,
    timeouts,
    activeTimeout,
  };
}

/** Elapsed game time right now. */
export function elapsedNow(clock: Clock, now: number): number {
  return clock.running && clock.runningSince !== null ? clock.bankedMs + Math.max(0, now - clock.runningSince) : clock.bankedMs;
}

/** "12:34", or "1:02:03" past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Seconds left on a timeout (negative once it has run over). */
export function timeoutRemaining(t: Timeout, now: number): number {
  return TIMEOUT_SECONDS - (now - t.at) / 1000;
}

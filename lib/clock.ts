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
  /** When the clock last stopped (null while running or before the first play). */
  pausedSince: number | null;
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
    pausedSince: open || segs.length === 0 ? null : segs[segs.length - 1].end,
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

// ---- Timed game quarter countdowns, buzzer beaters, and overtime -----------

export const OVERTIME_MINUTES = 5;

/**
 * FIBA breaks and timeouts for timed games:
 *  - 2 minutes between quarters and before overtime, 15 minutes at halftime.
 *  - A timeout lasts 60 seconds (TIMEOUT_SECONDS).
 *  - Each team gets 2 timeouts in the first half and 3 in the second, with at most 2 of them in
 *    the last 2 minutes of regulation, and 1 per overtime. Unused timeouts don't carry over.
 */
export const FIBA = {
  quarterBreakMs: 2 * 60 * 1000,
  halftimeBreakMs: 15 * 60 * 1000,
  firstHalfTimeouts: 2,
  secondHalfTimeouts: 3,
  overtimeTimeouts: 1,
  lateWindowMs: 2 * 60 * 1000,
  lateTimeouts: 2,
} as const;

/** Quarters in the first half (a game of 4 has Q1 and Q2; of 1 or 2, just the first). */
export function firstHalfQuarters(quarterCount: number): number {
  return Math.max(1, Math.ceil(quarterCount / 2));
}

/** How long the break lasts after period `idx` (0 = Q1; periods past the last quarter are overtimes). */
export function breakMsAfter(idx: number, quarterCount: number): number {
  const half = firstHalfQuarters(quarterCount);
  return quarterCount >= 2 && idx + 1 === half ? FIBA.halftimeBreakMs : FIBA.quarterBreakMs;
}

export type QuarterInfo = {
  quarter: number;
  quarterLabel: string;
  isOvertime: boolean;
  totalQuarters: number;
  quarterDurationMs: number;
  quarterElapsedMs: number;
  quarterRemainingMs: number;
  isQuarterEnded: boolean;
  isGameEnded: boolean;
  progress: number;
  /** Wall-clock time the buzzer sounded, when the clock ran past it without being paused yet. */
  boundaryWallMs: number | null;
  /** Length of the break that follows this period once it has ended (0 while it is being played or the game is over). */
  breakMs: number;
  /** Break time left, counted from the buzzer; 0 when there is no break or it is over. */
  breakRemainingMs: number;
};

/**
 * Calculates current quarter, countdown time remaining, and status for timed games.
 *
 * The scorekeeper pauses the clock exactly at each buzzer, so a quarter that has just ended is
 * a paused clock sitting on the boundary: it stays "ended" (0:00 left) until play resumes, and
 * only then is the next quarter on. If the clock is still running past a buzzer that hasn't been
 * paused yet, time is held at the buzzer and `boundaryWallMs` says when the buzzer sounded.
 * The game is over once regulation (or an overtime) ends with the score not tied.
 */
export function getQuarterInfo(
  clock: Clock,
  nowMs: number,
  quarterMinutes: number,
  quarterCount = 4,
  isTied = false,
): QuarterInfo {
  const regDuration = Math.max(1, quarterMinutes) * 60 * 1000;
  const otDuration = OVERTIME_MINUTES * 60 * 1000;
  const totalReg = quarterCount * regDuration;

  const startOf = (i: number) => (i < quarterCount ? i * regDuration : totalReg + (i - quarterCount) * otDuration);
  const lenOf = (i: number) => (i < quarterCount ? regDuration : otDuration);
  const periodAt = (ms: number) =>
    ms < totalReg ? Math.floor(ms / regDuration) : quarterCount + Math.floor((ms - totalReg) / otDuration);

  let elapsed = elapsedNow(clock, nowMs);
  let idx = periodAt(elapsed);
  let ended = false;
  let boundaryWallMs: number | null = null;

  if (clock.running && clock.runningSince !== null) {
    // Running through a buzzer that has not been paused yet: hold at the buzzer.
    const cur = periodAt(clock.bankedMs);
    const end = startOf(cur) + lenOf(cur);
    if (elapsed >= end) {
      elapsed = end;
      idx = cur;
      ended = true;
      boundaryWallMs = clock.runningSince + (end - clock.bankedMs);
    }
  } else if (elapsed > 0 && elapsed === startOf(idx)) {
    // Paused exactly on a boundary: that period just ended and the next has not started.
    idx -= 1;
    ended = true;
  }

  const qStart = startOf(idx);
  const dur = lenOf(idx);
  const qElapsed = Math.min(dur, Math.max(0, elapsed - qStart));
  const isOvertime = idx >= quarterCount;
  const otIndex = idx - quarterCount;
  const isGameEnded = ended && idx >= quarterCount - 1 && !isTied;

  // The break runs from the buzzer, whether or not the pause has been recorded yet.
  const breakMs = ended && !isGameEnded ? breakMsAfter(idx, quarterCount) : 0;
  const buzzerAt = clock.running ? boundaryWallMs : clock.pausedSince;
  const breakRemainingMs =
    breakMs > 0 && buzzerAt !== null ? Math.max(0, breakMs - Math.max(0, nowMs - buzzerAt)) : breakMs;

  return {
    quarter: idx + 1,
    quarterLabel: isOvertime ? (otIndex === 0 ? "OT" : `OT${otIndex + 1}`) : `Q${idx + 1}`,
    isOvertime,
    totalQuarters: quarterCount,
    quarterDurationMs: dur,
    quarterElapsedMs: qElapsed,
    quarterRemainingMs: dur - qElapsed,
    isQuarterEnded: ended,
    isGameEnded,
    progress: qElapsed / dur,
    boundaryWallMs,
    breakMs,
    breakRemainingMs,
  };
}

export type TimeoutStatus = {
  /** Can this team call one right now? */
  allowed: boolean;
  /** Timeouts left in the period of play this team is in (or about to start, during a break). */
  left: number;
  limit: number;
  scope: "1st half" | "2nd half" | "overtime";
  /** Why not, when it isn't allowed. */
  reason: string | null;
};

/** Timeouts a team has left, and whether it may call one right now, under the FIBA allowances. */
export function timeoutStatus(
  clock: Clock,
  team: Team,
  qi: QuarterInfo,
  quarterMinutes: number,
  quarterCount = 4,
): TimeoutStatus {
  const reg = Math.max(1, quarterMinutes) * 60 * 1000;
  const ot = OVERTIME_MINUTES * 60 * 1000;
  const totalReg = quarterCount * reg;
  const half = firstHalfQuarters(quarterCount);

  // A timeout belongs to the period the clock was in when it was called.
  const periodOf = (ms: number) =>
    ms <= 0
      ? 0
      : ms <= totalReg
        ? Math.min(quarterCount - 1, Math.ceil(ms / reg) - 1)
        : quarterCount + Math.ceil((ms - totalReg) / ot) - 1;
  const scopeOf = (p: number): TimeoutStatus["scope"] =>
    p >= quarterCount ? "overtime" : p < half ? "1st half" : "2nd half";

  // During a break the allowance that matters is the one for the period about to start.
  const cur = qi.isQuarterEnded ? qi.quarter : qi.quarter - 1;
  const scope = scopeOf(cur);
  const limit =
    scope === "overtime" ? FIBA.overtimeTimeouts : scope === "1st half" ? FIBA.firstHalfTimeouts : FIBA.secondHalfTimeouts;
  const mine = clock.timeouts
    .filter((t) => t.team === team)
    .map((t) => ({ ms: clock.gameMs(t.at) }))
    .map((t) => ({ ...t, p: periodOf(t.ms) }));
  const used = mine.filter((t) => (scope === "overtime" ? t.p === cur : scopeOf(t.p) === scope)).length;
  const left = Math.max(0, limit - used);

  let reason: string | null = null;
  if (qi.isGameEnded) reason = "The game is over";
  else if (qi.isQuarterEnded) reason = "No timeouts during a break";
  else if (left === 0) {
    reason =
      scope === "overtime"
        ? "No timeout left this overtime"
        : `No timeouts left in the ${scope}`;
  } else if (cur === quarterCount - 1 && qi.quarterRemainingMs <= FIBA.lateWindowMs) {
    const late = mine.filter((t) => t.p === cur && t.ms >= totalReg - FIBA.lateWindowMs).length;
    if (late >= FIBA.lateTimeouts) reason = `Only ${FIBA.lateTimeouts} timeouts in the last 2 minutes`;
  }
  return { allowed: reason === null, left, limit, scope, reason };
}

/** Formats quarter countdown: "10:00", "04:32", or "0:45.3" (with tenths in the final minute). */
export function formatCountdown(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 60000 && safe > 0) {
    const sec = Math.floor(safe / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `0:${String(sec).padStart(2, "0")}.${tenths}`;
  }
  if (safe === 0) return "0:00.0";
  return formatClock(safe);
}

/** True when a shot is made in the dying seconds of a quarter or game (within 5 seconds). */
export function isBuzzerBeater(quarterRemainingMs: number, thresholdMs = 5000): boolean {
  return quarterRemainingMs <= thresholdMs && quarterRemainingMs >= 0;
}

/** Computes points scored in each quarter/overtime for Team A and Team B. */
export function computeQuarterScores(
  events: GameEvent[],
  clock: Clock,
  quarterMinutes: number,
  quarterCount = 4,
  roster: RosterEntry[] = [],
): { label: string; A: number; B: number }[] {
  const regDuration = Math.max(1, quarterMinutes) * 60 * 1000;
  const otDuration = OVERTIME_MINUTES * 60 * 1000;
  const totalReg = quarterCount * regDuration;
  const teamOf = new Map(roster.map((p) => [p.id, p.team]));

  const scores = new Map<string, { label: string; A: number; B: number }>();
  // Pre-fill regulation quarters
  for (let q = 1; q <= quarterCount; q++) {
    scores.set(`Q${q}`, { label: `Q${q}`, A: 0, B: 0 });
  }

  for (const e of events) {
    if (e.type !== "MAKE2" && e.type !== "MAKE3" && e.type !== "MAKE_FT") continue;
    const team = e.team ?? teamOf.get(e.playerId);
    if (!team) continue;
    const pts = e.type === "MAKE3" ? 3 : e.type === "MAKE2" ? 2 : 1;
    const atMs = clock.gameMs(e.at);

    // A basket logged while the clock sits on a buzzer belongs to the period that just ended.
    let key: string;
    if (atMs <= totalReg) {
      key = `Q${Math.min(quarterCount, Math.max(1, Math.ceil(atMs / regDuration)))}`;
    } else {
      const otIdx = Math.max(0, Math.ceil((atMs - totalReg) / otDuration) - 1);
      key = otIdx === 0 ? "OT" : `OT${otIdx + 1}`;
    }

    if (!scores.has(key)) {
      scores.set(key, { label: key, A: 0, B: 0 });
    }
    scores.get(key)![team] += pts;
  }

  return Array.from(scores.values());
}


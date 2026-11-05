import type { StatLine } from "./stats";

// Player rating out of 10, per game.
//
// Every player who takes the court starts at 6.5 (a starter at tip-off, a sub when they check
// in). Their plays then push the number up or down:
//   1. "Production" adds up what they did with Hollinger's Game Score structure (points,
//      shooting efficiency, rebounds, assists, steals, blocks, turnovers, fouls), plus credit
//      for deflections. The weights are balanced for 3v3 half-court possession economics:
//      rebounds, assists and stops carry substantial value, while misses (-0.50) and turnovers (-0.80)
//      penalize inefficient chucking and wasted possessions without over-penalizing primary scorers (see WEIGHTS).
//   2. Context scales it: scoring in a low-scoring game counts for more (pace, dynamically scaled
//      against the game target), and doing a lot in few minutes counts for more (time on the floor).
//      All weights are tuned for a game to 20, so production, margin and the inactivity bar are
//      rescaled by 20 / target: the same relative performance rates the same in a game to 10 or 50.
//   3. How their team did while they were on court (plus/minus) nudges it, minute-damped so brief
//      cameos don't inherit outsized team swings.
//   4. Inactivity decay: a player who stays on court without constructive contributions (makes,
//      rebounds, assists, steals, blocks, deflections) gradually sinks toward ~5.0. Constructive
//      plays smoothly dissolve this decay, while negative plays (misses, fouls, turnovers) never
//      reduce it, so no play that costs rating can ever raise it.
//   5. The result is squeezed onto a curve between 3.0 and 10.0 with balanced negative scaling.
// Someone who never plays isn't rated.
// Pickup 3v3 has no positions, so there is no positional benchmarking.

export const RATING = {
  base: 6.5,
  min: 3.0,
  max: 10.0,
  /** Impact needed to cover about three quarters of the way from 6.5 up to 10 (tuned to 16 for responsive spread). */
  upScale: 16,
  /** Same, going down toward 3.0 (moderated to 14 to avoid over-punishing single bad games). */
  downScale: 14,
  /** Fallback typical game total points when target is unknown (game to 21 has ~38 pts). */
  refTotal: 38,
  /** The game target every weight in this file is tuned for; other targets are scaled to it. */
  refTarget: 20,
  /** Bounds on the game-length scale so extreme targets (1 or 200) can't blow the rating up or flatten it. */
  minLengthScale: 0.15,
  maxLengthScale: 3,
  /** Floor on the share of the game played used to scale a short stint. */
  minShare: 0.3,
  /** Floor on how little a short stint counts when averaging a player's games (5% for brief sub cameos). */
  weightFloor: 0.05,
  /** Rating points per point of on-court margin, before pace and minute scaling (tuned to 0.15 for team success). */
  plusMinusWeight: 0.15,
  /** Share of the game someone can be on court before the inactivity decay starts (a sub's grace period). */
  idleGrace: 0.08,
  /** Impact lost by being on court a whole game with zero constructive actions (about 5.0 out of 10). */
  idleFull: 6,
} as const;

/**
 * 3v3 half-court weights, in Hollinger's Game Score structure (hand-tuned, balanced for 3v3
 * possession economics):
 * - Scoring is efficient: a made 2PT nets +1.75 and a 3PT +2.75 (points + 0.25 - 0.50), while
 *   a miss costs -0.50. This rewards primary scorers carrying offensive volume without penalizing
 *   them for normal shot attempts.
 * - Assists (+0.60) are worth ~34% of a made 2PT basket, ensuring playmakers are rewarded for
 *   creating high-percentage looks rather than incentivizing hero-ball.
 * - Rebounding is balanced: DREB (+0.20) rewards securing possessions without letting routine boards
 *   outweigh scoring, while OREB (+0.40) prizes high-leverage second chances.
 * - Defense carries genuine weight: steals (+0.75) and blocks (+0.55) reward high-leverage stops.
 * - Turnovers (-0.80) penalize coughing up possessions.
 * - Missed free throws (-0.40) avoid double-penalizing drawn fouls.
 */
export const WEIGHTS = {
  /** Bonus for a made field goal, on top of its points. */
  fgm: 0.25,
  /** Cost of taking a field goal attempt. */
  fga: 0.50,
  oreb: 0.40,
  dreb: 0.20,
  stl: 0.75,
  tov: 0.80,
  ast: 0.60,
  blk: 0.55,
  defl: 0.25,
  pf: 0.35,
  /** Cost of a missed free throw. */
  ftMiss: 0.40,
};

/** Game-wide numbers a rating is judged against. */
export type GameContext = {
  totalPoints: number;
  maxSec: number;
  target?: number;
  gameType?: "target" | "timed";
  quarterMinutes?: number;
  quarterCount?: number;
};

/** Calculates the equivalent target score for timed quarter games based on total regulation minutes. */
export function timedEffectiveTarget(quarterMinutes = 10, quarterCount = 4): number {
  const totalMins = Math.max(1, quarterMinutes) * Math.max(1, quarterCount);
  // A standard pickup game to 20 takes ~10-12 mins of live clock time.
  // We scale regulation minutes relative to that 10m benchmark (40m = 80 pts equivalent).
  return Math.round((totalMins / 10) * RATING.refTarget);
}

export function gameContext(
  lines: StatLine[],
  targetOrGame?:
    | number
    | {
        target?: number;
        gameType?: "target" | "timed";
        quarterMinutes?: number;
        quarterCount?: number;
      },
  rules?: {
    gameType?: "target" | "timed";
    quarterMinutes?: number;
    quarterCount?: number;
  },
): GameContext {
  const isObj = typeof targetOrGame === "object" && targetOrGame !== null;
  const rawTarget = isObj ? targetOrGame.target : targetOrGame;
  const effectiveRules = isObj ? targetOrGame : rules;

  const isTimed =
    effectiveRules?.gameType === "timed" ||
    (!rawTarget && Boolean(effectiveRules?.quarterMinutes));

  const maxSec = Math.max(0, ...lines.map((l) => l.sec));

  let effectiveTarget: number;
  if (isTimed) {
    effectiveTarget = timedEffectiveTarget(
      effectiveRules?.quarterMinutes,
      effectiveRules?.quarterCount,
    );
  } else if (rawTarget && rawTarget > 0) {
    effectiveTarget = rawTarget;
  } else if (maxSec > 600) {
    // If target was omitted or 0 but game lasted longer than 10 mins, estimate equivalent target
    effectiveTarget = Math.max(RATING.refTarget, Math.round((maxSec / 600) * RATING.refTarget));
  } else {
    effectiveTarget = RATING.refTarget;
  }

  return {
    totalPoints: lines.reduce((t, l) => t + l.pts, 0),
    maxSec,
    target: effectiveTarget,
    gameType: effectiveRules?.gameType ?? (isTimed ? "timed" : "target"),
    quarterMinutes: effectiveRules?.quarterMinutes,
    quarterCount: effectiveRules?.quarterCount,
  };
}

/** Did this player take part? On the court at any point, or recorded anything. */
export function played(l: StatLine): boolean {
  return (
    l.sec > 0 ||
    l.pts > 0 ||
    l.fga > 0 ||
    l.fta > 0 ||
    l.reb > 0 ||
    l.ast > 0 ||
    l.stl > 0 ||
    l.blk > 0 ||
    l.tov > 0 ||
    l.pf > 0 ||
    l.defl > 0
  );
}

/** Anything recorded for this player in the game: a shot, free throw, rebound, assist, steal, block, turnover, foul or deflection. */
export function actions(l: StatLine): number {
  return l.fga + l.fta + l.reb + l.ast + l.stl + l.blk + l.tov + l.pf + l.defl;
}

/**
 * Plays that add value and so excuse a player from the inactivity decay: makes, rebounds,
 * assists, steals, blocks and deflections. Turnovers, fouls and misses are excluded because
 * they cost rating, and a play that costs rating must never earn some back.
 */
export function productivePlays(l: StatLine): number {
  return l.fgm + l.ftm + l.reb + l.ast + l.stl + l.blk + l.defl;
}

/** Raw contribution in "points of impact": Game Score structure with 3v3-calibrated weights, plus deflections. */
export function production(l: StatLine, w: typeof WEIGHTS = WEIGHTS): number {
  return (
    l.pts +
    w.fgm * l.fgm -
    w.fga * l.fga -
    w.ftMiss * (l.fta - l.ftm) +
    w.oreb * l.oreb +
    w.dreb * l.dreb +
    w.stl * l.stl +
    w.ast * l.ast +
    w.blk * l.blk +
    w.defl * l.defl -
    w.pf * l.pf -
    w.tov * l.tov
  );
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * How much to shrink (or grow) raw per-game numbers so a game to any target rates like a game to
 * RATING.refTarget: 1 at the reference target, 0.5 for a game to 40, 2 for a game to 10. An unknown
 * target is treated as the reference.
 */
export function lengthScale(target?: number): number {
  if (!target || target <= 0) return 1;
  return clamp(
    RATING.refTarget / target,
    RATING.minLengthScale,
    RATING.maxLengthScale,
  );
}

/** Fraction of the game this player was on court, measured against the longest-playing player. */
export function shareOfGame(l: StatLine, ctx: GameContext): number {
  return ctx.maxSec > 0 ? clamp(l.sec / ctx.maxSec, 0, 1) : 1;
}

/**
 * One player's rating for one game, or null if they didn't play. `weight` is how much this game
 * counts when averaging several (a short stint counts for less).
 */
export function rateLine(
  l: StatLine,
  ctx: GameContext,
): { rating: number; weight: number } | null {
  if (!played(l)) return null;
  const R = RATING;

  // Expected total points scales dynamically with the game target (default ~38 for a target of 21)
  const expectedTotal =
    ctx.target && ctx.target > 0 ? ctx.target * 1.8 : R.refTotal;
  const minPtsThreshold = Math.max(10, expectedTotal * 0.35);
  const pace = clamp(
    expectedTotal / Math.max(ctx.totalPoints, minPtsThreshold),
    0.65,
    1.5,
  );

  // Every weight is tuned for a game to refTarget, so a longer game produces proportionally bigger
  // raw numbers (production, margin) for the same relative performance. Scale them back down.
  const length = lengthScale(ctx.target);

  const share = shareOfGame(l, ctx);
  const time = 1 / Math.sqrt(Math.max(share, R.minShare));

  // Inactivity decay: penalizes extended court time without constructive plays.
  // Smoothly decays as positive plays accumulate (3 constructive plays in a game to refTarget
  // eliminates it completely; the bar scales with the game length).
  // Negative plays like fouls or turnovers NEVER reduce the idle penalty (prevents the "phantom foul" cliff).
  const idle =
    l.sec > 0 && ctx.maxSec > 0
      ? -R.idleFull *
        (Math.max(0, share - R.idleGrace) / (1 - R.idleGrace)) *
        Math.max(0, 1 - (productivePlays(l) * length) / 3)
      : 0;

  // Plus/minus is minute-damped with sqrt(share) so brief cameos don't inherit outsized team run impact
  const pmImpact =
    R.plusMinusWeight * l.plusMinus * Math.sqrt(share) * pace * length;

  const impact = production(l) * pace * time * length + pmImpact + idle;
  const rating =
    impact >= 0
      ? R.base + (R.max - R.base) * Math.tanh(impact / R.upScale)
      : R.base - (R.base - R.min) * Math.tanh(-impact / R.downScale);

  // Stint weight for career/season averaging:
  // Brief sub cameos (e.g. 15-30s) scale with their actual floor time rather than locking in at 0.25.
  const stintWeight = ctx.maxSec > 0 ? clamp(share, R.weightFloor, 1.0) : 1.0;

  return {
    rating: clamp(rating, R.min, R.max),
    weight: stintWeight,
  };
}

/** Weighted average of game ratings (e.g. across a week, month or season). */
export function averageRating(sum: number, weight: number): number {
  return weight > 0 ? sum / weight : RATING.base;
}

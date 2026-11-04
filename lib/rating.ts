import type { StatLine } from "./stats";

// Player rating out of 10, per game.
//
// Every player who takes the court starts at 6.5 (a starter at tip-off, a sub when they check
// in). Their plays then push the number up or down:
//   1. "Production" adds up what they did with Hollinger's Game Score structure (points,
//      shooting efficiency, rebounds, assists, steals, blocks, turnovers, fouls), plus credit
//      for deflections. The weights are tuned for 3v3 half-court with our 2s and 3s scoring:
//      offensive rebounds are prized over defensive rebounds (2.25x value), and misses carry a
//      cost so volume chucking is not rewarded (see WEIGHTS).
//   2. Context scales it: scoring in a low-scoring game counts for more (pace, dynamically scaled
//      against the game target), and doing a lot in few minutes counts for more (time on the floor).
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
 * 3v3 half-court weights, in Hollinger's Game Score structure (hand-tuned, not derived from a
 * possession model, so there is no league constant to change):
 * - Scoring is the primary currency of a 20-point game: a made 2PT nets +1.7 and a 3PT +2.7
 *   (points + 0.20 - 0.50), a miss -0.50. Break-even shooting is ~23% on 2s and ~16% on 3s,
 *   far below what this league shoots (~50% on 2s, ~37% on 3s), so volume is only punished
 *   for genuinely poor shooting.
 * - OREB (+0.36) is worth 2.25x DREB (+0.16), rewarding second chances without letting routine
 *   defensive rebounds outweigh scoring.
 * - A steal and a turnover are symmetric (+/-0.70): the scorekeeper logs both sides of a steal.
 */
export const WEIGHTS = {
  /** Bonus for a made field goal, on top of its points. */
  fgm: 0.20,
  /** Cost of taking a field goal attempt. */
  fga: 0.50,
  oreb: 0.36,
  dreb: 0.16,
  stl: 0.70,
  tov: 0.70,
  ast: 0.45,
  blk: 0.45,
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
};

export function gameContext(lines: StatLine[], target?: number): GameContext {
  return {
    totalPoints: lines.reduce((t, l) => t + l.pts, 0),
    maxSec: Math.max(0, ...lines.map((l) => l.sec)),
    target,
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

  const share = shareOfGame(l, ctx);
  const time = 1 / Math.sqrt(Math.max(share, R.minShare));

  // Inactivity decay: penalizes extended court time without constructive plays.
  // Smoothly decays as positive plays accumulate (3+ constructive plays eliminates it completely).
  // Negative plays like fouls or turnovers NEVER reduce the idle penalty (prevents the "phantom foul" cliff).
  const idle =
    l.sec > 0 && ctx.maxSec > 0
      ? -R.idleFull *
        (Math.max(0, share - R.idleGrace) / (1 - R.idleGrace)) *
        Math.max(0, 1 - productivePlays(l) / 3)
      : 0;

  // Plus/minus is minute-damped with sqrt(share) so brief cameos don't inherit outsized team run impact
  const pmImpact = R.plusMinusWeight * l.plusMinus * Math.sqrt(share) * pace;

  const impact = production(l) * pace * time + pmImpact + idle;
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

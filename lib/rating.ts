import type { StatLine } from "./stats";

// Player rating out of 10, per game.
//
// Every player who takes the court starts at 6.5 (a starter at tip-off, a sub when they check
// in). Their plays then push the number up or down:
//   1. "Production" adds up what they did with weights from Hollinger's Game Score (points,
//      shooting efficiency, rebounds, assists, steals, blocks, turnovers, fouls), plus a small
//      credit for deflections, which we track.
//   2. Context scales it: scoring in a low-scoring game counts for more (pace), and doing a lot
//      in few minutes counts for more (time on the floor).
//   3. How their team did while they were on court (plus/minus) nudges it a little.
//   4. Doing nothing for a long time costs you. A player who records no action at all (no shot,
//      rebound, assist, steal, block, turnover, foul or deflection) stays at about 6.5 for a short
//      stint (a sub's grace period, or a late cameo), but the longer they stay on court with zero
//      involvement the further they sink: roughly 6.0 after a third of the game, around 4.5 for a
//      whole game. Any recorded action ends the decay.
//   5. The result is squeezed onto a curve so it stays between 3.0 and 10.0. 10 is almost
//      unreachable; a perfect scoring game lands around 9.
// Someone who never plays isn't rated.
// Pickup 3v3 has no positions, so there is no positional benchmarking.

export const RATING = {
  base: 6.5,
  min: 3.0,
  max: 10.0,
  /** Impact needed to cover about three quarters of the way from 6.5 up to 10. */
  upScale: 22,
  /** Same, going down toward 3.0 (bad games are rarer and shorter, so the curve is steeper). */
  downScale: 9,
  /** A typical game to 20 has about this many points in total (both teams). */
  refTotal: 36,
  /** Floor on the share of the game played used to scale a short stint. */
  minShare: 0.3,
  /** Floor on how little a short stint counts when averaging a player's games. */
  weightFloor: 0.25,
  /** Rating points per point of on-court margin, before pace scaling. */
  plusMinusWeight: 0.1,
  /** Share of the game someone can be on court with zero actions before the idle decay starts (a sub's grace period). */
  idleGrace: 0.08,
  /** Impact lost by being on court a whole game with zero actions (about 4.5 out of 10). */
  idleFull: 6,
} as const;

/** Game-wide numbers a rating is judged against. */
export type GameContext = { totalPoints: number; maxSec: number };

export function gameContext(lines: StatLine[]): GameContext {
  return {
    totalPoints: lines.reduce((t, l) => t + l.pts, 0),
    maxSec: Math.max(0, ...lines.map((l) => l.sec)),
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

/** Raw contribution in "points of impact": Game Score plus deflections. */
export function production(l: StatLine): number {
  return (
    l.pts +
    0.4 * l.fgm -
    0.7 * l.fga -
    0.4 * (l.fta - l.ftm) +
    0.7 * l.oreb +
    0.3 * l.dreb +
    l.stl +
    0.7 * l.ast +
    0.7 * l.blk +
    0.3 * l.defl -
    0.4 * l.pf -
    l.tov
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

  const pace = clamp(R.refTotal / Math.max(ctx.totalPoints, 10), 0.6, 1.6);
  const share = shareOfGame(l, ctx);
  const time = 1 / Math.sqrt(Math.max(share, R.minShare));

  // On court a long time with nothing recorded: the longer, the lower. Needs real timing to mean anything.
  const idle =
    actions(l) === 0 && l.sec > 0 && ctx.maxSec > 0
      ? -R.idleFull * (Math.max(0, share - R.idleGrace) / (1 - R.idleGrace))
      : 0;

  const impact =
    production(l) * pace * time + R.plusMinusWeight * l.plusMinus * pace + idle;
  const rating =
    impact >= 0
      ? R.base + (R.max - R.base) * Math.tanh(impact / R.upScale)
      : R.base - (R.base - R.min) * Math.tanh(-impact / R.downScale);

  return {
    rating: clamp(rating, R.min, R.max),
    weight: Math.max(share, R.weightFloor),
  };
}

/** Weighted average of game ratings (e.g. across a week, month or season). */
export function averageRating(sum: number, weight: number): number {
  return weight > 0 ? sum / weight : RATING.base;
}

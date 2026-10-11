import type { CareerLine } from "./queries";
import { RATING, averageRating } from "./rating";

// Fair-teams suggestion. Each player gets one "strength" number, then we search for the
// split of the chosen players into two teams whose strengths are closest.

/** Games' worth of "average player" each person starts with, so a new player isn't rated on one fluke night. */
const PRIOR_GAMES = 3;
/** How much win rate counts next to rating (rating points, out of 10, per 100% win rate swing). */
const WIN_WEIGHT = 2;

/**
 * strength = shrunk average rating + WIN_WEIGHT × (shrunk win rate − 50%).
 * "Shrunk" pulls players with few games toward the league average; someone with no games
 * is exactly average.
 */
export function playerStrengths(career: CareerLine[]): Map<number, number> {
  const played = career.filter((c) => c.gp > 0);
  const ratings = played.map((c) => averageRating(c.ratingSum, c.ratingW));
  const meanRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : RATING.base;

  const out = new Map<number, number>();
  for (const c of career) {
    const rating = c.gp > 0 ? averageRating(c.ratingSum, c.ratingW) : meanRating;
    const shrunkRating =
      (c.gp * rating + PRIOR_GAMES * meanRating) / (c.gp + PRIOR_GAMES);
    const decided = c.wins + c.losses;
    const shrunkWin = (c.wins + PRIOR_GAMES * 0.5) / (decided + PRIOR_GAMES);
    out.set(c.playerId, shrunkRating + WIN_WEIGHT * (shrunkWin - 0.5));
  }
  return out;
}

export type Split = {
  A: number[];
  B: number[];
  /** Average strength of each team. */
  avgA: number;
  avgB: number;
  /** Absolute gap between the team averages. */
  gap: number;
};

export function fairness(gap: number): "Very even" | "Even" | "Lopsided" {
  return gap < 0.12 ? "Very even" : gap < 0.35 ? "Even" : "Lopsided";
}

const EXHAUSTIVE_LIMIT = 16;

function combos(n: number, k: number, visit: (picked: number[]) => void) {
  const picked: number[] = [];
  const rec = (start: number) => {
    if (picked.length === k) return visit(picked);
    for (let i = start; i <= n - (k - picked.length); i++) {
      picked.push(i);
      rec(i + 1);
      picked.pop();
    }
  };
  rec(0);
}

/**
 * Splits `ids` into two teams as even in size as possible and as even in strength as
 * possible. Among splits within `tolerance` of the best, one is picked at random, so
 * calling it again ("Shuffle") gives a different but still fair result.
 */
export function balanceTeams(
  ids: number[],
  strength: (id: number) => number,
  random: () => number = Math.random,
  tolerance = 0.08,
): Split | null {
  const n = ids.length;
  if (n < 2) return null;
  const s = ids.map(strength);
  const sizeA = Math.floor(n / 2);
  const sizeB = n - sizeA;
  const sum = (idx: number[]) => idx.reduce((t, i) => t + s[i], 0);

  let candidates: { idx: number[]; gap: number }[] = [];

  if (n <= EXHAUSTIVE_LIMIT) {
    let best = Infinity;
    combos(n, sizeA, (picked) => {
      // Even sizes: fix player 0 on team A so mirror images aren't searched twice.
      if (n % 2 === 0 && !picked.includes(0)) return;
      const inA = new Set(picked);
      const rest = [...Array(n).keys()].filter((i) => !inA.has(i));
      const gap = Math.abs(sum(picked) / sizeA - sum(rest) / sizeB);
      if (gap < best - 1e-9) {
        best = gap;
        candidates = [];
      }
      if (gap <= best + tolerance) candidates.push({ idx: [...picked], gap });
    });
    candidates = candidates.filter((c) => c.gap <= best + tolerance);
  } else {
    // Too many to search: snake draft strongest to weakest.
    const order = [...Array(n).keys()].sort((a, b) => s[b] - s[a]);
    const a: number[] = [];
    const b: number[] = [];
    order.forEach((i, k) =>
      ((Math.floor(k / 2) + k) % 2 === 0 ? a : b).push(i),
    );
    candidates = [
      { idx: a, gap: Math.abs(sum(a) / a.length - sum(b) / b.length) },
    ];
  }

  const pick = candidates[Math.floor(random() * candidates.length)];
  const inA = new Set(pick.idx);
  let A = pick.idx.map((i) => ids[i]);
  let B = ids.filter((_, i) => !inA.has(i));
  // Random sides so the smaller team (odd counts) isn't always Team A.
  if (random() < 0.5) [A, B] = [B, A];

  const avg = (list: number[]) =>
    list.reduce((t, id) => t + strength(id), 0) / list.length;
  const byStrength = (x: number, y: number) => strength(y) - strength(x);
  A = A.sort(byStrength);
  B = B.sort(byStrength);
  return { A, B, avgA: avg(A), avgB: avg(B), gap: Math.abs(avg(A) - avg(B)) };
}

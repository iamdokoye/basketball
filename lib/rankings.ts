import type { CareerLine } from "./queries";
import { averageRating } from "./rating";

export type Ranked = CareerLine & {
  /** Average Hollinger Game Score per game. */
  rating: number;
  /** 1-based rank, or null if the player hasn't played enough games to qualify. */
  rank: number | null;
  /** Whether the player meets the minimum games requirement to appear on the official leaderboard. */
  qualified: boolean;
};

export const SORTS = {
  rating: { label: "Rating", value: (c: Ranked) => c.rating },
  ppg: { label: "PPG", value: (c: Ranked) => c.pts / c.gp },
  rpg: { label: "RPG", value: (c: Ranked) => c.reb / c.gp },
  apg: { label: "APG", value: (c: Ranked) => c.ast / c.gp },
  spg: { label: "SPG", value: (c: Ranked) => c.stl / c.gp },
  bpg: { label: "BPG", value: (c: Ranked) => c.blk / c.gp },
  fg: { label: "FG%", value: (c: Ranked) => (c.fga ? c.fgm / c.fga : -1) },
  win: { label: "Win%", value: (c: Ranked) => c.wins / c.gp },
  pm: { label: "+/-", value: (c: Ranked) => c.plusMinus / c.gp },
} as const;

export type SortKey = keyof typeof SORTS;

/** Minimum percentage of total games a player must play in to qualify for the leaderboard (NBA-style). */
export const MIN_QUALIFY_PCT = 0.7;

export function minGamesToQualify(totalGames: number): number {
  if (totalGames <= 0) return 1;
  return Math.max(1, Math.ceil(totalGames * MIN_QUALIFY_PCT));
}

/**
 * Ranks everyone who has played. To keep the leaderboard fair and realistic, players
 * must play in at least 70% of total games to qualify. Injured or absent players have
 * their averages frozen; if their absence drops them below 70%, their rank becomes provisional
 * until they return.
 */
export function rankPlayers(
  career: CareerLine[],
  sort: SortKey = "rating",
  totalGames?: number,
): {
  rows: Ranked[];
  qualifyAt: number;
  totalGames: number;
} {
  const played = career.filter((c) => c.gp > 0);
  const baseline =
    typeof totalGames === "number" && totalGames > 0
      ? totalGames
      : Math.max(0, ...played.map((c) => c.gp));
  const qualifyAt = minGamesToQualify(baseline);
  const value = SORTS[sort].value;

  const all: Ranked[] = played.map((c) => ({
    ...c,
    rating: averageRating(c.ratingSum, c.ratingW),
    rank: null,
    qualified: c.gp >= qualifyAt,
  }));
  const byValue = (a: Ranked, b: Ranked) => value(b) - value(a) || b.rating - a.rating;
  const qualified = all.filter((c) => c.qualified).sort(byValue);
  const rest = all.filter((c) => !c.qualified).sort(byValue);
  qualified.forEach((c, i) => (c.rank = i + 1));
  return { rows: [...qualified, ...rest], qualifyAt, totalGames: baseline };
}

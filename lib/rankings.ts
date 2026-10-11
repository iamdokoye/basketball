import type { CareerLine } from "./queries";
import { gameScore } from "./stats";

export type Ranked = CareerLine & {
  /** Average Hollinger Game Score per game. */
  rating: number;
  /** 1-based rank, or null if the player hasn't played enough games to qualify. */
  rank: number | null;
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

export const MAX_QUALIFY_GAMES = 3;

/**
 * Ranks everyone who has played. Players need a few games to qualify so one
 * hot night doesn't top the table, but the bar drops to whatever the most
 * active player has so a brand-new league still gets a ranking.
 */
export function rankPlayers(career: CareerLine[], sort: SortKey = "rating"): {
  rows: Ranked[];
  qualifyAt: number;
} {
  const played = career.filter((c) => c.gp > 0);
  const qualifyAt = Math.min(MAX_QUALIFY_GAMES, Math.max(1, ...played.map((c) => c.gp)));
  const value = SORTS[sort].value;

  const all: Ranked[] = played.map((c) => ({ ...c, rating: gameScore(c) / c.gp, rank: null }));
  const byValue = (a: Ranked, b: Ranked) => value(b) - value(a) || b.rating - a.rating;
  const qualified = all.filter((c) => c.gp >= qualifyAt).sort(byValue);
  const rest = all.filter((c) => c.gp < qualifyAt).sort(byValue);
  qualified.forEach((c, i) => (c.rank = i + 1));
  return { rows: [...qualified, ...rest], qualifyAt };
}

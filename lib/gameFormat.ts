import type { Game } from "./queries";

export type GameFormat = "all" | "target" | "timed";

export const FORMAT_LABELS: Record<
  GameFormat,
  { label: string; short: string; badge: string; desc: string }
> = {
  all: {
    label: "All Formats",
    short: "All",
    badge: "All",
    desc: "Combined games across all play types",
  },
  target: {
    label: "First to 20",
    short: "Pickup",
    badge: "First to 20",
    desc: "Target score games (typically 20 points)",
  },
  timed: {
    label: "Timed Games",
    short: "Timed",
    badge: "Timed Regulation",
    desc: "Full regulation games with timed quarters",
  },
};

/** Filters a list of games by chosen game format. */
export function filterGamesByFormat(
  games: Game[],
  format?: string | null,
): Game[] {
  if (format === "target") return games.filter((g) => g.gameType !== "timed");
  if (format === "timed") return games.filter((g) => g.gameType === "timed");
  return games;
}

/** Counts finished or total games by format. */
export function countByFormat(games: Game[]): {
  all: number;
  target: number;
  timed: number;
} {
  let target = 0;
  let timed = 0;
  for (const g of games) {
    if (g.gameType === "timed") timed++;
    else target++;
  }
  return { all: games.length, target, timed };
}

/** True when the collection of games contains both pickup and timed games. */
export function hasMultipleFormats(games: Game[]): boolean {
  const counts = countByFormat(games);
  return counts.target > 0 && counts.timed > 0;
}

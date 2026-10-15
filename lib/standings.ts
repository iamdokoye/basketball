import type { Game, Player } from "./queries";
import { careerTotals } from "./queries";
import { MAX_QUALIFY_GAMES } from "./rankings";
import { averageRating, played } from "./rating";

export type StandingRow = {
  playerId: number;
  name: string;
  gp: number;
  wins: number;
  losses: number;
  /** Wins as a share of decided games (0-1). */
  pct: number;
  /** Average 0-10 rating. */
  rating: number;
  /** Point differential per game while on court. */
  pm: number;
  /** Latest results, oldest first (up to 5). */
  form: ("W" | "L")[];
  /** Current run, e.g. { kind: "W", n: 3 }, or null with no decided games. */
  streak: { kind: "W" | "L"; n: number } | null;
  /** 1-based, or null until the player has enough games (see qualifyAt). */
  rank: number | null;
};

/**
 * Player standings for a set of finished games: best win rate first, then wins, then rating.
 * Everyone who played shows up; players with fewer than `qualifyAt` games are listed last, unranked,
 * so one lucky night doesn't top the table.
 */
export function standings(
  games: Game[],
  players: Player[],
): { rows: StandingRow[]; qualifyAt: number } {
  const career = careerTotals(games, players).filter((c) => c.gp > 0);
  const qualifyAt = Math.min(MAX_QUALIFY_GAMES, Math.max(1, ...career.map((c) => c.gp)));

  // Results per player in play order (ties are skipped: neither a win nor a loss).
  const results = new Map<number, ("W" | "L")[]>();
  const ordered = games
    .filter((g) => g.status === "final")
    .sort((a, b) => a.startMs - b.startMs || a.id - b.id);
  for (const g of ordered) {
    for (const line of g.lines) {
      if (!played(line)) continue;
      const mine = g.score[line.team];
      const theirs = g.score[line.team === "A" ? "B" : "A"];
      if (mine === theirs) continue;
      const list = results.get(line.playerId) ?? [];
      list.push(mine > theirs ? "W" : "L");
      results.set(line.playerId, list);
    }
  }

  const all: StandingRow[] = career.map((c) => {
    const list = results.get(c.playerId) ?? [];
    const last = list.at(-1);
    let n = 0;
    while (last && n < list.length && list[list.length - 1 - n] === last) n++;
    const decided = c.wins + c.losses;
    return {
      playerId: c.playerId,
      name: c.name,
      gp: c.gp,
      wins: c.wins,
      losses: c.losses,
      pct: decided ? c.wins / decided : 0,
      rating: averageRating(c.ratingSum, c.ratingW),
      pm: c.plusMinus / c.gp,
      form: list.slice(-5),
      streak: last ? { kind: last, n } : null,
      rank: null,
    };
  });
  const byRecord = (a: StandingRow, b: StandingRow) =>
    b.pct - a.pct || b.wins - a.wins || b.rating - a.rating || a.name.localeCompare(b.name);
  const qualified = all.filter((r) => r.gp >= qualifyAt).sort(byRecord);
  const rest = all.filter((r) => r.gp < qualifyAt).sort(byRecord);
  qualified.forEach((r, i) => (r.rank = i + 1));
  return { rows: [...qualified, ...rest], qualifyAt };
}

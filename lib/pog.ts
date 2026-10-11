import type { Game } from "./queries";
import { gameScore, type StatLine } from "./stats";

export type Performance = { line: StatLine; rating: number };

/**
 * Everyone in a finished game, best performance first. Rating is Game Score; ties go to
 * the winning team, then points, then name.
 */
export function rankPerformances(game: Game): Performance[] {
  if (game.status !== "final") return [];
  return game.lines
    .map((line) => ({
      line,
      rating: gameScore(line),
      won: game.winner === line.team,
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        Number(b.won) - Number(a.won) ||
        b.line.pts - a.line.pts ||
        a.line.name.localeCompare(b.line.name),
    )
    .map(({ line, rating }) => ({ line, rating }));
}

/** Player of the game: the top performance, or null for an unfinished or empty game. */
export function playerOfTheGame(game: Game): Performance | null {
  return rankPerformances(game)[0] ?? null;
}

/** "12 pts · 7 reb · 3 ast", leaving out zeros (points always shown). */
export function statSummary(l: StatLine): string {
  const parts = [`${l.pts} pts`];
  if (l.reb) parts.push(`${l.reb} reb`);
  if (l.ast) parts.push(`${l.ast} ast`);
  if (l.stl) parts.push(`${l.stl} stl`);
  if (l.blk) parts.push(`${l.blk} blk`);
  return parts.join(" · ");
}

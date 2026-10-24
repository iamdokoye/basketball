import type { Game } from "./queries";
import { gameContext, rateLine } from "./rating";
import type { StatLine } from "./stats";

export type Performance = { line: StatLine; rating: number };

/**
 * Everyone who played in a finished game, best performance first. Rating is the 0-10 player
 * rating; ties go to the winning team, then points, then name.
 */
export function rankPerformances(game: Game): Performance[] {
  if (game.status !== "final") return [];
  const ctx = gameContext(game.lines);
  return game.lines
    .flatMap((line) => {
      const r = rateLine(line, ctx);
      return r ? [{ line, rating: r.rating, won: game.winner === line.team }] : [];
    })
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        Number(b.won) - Number(a.won) ||
        b.line.pts - a.line.pts ||
        a.line.name.localeCompare(b.line.name),
    )
    .map(({ line, rating }) => ({ line, rating }));
}

/** Player of the game (MVP): the top performance on the winning team, or top overall if tied. */
export function playerOfTheGame(game: Game): Performance | null {
  if (game.status !== "final") return null;
  const perfs = rankPerformances(game);
  if (perfs.length === 0) return null;
  if (!game.winner) return perfs[0];
  return perfs.find((p) => p.line.team === game.winner) ?? perfs[0];
}

/** SVP: the highest rated player on the losing team (Star of the Vanquished Party). */
export function gameSvp(game: Game): Performance | null {
  if (game.status !== "final" || !game.winner) return null;
  const losingTeam = game.winner === "A" ? "B" : "A";
  const perfs = rankPerformances(game);
  return perfs.find((p) => p.line.team === losingTeam) ?? null;
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

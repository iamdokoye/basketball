import type { Game } from "./queries";
import { formatGameDateTime } from "./format";
import { rankPerformances, statSummary } from "./pog";

/**
 * Plain-text recap of a finished game for pasting into a group chat. The caller adds the
 * link to the full box score. Returns null while the game is still live.
 */
export function buildRecap(game: Game, timeZone: string): string | null {
  if (game.status !== "final") return null;
  const perf = rankPerformances(game);
  if (perf.length === 0) return null;

  const names = (t: "A" | "B") =>
    game.roster
      .filter((p) => p.team === t)
      .map((p) => p.name)
      .join(", ");
  const win = (t: "A" | "B") => (game.winner === t ? " 🏆" : "");

  const lines: string[] = [
    "🏀 Pickup League",
    formatGameDateTime(game.playedAt, timeZone),
    "",
    `FINAL: Team A ${game.score.A} – ${game.score.B} Team B`,
    `Team A${win("A")}: ${names("A")}`,
    `Team B${win("B")}: ${names("B")}`,
    "",
  ];

  const [pog, ...rest] = perf;
  lines.push(`⭐ Player of the game: ${pog.line.name}`);
  lines.push(`${statSummary(pog.line)} (rating ${pog.rating.toFixed(1)})`);

  const standouts = rest.slice(0, 2);
  if (standouts.length > 0) {
    lines.push("", "Also standing out:");
    standouts.forEach((p) =>
      lines.push(`• ${p.line.name} – ${statSummary(p.line)}`),
    );
  }
  return lines.join("\n");
}

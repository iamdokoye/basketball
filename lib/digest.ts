import type { Game, Player } from "./queries";
import { shortName } from "@/app/components/Avatar";
import { buildCards } from "./cards";
import { clutchTotals } from "./clutch";
import { computeMvp, type Period } from "./mvp";
import { rankPerformances, statSummary } from "./pog";
import { singleGameRecords } from "./records";
import { groupBySeason, seasonKey, seasonLabel, seasonMode } from "./seasons";
import { standings } from "./standings";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The weekly digest as plain text for a group chat: results, MVP, top performers, the best single
 * game, game-winners, records set that week and the season standings as they stood after it.
 * The caller adds the link. Returns null for a week with no finished games.
 */
export function buildDigest(opts: {
  week: Period;
  allGames: Game[];
  players: Player[];
  timeZone: string;
}): string | null {
  const { week, allGames, players, timeZone } = opts;
  const games = [...week.games]
    .filter((g) => g.status === "final")
    .sort((a, b) => a.startMs - b.startMs || a.id - b.id);
  if (games.length === 0) return null;

  const out: string[] = [
    "🏀 Pickup League · Weekly digest",
    `${week.label} · ${plural(games.length, "game")}`,
    "",
    "RESULTS",
  ];
  games.forEach((g, i) => {
    const w = g.winner;
    const hi = Math.max(g.score.A, g.score.B);
    const lo = Math.min(g.score.A, g.score.B);
    const names = (t: "A" | "B") =>
      g.roster
        .filter((p) => p.team === t)
        .map((p) => shortName(p.name))
        .join(", ");
    out.push(
      w
        ? `${i + 1}. ${hi}–${lo} · ${names(w)} beat ${names(w === "A" ? "B" : "A")}`
        : `${i + 1}. ${hi}–${lo} · tied`,
    );
  });

  const mvp = computeMvp(games);
  if (mvp) {
    const w = mvp.winner;
    out.push(
      "",
      `⭐ MVP of the week: ${w.name}`,
      `${w.rating.toFixed(1)} rating · ${w.wins}-${w.losses} · ${w.pts.toFixed(1)} ppg`,
    );
    const rest = mvp.runnersUp;
    if (rest.length > 0) {
      out.push("", "Also leading:");
      rest.forEach((c, i) =>
        out.push(`${i + 2}. ${c.name} · ${c.rating.toFixed(1)} rating · ${c.wins}-${c.losses}`),
      );
    }
  }

  // Best single performance of the week.
  const best = games
    .map((g) => ({ g, top: rankPerformances(g)[0] }))
    .filter((x) => x.top)
    .sort((a, b) => b.top.rating - a.top.rating)[0];
  if (best) {
    out.push(
      "",
      `🔥 Best game: ${best.top.line.name} · ${statSummary(best.top.line)} (rating ${best.top.rating.toFixed(1)})`,
    );
  }

  // The week's title cards (Dominator, Pickpocket, ...), one line each.
  const titles = buildCards(games, "week", week);
  if (titles.length > 0) {
    out.push("", "🎴 TITLES");
    titles.forEach((c) =>
      out.push(`${c.emoji} ${c.title}: ${shortName(c.name)} (${c.value})`),
    );
  }

  const winners = clutchTotals(games).filter((c) => c.gameWinners > 0);
  if (winners.length > 0) {
    out.push(
      "",
      `🎯 Game-winners: ${winners
        .sort((a, b) => b.gameWinners - a.gameWinners)
        .map((c) => (c.gameWinners > 1 ? `${shortName(c.name)} ×${c.gameWinners}` : shortName(c.name)))
        .join(", ")}`,
    );
  }

  // Records set this week: only once there were earlier games to beat.
  const weekIds = new Set(games.map((g) => g.id));
  const weekStart = Math.min(...games.map((g) => g.startMs));
  const weekEnd = Math.max(...games.map((g) => g.startMs));
  const before = allGames.filter((g) => g.status === "final" && g.startMs < weekStart);
  if (before.length > 0) {
    const upTo = allGames.filter((g) => g.status === "final" && g.startMs <= weekEnd);
    const broken = singleGameRecords(upTo).filter((r) => r.gameId && weekIds.has(r.gameId));
    if (broken.length > 0) {
      out.push("", "📈 New records");
      broken.slice(0, 4).forEach((r) => out.push(`• ${r.label}: ${r.player?.name} (${r.value})`));
    }
  }

  // Standings as they stood after this week, within the week's season.
  const mode = seasonMode();
  const key = seasonKey(weekEnd, timeZone, mode);
  const seasonGames =
    groupBySeason(allGames, timeZone, mode)
      .find((s) => s.key === key)
      ?.games.filter((g) => g.startMs <= weekEnd) ?? [];
  const table = standings(seasonGames, players).rows.filter((r) => r.rank !== null).slice(0, 3);
  if (table.length > 0) {
    out.push("", `🏆 ${seasonLabel(key)} standings`);
    table.forEach((r) =>
      out.push(`${r.rank}. ${r.name} · ${r.wins}-${r.losses} · ${r.rating.toFixed(1)} rating`),
    );
  }
  return out.join("\n");
}

import type { Game } from "./queries";
import { localDate } from "./mvp";

// Seasons are worked out from each game's date, so nothing is stored and nothing needs resetting:
// when a new season starts, the first game in it opens it, and the old one keeps its standings.
// LEAGUE_SEASON picks the length: "year" (default), "half" (Jan-Jun, Jul-Dec) or "quarter".
// Changing it re-sorts every past game into the new seasons.

export type SeasonMode = "year" | "half" | "quarter";

export function seasonMode(): SeasonMode {
  const v = (process.env.LEAGUE_SEASON ?? "year").trim().toLowerCase();
  return v === "half" || v === "quarter" ? v : "year";
}

/** "2026", "2026-H2" or "2026-Q4". Sorts oldest to newest as plain text. */
export function seasonKey(ms: number, timeZone: string, mode: SeasonMode = seasonMode()): string {
  const { y, m } = localDate(ms, timeZone);
  if (mode === "quarter") return `${y}-Q${Math.ceil(m / 3)}`;
  if (mode === "half") return `${y}-H${m <= 6 ? 1 : 2}`;
  return String(y);
}

/** "2026", "2026 · H2", "2026 · Q4". */
export function seasonLabel(key: string): string {
  return key.replace("-", " · ");
}

export type Season = { key: string; label: string; games: Game[] };

/** Finished games grouped into seasons, newest first. */
export function groupBySeason(games: Game[], timeZone: string, mode: SeasonMode = seasonMode()): Season[] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    if (g.status !== "final") continue;
    const key = seasonKey(g.startMs, timeZone, mode);
    map.set(key, [...(map.get(key) ?? []), g]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => ({ key, label: seasonLabel(key), games: list }));
}

/** What a page shows for a `?season=` value: one season, or everything ("all"). */
export type SeasonView = { key: string; label: string; games: Game[] };

/**
 * Picks the view: the requested season if it exists, "all" for all time, otherwise the current
 * season (or the latest one with games, e.g. just after a new season starts but before its first game).
 */
export function pickSeason(
  seasons: Season[],
  allGames: Game[],
  requested: string | undefined,
  currentKey: string,
): SeasonView {
  const all: SeasonView = {
    key: "all",
    label: "All time",
    games: allGames.filter((g) => g.status === "final"),
  };
  if (requested === "all") return all;
  const wanted = seasons.find((s) => s.key === requested);
  if (wanted) return wanted;
  const fallback = seasons.find((s) => s.key === currentKey) ?? seasons[0];
  return fallback ?? all;
}

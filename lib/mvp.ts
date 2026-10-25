import type { Game } from "./queries";
import { averageRating, gameContext, played, rateLine } from "./rating";
import { emptyLine, type StatLine } from "./stats";

// MVP of the week / month. Pure functions: pass in finished games and the league's
// timezone. A "week" starts on the league's game day (Saturday by default) and runs
// to the Friday after, so on a Wednesday "this week" is last Saturday's games.

export type PeriodKind = "week" | "month" | "quarter" | "year";
export type Period = {
  kind: PeriodKind;
  key: string;
  label: string;
  games: Game[];
};

export type Candidate = {
  playerId: number;
  name: string;
  gp: number;
  wins: number;
  losses: number;
  /** Average Game Score per game. */
  rating: number;
  /** Per-game averages. */
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
};

export type MvpResult = {
  winner: Candidate;
  runnersUp: Candidate[];
  games: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localDate(
  ms: number,
  timeZone: string,
): { y: number; m: number; d: number; wd: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    wd: DAYS.indexOf(get("weekday")),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (dt: Date) =>
  `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

/** "YYYY-MM-DD" of the day the week containing `ms` started (on `weekStartDay`, 0 = Sunday), in the league timezone. */
export function weekKey(
  ms: number,
  timeZone: string,
  weekStartDay: number,
): string {
  const { y, m, d, wd } = localDate(ms, timeZone);
  const back = (wd - weekStartDay + 7) % 7;
  return iso(new Date(Date.UTC(y, m - 1, d - back)));
}

/** "YYYY-MM" of the calendar month containing `ms`, in the league timezone. */
export function monthKey(ms: number, timeZone: string): string {
  const { y, m } = localDate(ms, timeZone);
  return `${y}-${pad(m)}`;
}

/** "YYYY-Q1" to "YYYY-Q4" of the quarter containing `ms`, in the league timezone. */
export function quarterKey(ms: number, timeZone: string): string {
  const { y, m } = localDate(ms, timeZone);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

/** "YYYY" of the calendar year containing `ms`, in the league timezone. */
export function yearKey(ms: number, timeZone: string): string {
  const { y } = localDate(ms, timeZone);
  return String(y);
}

const utcFmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts });

/** "Oct 10 – Oct 16" */
export function weekLabel(key: string): string {
  const start = new Date(`${key}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = utcFmt({ month: "short", day: "numeric" });
  return `${f.format(start)} – ${f.format(end)}`;
}

/** "October 2026" */
export function monthLabel(key: string): string {
  return utcFmt({ month: "long", year: "numeric" }).format(
    new Date(`${key}-01T00:00:00Z`),
  );
}

/** "Q4 2026" */
export function quarterLabel(key: string): string {
  const [y, q] = key.split("-");
  return `${q} ${y}`;
}

/** "2026" */
export function yearLabel(key: string): string {
  return key;
}

/** Finished games grouped into weeks, months, quarters, or years, newest first. */
export function groupByPeriod(
  games: Game[],
  kind: PeriodKind,
  timeZone: string,
  weekStartDay: number,
): Period[] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    if (g.status !== "final") continue;
    const key =
      kind === "week"
        ? weekKey(g.startMs, timeZone, weekStartDay)
        : kind === "month"
          ? monthKey(g.startMs, timeZone)
          : kind === "quarter"
            ? quarterKey(g.startMs, timeZone)
            : yearKey(g.startMs, timeZone);
    const list = map.get(key) ?? [];
    list.push(g);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => ({
      kind,
      key,
      label:
        kind === "week"
          ? weekLabel(key)
          : kind === "month"
            ? monthLabel(key)
            : kind === "quarter"
              ? quarterLabel(key)
              : yearLabel(key),
      games: list,
    }));
}

/**
 * Picks the MVP: the best average Game Score per game. To stop one big night beating a
 * steady player, you need at least half as many games as the busiest player in the period.
 * Ties go to wins, then points, then name.
 */
export type PlayerTotals = {
  playerId: number;
  name: string;
  gp: number;
  wins: number;
  losses: number;
  /** Summed stats across the games. */
  total: StatLine;
  /** Sum of (per-game rating x weight) and of the weights. */
  ratingSum: number;
  ratingW: number;
};

/** Per-player totals across the finished games given. */
export function aggregatePlayers(games: Game[]): PlayerTotals[] {
  const acc = new Map<number, PlayerTotals>();
  for (const g of games) {
    if (g.status !== "final") continue;
    const ctx = gameContext(g.lines);
    for (const line of g.lines) {
      if (!played(line)) continue; // on the roster but never took the court
      let a = acc.get(line.playerId);
      if (!a) {
        a = {
          playerId: line.playerId,
          name: line.name,
          gp: 0,
          wins: 0,
          losses: 0,
          total: emptyLine({ id: line.playerId, name: line.name, team: "A" }),
          ratingSum: 0,
          ratingW: 0,
        };
        acc.set(line.playerId, a);
      }
      a.gp++;
      const r = rateLine(line, ctx);
      if (r) {
        a.ratingSum += r.rating * r.weight;
        a.ratingW += r.weight;
      }
      for (const k of Object.keys(a.total) as (keyof StatLine)[]) {
        if (typeof line[k] === "number" && k !== "playerId") (a.total[k] as number) += line[k] as number;
      }
      const mine = g.score[line.team];
      const theirs = g.score[line.team === "A" ? "B" : "A"];
      if (mine > theirs) a.wins++;
      else if (mine < theirs) a.losses++;
    }
  }
  return [...acc.values()];
}

/** Minimum games to be considered for an award: half as many as the busiest player. */
export function minGamesFor(players: PlayerTotals[]): number {
  return Math.ceil(Math.max(0, ...players.map((p) => p.gp)) / 2);
}

export function computeMvp(
  games: Game[],
  options?: { championPriority?: boolean },
): MvpResult | null {
  const acc = new Map(aggregatePlayers(games).map((a) => [a.playerId, a]));
  if (acc.size === 0) return null;

  const minGames = minGamesFor([...acc.values()]);
  const finals = games.filter((g) => g.status === "final");
  const lastFinal = [...finals].sort((a, b) => a.startMs - b.startMs).at(-1);
  const champPlayerIds = new Set<number>();
  if (options?.championPriority && lastFinal && lastFinal.winner) {
    const winnerTeam = lastFinal.winner;
    for (const l of lastFinal.lines) {
      if (l.team === winnerTeam && played(l)) {
        champPlayerIds.add(l.playerId);
      }
    }
  }

  const candidates: Candidate[] = [...acc.entries()]
    .filter(([, a]) => a.gp >= minGames)
    .map(([playerId, a]) => ({
      playerId,
      name: a.name,
      gp: a.gp,
      wins: a.wins,
      losses: a.losses,
      rating: averageRating(a.ratingSum, a.ratingW),
      pts: a.total.pts / a.gp,
      reb: a.total.reb / a.gp,
      ast: a.total.ast / a.gp,
      stl: a.total.stl / a.gp,
      blk: a.total.blk / a.gp,
    }))
    .sort((a, b) => {
      if (options?.championPriority && champPlayerIds.size > 0) {
        const aChamp = champPlayerIds.has(a.playerId) ? 1 : 0;
        const bChamp = champPlayerIds.has(b.playerId) ? 1 : 0;
        if (aChamp !== bChamp) return bChamp - aChamp;
      }
      return (
        b.rating - a.rating ||
        b.wins / b.gp - a.wins / a.gp ||
        b.pts - a.pts ||
        a.name.localeCompare(b.name)
      );
    });

  const [winner, ...rest] = candidates;
  return {
    winner,
    runnersUp: rest.slice(0, 2),
    games: finals.length,
  };
}

/**
 * The period to feature: the current one if it has finished games, otherwise the most
 * recent earlier one (flagged `isCurrent: false`, e.g. Saturday morning before tip-off).
 */
export function featuredPeriod(
  periods: Period[],
  currentKey: string,
): { period: Period; isCurrent: boolean } | null {
  const current = periods.find((p) => p.key === currentKey);
  if (current) return { period: current, isCurrent: true };
  const earlier = periods.find((p) => p.key < currentKey);
  return earlier ? { period: earlier, isCurrent: false } : null;
}

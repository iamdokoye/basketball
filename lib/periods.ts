import type { Game } from "./queries";
import { groupByPeriod } from "./mvp";
import { groupBySeason, pickSeason, seasonKey, seasonMode, type SeasonMode } from "./seasons";

// One way to pick "which games" for Rankings and Standings: a week, a month, a season/year, or all time.
// URL: ?view=week|month|year|all&p=<period key>. The older ?season=<key> links still work.

export type PeriodView = "week" | "month" | "year" | "all";
export type PeriodOption = { key: string; label: string };

export type ResolvedPeriod = {
  view: PeriodView;
  /** The period being shown: its key, a label for headings, and its finished games. */
  key: string;
  label: string;
  games: Game[];
  /** What can be picked for this view, newest first (empty for all time). */
  options: PeriodOption[];
  /** True if this period has already finished (an older week, month or season). */
  over: boolean;
  /** Label for the "year" tab: "Year", or "Season" when LEAGUE_SEASON is half or quarter. */
  yearTabLabel: string;
};

const VIEWS: PeriodView[] = ["week", "month", "year", "all"];

export function resolvePeriod(args: {
  games: Game[];
  timeZone: string;
  weekStartDay: number;
  now: number;
  view?: string;
  p?: string;
  /** Legacy `?season=` value. */
  season?: string;
  mode?: SeasonMode;
}): ResolvedPeriod {
  const mode = args.mode ?? seasonMode();
  const final = args.games.filter((g) => g.status === "final");
  const yearTabLabel = mode === "year" ? "Year" : "Season";

  let view: PeriodView = VIEWS.includes(args.view as PeriodView) ? (args.view as PeriodView) : "year";
  let p = args.p;
  if (!args.view && args.season) {
    // An old link: ?season=all or ?season=2026
    view = args.season === "all" ? "all" : "year";
    p = args.season;
  }

  if (view === "all") {
    return { view, key: "all", label: "All time", games: final, options: [], over: false, yearTabLabel };
  }

  if (view === "year") {
    const seasons = groupBySeason(args.games, args.timeZone, mode);
    const current = seasonKey(args.now, args.timeZone, mode);
    const picked = pickSeason(seasons, args.games, p, current);
    if (picked.key === "all") {
      return { view: "all", key: "all", label: "All time", games: final, options: [], over: false, yearTabLabel };
    }
    return {
      view,
      key: picked.key,
      label: mode === "year" ? picked.label : `${picked.label} season`,
      games: picked.games,
      options: seasons.map((s) => ({ key: s.key, label: s.label })),
      over: picked.key < current,
      yearTabLabel,
    };
  }

  const periods = groupByPeriod(args.games, view, args.timeZone, args.weekStartDay);
  const picked = periods.find((x) => x.key === p) ?? periods[0];
  return {
    view,
    key: picked?.key ?? "",
    label: picked?.label ?? (view === "week" ? "This week" : "This month"),
    games: picked?.games ?? [],
    options: periods.map((x) => ({ key: x.key, label: x.label })),
    // the newest period with games is the live one
    over: picked ? picked.key !== periods[0].key : false,
    yearTabLabel,
  };
}

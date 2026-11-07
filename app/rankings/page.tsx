import { Fragment } from "react";
import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { resolvePeriod } from "@/lib/periods";
import { PeriodPicker } from "@/app/components/PeriodPicker";
import { LeagueTabs } from "@/app/components/LeagueTabs";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { fmtAvg, fmtPct, fmtSigned } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import { RankBadge } from "@/app/components/RankBadge";
import { FormatFilter } from "@/app/components/FormatFilter";
import { countByFormat, filterGamesByFormat, type GameFormat } from "@/lib/gameFormat";
import { SortPills } from "./SortPills";

export const dynamic = "force-dynamic";

const AVERAGE_COLUMNS: {
  key: SortKey | null;
  label: string;
  cell: (c: Ranked) => string;
}[] = [
  { key: "rating", label: "RTG", cell: (c) => c.rating.toFixed(1) },
  { key: null, label: "GP", cell: (c) => String(c.gp) },
  { key: "win", label: "W-L", cell: (c) => `${c.wins}-${c.losses}` },
  { key: "ppg", label: "PPG", cell: (c) => fmtAvg(c.pts, c.gp) },
  { key: "rpg", label: "RPG", cell: (c) => fmtAvg(c.reb, c.gp) },
  { key: "apg", label: "APG", cell: (c) => fmtAvg(c.ast, c.gp) },
  { key: "spg", label: "SPG", cell: (c) => fmtAvg(c.stl, c.gp) },
  { key: "bpg", label: "BPG", cell: (c) => fmtAvg(c.blk, c.gp) },
  { key: "fg", label: "FG%", cell: (c) => fmtPct(c.fgm, c.fga) },
  { key: null, label: "FT%", cell: (c) => fmtPct(c.ftm, c.fta) },
  { key: "pm", label: "+/-", cell: (c) => fmtSigned(c.plusMinus / c.gp, 1) },
];

const TOTAL_COLUMNS: {
  key: SortKey | null;
  label: string;
  cell: (c: Ranked) => string;
}[] = [
  { key: "rating", label: "RTG", cell: (c) => c.rating.toFixed(1) },
  { key: null, label: "GP", cell: (c) => String(c.gp) },
  { key: "win", label: "W-L", cell: (c) => `${c.wins}-${c.losses}` },
  { key: "pts", label: "PTS", cell: (c) => String(c.pts) },
  { key: "reb", label: "REB", cell: (c) => String(c.reb) },
  { key: "ast", label: "AST", cell: (c) => String(c.ast) },
  { key: "stl", label: "STL", cell: (c) => String(c.stl) },
  { key: "blk", label: "BLK", cell: (c) => String(c.blk) },
  { key: "fg3m", label: "3PM", cell: (c) => `${c.fg3m}/${c.fg3a}` },
  { key: null, label: "FGM", cell: (c) => `${c.fgm}/${c.fga}` },
  { key: "totalPm", label: "+/-", cell: (c) => fmtSigned(c.plusMinus) },
];

const TOTALS_SORT_KEYS: SortKey[] = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "totalPm",
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    season?: string;
    view?: string;
    p?: string;
    statMode?: string;
    format?: string;
  }>;
}) {
  const {
    sort,
    season,
    view: requestedView,
    p,
    statMode,
    format: requestedFormat,
  } = await searchParams;
  const sortKey: SortKey = sort && sort in SORTS ? (sort as SortKey) : "rating";
  const isTotalsSort = TOTALS_SORT_KEYS.includes(sortKey);
  const isTotalsMode = statMode === "totals" || isTotalsSort;
  const activeColumns = isTotalsMode ? TOTAL_COLUMNS : AVERAGE_COLUMNS;
  const activeFormat: GameFormat =
    requestedFormat === "target" || requestedFormat === "timed"
      ? requestedFormat
      : "all";

  const [games, players, access] = await Promise.all([
    listGames(),
    listPlayers(),
    getAccess(),
  ]);
  const tz = leagueTimeZone();
  const period = resolvePeriod({
    games,
    timeZone: tz,
    weekStartDay: leagueGameDay(),
    now: access.now,
    view: requestedView,
    p,
    season,
  });

  const periodFinalGames = period.games.filter((g) => g.status === "final");
  const formatCounts = countByFormat(periodFinalGames);
  const hasMultiple = formatCounts.target > 0 && formatCounts.timed > 0;

  // Filter games based on selected game format
  const formatGames = filterGamesByFormat(period.games, activeFormat);
  const formatFinalGames = formatGames.filter((g) => g.status === "final");

  const periodParams: Record<string, string> = {
    view: period.view,
    ...(period.key && period.view !== "all" ? { p: period.key } : {}),
    ...(activeFormat !== "all" ? { format: activeFormat } : {}),
  };

  const { rows, qualifyAt, totalGames } = rankPlayers(
    careerTotals(formatGames, players),
    sortKey,
    formatFinalGames.length,
  );
  const hasProvisional = rows.some((r) => r.rank === null);

  const formatSubtitle =
    activeFormat === "target"
      ? " · First to 20"
      : activeFormat === "timed"
        ? " · Timed games"
        : "";

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Rankings
        </h1>
        <p className="text-sm text-muted">
          {period.label}
          {period.view === "week" || period.view === "month"
            ? ` · ${formatFinalGames.length} ${formatFinalGames.length === 1 ? "game" : "games"}`
            : ""}
          {formatSubtitle}, sorted by {SORTS[sortKey].label}. Tap the selected stat to see what it means.
        </p>
      </div>

      <LeagueTabs
        active="rankings"
        keep={{
          ...periodParams,
          ...(isTotalsMode ? { statMode: "totals" } : {}),
        }}
      />

      <PeriodPicker
        basePath="/rankings"
        period={period}
        extra={{
          ...(sortKey === "rating" ? {} : { sort: sortKey }),
          ...(isTotalsMode ? { statMode: "totals" } : {}),
          ...(activeFormat !== "all" ? { format: activeFormat } : {}),
        }}
      />

      {/* Game Mode / Format Filter */}
      <FormatFilter
        basePath="/rankings"
        active={activeFormat}
        counts={formatCounts}
        keep={{
          view: period.view,
          ...(period.key && period.view !== "all" ? { p: period.key } : {}),
          ...(sortKey === "rating" ? {} : { sort: sortKey }),
          ...(isTotalsMode ? { statMode: "totals" } : {}),
        }}
      />

      {activeFormat === "all" && hasMultiple && (
        <p className="px-1 text-xs text-muted">
          💡 Scoring pace differs between pickup and 4-quarter regulation. Rating is normalized, but you can select <span className="font-semibold text-ink">First to 20</span> or <span className="font-semibold text-ink">Timed</span> above to see isolated per-game scoring averages.
        </p>
      )}

      {/* Stat Mode Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="label text-xs">Stat Display Mode</div>
        <div className="flex rounded-full bg-black/[0.06] p-1 text-xs font-bold">
          <Link
            href={`/rankings?${new URLSearchParams({
              ...periodParams,
              ...(!isTotalsSort && sortKey !== "rating" ? { sort: sortKey } : {}),
            }).toString()}`}
            className={`rounded-full px-3 py-1 transition ${
              !isTotalsMode
                ? "bg-ink text-paper shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            Per Game (Avg)
          </Link>
          <Link
            href={`/rankings?${new URLSearchParams({
              ...periodParams,
              sort: isTotalsSort ? sortKey : "pts",
              statMode: "totals",
            }).toString()}`}
            className={`rounded-full px-3 py-1 transition ${
              isTotalsMode
                ? "bg-court-ink text-white shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            Totals (Each Field)
          </Link>
        </div>
      </div>

      <SortPills
        key={`${sortKey}-${isTotalsMode}`}
        active={sortKey}
        keep={{
          ...periodParams,
          ...(isTotalsMode ? { statMode: "totals" } : {}),
        }}
        items={(
          isTotalsMode
            ? (["pts", "reb", "ast", "stl", "blk", "fg3m", "totalPm", "win", "rating"] as SortKey[])
            : (["rating", "ppg", "rpg", "apg", "spg", "bpg", "fg", "win", "pm"] as SortKey[])
        ).map((k) => ({
          key: k,
          label: SORTS[k].label,
        }))}
      />

      {rows.length === 0 ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          {activeFormat === "timed"
            ? "No timed games finished in this period."
            : activeFormat === "target"
              ? "No First to 20 games finished in this period."
              : "Finish a game and the rankings show up here."}
        </p>
      ) : (
        <div className="glass-2 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="tabular w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="label text-muted">
                  <th className="sticky-cell px-3 py-3 text-left font-semibold">
                    # Player
                  </th>
                  {activeColumns.map((c) => (
                    <th
                      key={c.label}
                      className={`px-2.5 py-3 text-right font-semibold ${c.key === sortKey ? "text-court-ink" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((r, i) => {
                  const isFirstUnranked =
                    r.rank === null && (i === 0 || rows[i - 1].rank !== null);
                  return (
                    <Fragment key={r.playerId}>
                      {isFirstUnranked && (
                        <tr className="bg-black/[0.02]">
                          <td
                            colSpan={activeColumns.length + 1}
                            className="px-3 py-2 text-xs font-semibold text-muted"
                          >
                            Under qualification threshold (needs {qualifyAt}{" "}
                            {qualifyAt === 1 ? "game" : "games"} in this period)
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-black/[0.02]">
                        <td className="sticky-cell px-3 py-2.5">
                          <Link
                            href={`/players/${r.playerId}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <RankBadge rank={r.rank} />
                            <Avatar name={r.name} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate font-semibold">
                                <span>{r.name}</span>
                                {r.injured && <InjuredBadge size="sm" />}
                              </div>
                            </div>
                          </Link>
                        </td>
                        {activeColumns.map((c) => (
                          <td
                            key={c.label}
                            className={`px-2.5 py-2.5 text-right ${
                              c.key === sortKey
                                ? "font-bold text-court-ink"
                                : ""
                            }`}
                          >
                            {c.cell(r)}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasProvisional && (
        <p className="px-1 text-xs text-muted">
          Players must appear in at least 40% of games in the period ({qualifyAt} of {totalGames}) to receive an official rank. Injured players retain their per-game averages until they return.
        </p>
      )}
    </div>
  );
}

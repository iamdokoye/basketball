import { Fragment } from "react";
import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueTimeZone } from "@/lib/format";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { groupBySeason, pickSeason, seasonKey, seasonMode } from "@/lib/seasons";
import { SeasonPills } from "@/app/components/SeasonPills";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { fmtAvg, fmtPct, fmtSigned } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import { RankBadge } from "@/app/components/RankBadge";
import { SortPills } from "./SortPills";

export const dynamic = "force-dynamic";

const COLUMNS: {
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

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; season?: string }>;
}) {
  const { sort, season: requested } = await searchParams;
  const sortKey: SortKey = sort && sort in SORTS ? (sort as SortKey) : "rating";

  const [games, players, access] = await Promise.all([
    listGames(),
    listPlayers(),
    getAccess(),
  ]);
  const tz = leagueTimeZone();
  const mode = seasonMode();
  const seasons = groupBySeason(games, tz, mode);
  const view = pickSeason(seasons, games, requested, seasonKey(access.now, tz, mode));
  const finalGames = view.games.filter((g) => g.status === "final");
  const { rows, qualifyAt, totalGames } = rankPlayers(
    careerTotals(view.games, players),
    sortKey,
    finalGames.length,
  );
  const hasProvisional = rows.some((r) => r.rank === null);

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Rankings
        </h1>
        <p className="text-sm text-muted">
          {view.key === "all" ? "All time" : `${view.label} season`}, sorted by{" "}
          {SORTS[sortKey].label}. Tap the selected stat to see what it means.{" "}
          <Link href="/standings" className="font-semibold text-court-ink hover:underline">
            Standings
          </Link>
        </p>
      </div>

      <SeasonPills
        basePath="/rankings"
        seasons={seasons}
        active={view.key}
        extra={sortKey === "rating" ? {} : { sort: sortKey }}
      />

      <SortPills
        key={sortKey}
        active={sortKey}
        season={view.key}
        items={(Object.keys(SORTS) as SortKey[]).map((k) => ({
          key: k,
          label: SORTS[k].label,
        }))}
      />

      {rows.length === 0 ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          Finish a game and the rankings show up here.
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
                  {COLUMNS.map((c) => (
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
                        <tr className="bg-black/[0.03]">
                          <td
                            colSpan={COLUMNS.length + 1}
                            className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted"
                          >
                            Inactive / Under 70% Threshold ({qualifyAt} GP needed · averages frozen)
                          </td>
                        </tr>
                      )}
                      <tr
                        className={r.rank === null ? "opacity-60" : ""}
                      >
                        <td className="sticky-cell px-3 py-2.5">
                          <Link
                            href={`/players/${r.playerId}`}
                            className="flex items-center gap-2.5"
                          >
                            <RankBadge rank={r.rank} />
                            <Avatar id={r.playerId} name={r.name} size="sm" />
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{r.name}</span>
                              {r.injured && <InjuredBadge size="sm" />}
                            </div>
                          </Link>
                        </td>
                        {COLUMNS.map((c) => {
                          const v = c.cell(r);
                          const signed = c.label === "+/-";
                          return (
                            <td
                              key={c.label}
                              className={`px-2.5 py-2.5 text-right ${
                                c.key === sortKey
                                  ? "bg-court-soft/10 font-extrabold"
                                  : ""
                              } ${c.key === "rating" ? "font-bold" : ""} ${
                                signed
                                  ? v.startsWith("+")
                                    ? "text-win"
                                    : v.startsWith("-")
                                      ? "text-loss"
                                      : ""
                                  : ""
                              }`}
                            >
                              {v}
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasProvisional && (
            <div className="hairline border-t px-3 py-2.5 text-xs text-muted space-y-0.5">
              <p>
                Official leaderboard requires playing in at least 70% of games ({qualifyAt} of {totalGames} {totalGames === 1 ? "game" : "games"}).
              </p>
              <p className="text-[11px] opacity-80">
                Inactive and injured players keep their statistical averages frozen until they return.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

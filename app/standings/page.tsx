import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { listGames, listPlayers } from "@/lib/queries";
import { resolvePeriod } from "@/lib/periods";
import { standings, type StandingRow } from "@/lib/standings";
import { fmtSigned } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import { RankBadge } from "@/app/components/RankBadge";
import { PeriodPicker } from "@/app/components/PeriodPicker";
import { LeagueTabs } from "@/app/components/LeagueTabs";
import { FormatFilter } from "@/app/components/FormatFilter";
import { countByFormat, filterGamesByFormat, type GameFormat } from "@/lib/gameFormat";

export const dynamic = "force-dynamic";

function Form({ results }: { results: ("W" | "L")[] }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Last ${results.length}: ${results.join(" ")}`}>
      {results.map((r, i) => (
        <span
          key={i}
          aria-hidden
          className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold ${
            r === "W" ? "bg-win/15 text-win" : "bg-loss/15 text-loss"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string; p?: string; format?: string }>;
}) {
  const { season, view: requestedView, p, format: requestedFormat } = await searchParams;
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
  const formatGames = filterGamesByFormat(period.games, activeFormat);
  const formatFinalGames = formatGames.filter((g) => g.status === "final");

  const periodParams: Record<string, string> = {
    view: period.view,
    ...(period.key && period.view !== "all" ? { p: period.key } : {}),
    ...(activeFormat !== "all" ? { format: activeFormat } : {}),
  };

  const { rows, qualifyAt } = standings(formatGames, players);
  const over = period.over;
  const leader: StandingRow | undefined = rows.find((r) => r.rank === 1);
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
          Standings
        </h1>
        <p className="text-sm text-muted">
          {period.label} · {formatFinalGames.length} {formatFinalGames.length === 1 ? "game" : "games"}
          {formatSubtitle}. Ranked by win rate, then wins, then rating.
        </p>
      </div>

      <LeagueTabs active="standings" keep={periodParams} />

      <PeriodPicker
        basePath="/standings"
        period={period}
        extra={activeFormat !== "all" ? { format: activeFormat } : {}}
      />

      <FormatFilter
        basePath="/standings"
        active={activeFormat}
        counts={formatCounts}
        keep={{
          view: period.view,
          ...(period.key && period.view !== "all" ? { p: period.key } : {}),
        }}
      />

      {leader && (
        <Link
          href={`/players/${leader.playerId}`}
          className="glass-2 flex items-center gap-3 rounded-3xl p-4 active:scale-[0.99]"
        >
          <Avatar name={leader.name} tone="ink" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="label text-court-ink">
              {period.view === "all"
                ? "Best record ever"
                : over
                  ? period.view === "year" ? "🏆 Season champion" : "🏆 Winner"
                  : period.view === "year" ? "Leading the season" : "Leading"}
            </div>
            <div className="truncate text-xl font-extrabold leading-6 tracking-tight">
              {leader.name}
            </div>
            <div className="tabular text-xs font-semibold text-muted">
              {leader.wins}-{leader.losses} · {Math.round(leader.pct * 100)}% ·{" "}
              {leader.rating.toFixed(1)} rating
            </div>
          </div>
        </Link>
      )}

      {rows.length === 0 ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          {activeFormat === "timed"
            ? "No timed games finished in this period."
            : activeFormat === "target"
              ? "No First to 20 games finished in this period."
              : "Finish a game and the standings show up here."}
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
                  <th className="px-2.5 py-3 text-right font-semibold">W-L</th>
                  <th className="px-2.5 py-3 text-right font-semibold">Win%</th>
                  <th className="px-2.5 py-3 text-right font-semibold">GP</th>
                  <th className="px-2.5 py-3 text-right font-semibold">Rating</th>
                  <th className="px-2.5 py-3 text-right font-semibold">+/-</th>
                  <th className="px-2.5 py-3 text-right font-semibold">Form</th>
                  <th className="px-2.5 py-3 text-right font-semibold">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((r, i) => {
                  const isFirstUnranked =
                    r.rank === null && (i === 0 || rows[i - 1].rank !== null);
                  return (
                    <tr
                      key={r.playerId}
                      className={`hover:bg-black/[0.02] ${
                        isFirstUnranked ? "border-t-2 border-dashed border-black/15" : ""
                      }`}
                    >
                      <td className="sticky-cell px-3 py-2.5">
                        <Link
                          href={`/players/${r.playerId}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <RankBadge rank={r.rank} />
                          <Avatar name={r.name} size="sm" />
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold">{r.name}</span>
                            {r.injured && <InjuredBadge size="sm" />}
                          </div>
                        </Link>
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-extrabold">
                        {r.wins}-{r.losses}
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        {Math.round(r.pct * 100)}%
                      </td>
                      <td className="px-2.5 py-2.5 text-right">{r.gp}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold">
                        {r.rating.toFixed(1)}
                      </td>
                      <td
                        className={`px-2.5 py-2.5 text-right ${
                          r.pm > 0 ? "text-win" : r.pm < 0 ? "text-loss" : ""
                        }`}
                      >
                        {fmtSigned(r.pm, 1)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        <Form results={r.form} />
                      </td>
                      <td
                        className={`px-2.5 py-2.5 text-right font-bold ${
                          r.streak?.kind === "W" ? "text-win" : "text-loss"
                        }`}
                      >
                        {r.streak ? `${r.streak.kind}${r.streak.n}` : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasProvisional && (
        <p className="px-1 text-xs text-muted">
          Players below the dashed line haven&apos;t played in {qualifyAt}{" "}
          games (40% of the period) and carry a provisional rank.
        </p>
      )}
    </div>
  );
}

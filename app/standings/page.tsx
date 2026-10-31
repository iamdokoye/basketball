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
  searchParams: Promise<{ season?: string; view?: string; p?: string }>;
}) {
  const { season, view: requestedView, p } = await searchParams;
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
  const periodParams: Record<string, string> = { view: period.view, ...(period.key && period.view !== "all" ? { p: period.key } : {}) };
  const { rows, qualifyAt } = standings(period.games, players);
  const over = period.over;
  const leader: StandingRow | undefined = rows.find((r) => r.rank === 1);
  const hasProvisional = rows.some((r) => r.rank === null);

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Standings
        </h1>
        <p className="text-sm text-muted">
          {period.label} · {period.games.length} {period.games.length === 1 ? "game" : "games"}.
          Ranked by win rate, then wins, then rating.
        </p>
      </div>

      <LeagueTabs active="standings" keep={periodParams} />

      <PeriodPicker basePath="/standings" period={period} />

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
          Finish a game and the standings show up here.
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
                  {["W-L", "WIN%", "GP", "RTG", "+/-", "FORM", "STREAK"].map((h) => (
                    <th key={h} className="px-2.5 py-3 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((r) => (
                  <tr key={r.playerId} className={r.rank === null ? "opacity-45" : ""}>
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
                ))}
              </tbody>
            </table>
          </div>
          {hasProvisional && (
            <p className="hairline border-t px-3 py-2 text-xs text-muted">
              Players need at least 40% of games ({qualifyAt} {qualifyAt === 1 ? "game" : "games"}) in a season to be ranked. Inactive averages remain frozen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

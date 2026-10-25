import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import {
  computeMvp,
  groupByPeriod,
  monthKey,
  monthLabel,
  quarterKey,
  weekKey,
  yearKey,
  type Period,
} from "@/lib/mvp";
import { listGames, listPlayers, listVotedAwards } from "@/lib/queries";
import { Avatar } from "@/app/components/Avatar";
import { AwardsCard } from "@/app/components/AwardsCard";
import { MajorAwardsCard } from "@/app/components/MajorAwardsCard";
import { AdminDisclaimerBanner } from "@/app/components/AdminDisclaimer";
import { computeMajorAwards, monthAwards } from "@/lib/awards";

export const dynamic = "force-dynamic";

function Rows({
  periods,
  currentKey,
  noun,
}: {
  periods: Period[];
  currentKey: string;
  noun: string;
}) {
  if (periods.length === 0) {
    return (
      <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
        No finished games yet. The first {noun} MVP shows up here.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {periods.map((p) => {
        const r = computeMvp(p.games);
        if (!r) return null;
        const w = r.winner;
        return (
          <li key={p.key}>
            <Link
              href={`/players/${w.playerId}`}
              className="glass-1 flex items-center gap-3 rounded-2xl p-3.5"
            >
              <Avatar name={w.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{w.name}</div>
                <div className="tabular text-xs font-semibold text-muted">
                  {p.label} · {r.games} {r.games === 1 ? "game" : "games"}
                  {p.key === currentKey && (
                    <span className="ml-1.5 rounded-full bg-court-soft/15 px-1.5 py-0.5 text-court-ink">
                      now
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-xl font-extrabold leading-6 text-court-ink">
                  {w.rating.toFixed(1)}
                  <span className="text-xs font-bold text-muted">/10</span>
                </div>
                <div className="label text-[10px] text-muted">rating</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function MvpHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; admin_preview?: string }>;
}) {
  const [{ tab, admin_preview }, games, players, access, votedAwards] = await Promise.all([
    searchParams,
    listGames(),
    listPlayers(),
    getAccess(),
    listVotedAwards(),
  ]);

  const tz = leagueTimeZone();
  const day = leagueGameDay();

  const years = groupByPeriod(games, "year", tz, day);
  const quarters = groupByPeriod(games, "quarter", tz, day);
  const months = groupByPeriod(games, "month", tz, day);
  const weeks = groupByPeriod(games, "week", tz, day);

  const thisYear = yearKey(access.now, tz);
  const thisQuarter = quarterKey(access.now, tz);
  const thisMonth = monthKey(access.now, tz);

  const playerNames = new Map(players.map((p) => [p.id, p.name]));

  const tabs = [
    { id: "yearly", label: "Yearly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "monthly", label: "Monthly" },
    { id: "weekly", label: "Weekly" },
    { id: "all", label: "All" },
  ];

  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : "yearly";

  return (
    <div className="space-y-6">
      <div className="space-y-1 px-1">
        <Link
          href="/"
          className="text-sm font-semibold text-muted hover:underline"
        >
          ← Home
        </Link>
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          MVPs & awards
        </h1>
        <p className="text-sm text-muted">
          Tournament honors, team awards, quarterly and yearly honors, and
          weekly MVPs across finished games.
        </p>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <Link
              key={t.id}
              href={`/mvp?tab=${t.id}`}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                active
                  ? "bg-ink text-paper shadow-sm"
                  : "bg-black/[0.05] text-muted hover:bg-black/[0.08] hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Yearly View */}
      {(activeTab === "yearly" || activeTab === "all") && (
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="label text-ink">Yearly awards</h2>
            <span className="text-xs font-semibold text-muted">
              Team of Year, All-Star Three, MVP & honors
            </span>
          </div>

          {years.length === 0 ? (
            <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
              The first yearly awards appear when the year&apos;s finished games
              are played.
            </p>
          ) : (
            years.map((y) => (
              <MajorAwardsCard
                key={y.key}
                periodLabel={y.label}
                periodKind="year"
                isCurrent={y.key === thisYear}
                awards={computeMajorAwards(
                  y.games,
                  games,
                  "year",
                  tz,
                  votedAwards,
                  playerNames,
                )}
              />
            ))
          )}

          <div className="space-y-2.5">
            <h3 className="label px-1">MVP by year</h3>
            <Rows periods={years} currentKey={thisYear} noun="yearly" />
          </div>
        </section>
      )}

      {/* Quarterly View */}
      {(activeTab === "quarterly" || activeTab === "all") && (
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="label text-ink">Quarterly awards</h2>
            <span className="text-xs font-semibold text-muted">
              All-Star Three, Best Trio & tournament honors
            </span>
          </div>

          {quarters.length === 0 ? (
            <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
              The first quarterly awards appear when a quarter has finished
              games.
            </p>
          ) : (
            quarters.map((q) => (
              <MajorAwardsCard
                key={q.key}
                periodLabel={q.label}
                periodKind="quarter"
                isCurrent={q.key === thisQuarter}
                awards={computeMajorAwards(
                  q.games,
                  games,
                  "quarter",
                  tz,
                  votedAwards,
                  playerNames,
                )}
              />
            ))
          )}

          <div className="space-y-2.5">
            <h3 className="label px-1">MVP by quarter</h3>
            <Rows periods={quarters} currentKey={thisQuarter} noun="quarterly" />
          </div>
        </section>
      )}

      {/* Monthly View */}
      {(activeTab === "monthly" || activeTab === "all") && (
        <section className="space-y-5">
          <div className="space-y-3">
            <h2 className="label px-1">Month awards</h2>
            {months.some((m) => m.key === thisMonth) && (
              <div className="space-y-2">
                <p className="glass-1 rounded-2xl p-4 text-sm text-muted">
                  {monthLabel(thisMonth)} awards are revealed when the month ends.
                </p>
                {access.isAdmin && (
                  <AdminDisclaimerBanner
                    isUnlocked={admin_preview === "1"}
                    unlockHref={`/mvp?tab=${activeTab}&admin_preview=1`}
                    lockHref={`/mvp?tab=${activeTab}`}
                    periodName={monthLabel(thisMonth)}
                    reason="Current month awards are locked for regular players until the month ends."
                  />
                )}
              </div>
            )}
            {access.isAdmin &&
              admin_preview === "1" &&
              months.find((m) => m.key === thisMonth) && (
                <AwardsCard
                  monthLabel={`${monthLabel(thisMonth)} (Admin Preview)`}
                  awards={monthAwards(
                    months.find((m) => m.key === thisMonth)!.games,
                  )}
                />
              )}
            {months.filter((m) => m.key < thisMonth).length === 0 &&
            !(access.isAdmin && admin_preview === "1") ? (
              <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
                The first awards card appears at the end of the first month with
                finished games.
              </p>
            ) : (
              months
                .filter((m) => m.key < thisMonth)
                .map((m) => (
                  <AwardsCard
                    key={m.key}
                    monthLabel={m.label}
                    awards={monthAwards(m.games)}
                  />
                ))
            )}
          </div>

          <div className="space-y-2.5">
            <h3 className="label px-1">MVP by month</h3>
            <Rows
              periods={months}
              currentKey={thisMonth}
              noun="monthly"
            />
          </div>
        </section>
      )}

      {/* Weekly View */}
      {(activeTab === "weekly" || activeTab === "all") && (
        <section className="space-y-2.5">
          <h2 className="label px-1">MVP by week</h2>
          <Rows
            periods={weeks}
            currentKey={weekKey(access.now, tz, day)}
            noun="weekly"
          />
        </section>
      )}
    </div>
  );
}

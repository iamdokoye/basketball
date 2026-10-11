import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import {
  computeMvp,
  groupByPeriod,
  monthKey,
  weekKey,
  type Period,
} from "@/lib/mvp";
import { listGames } from "@/lib/queries";
import { Avatar } from "@/app/components/Avatar";
import { AwardsCard } from "@/app/components/AwardsCard";
import { monthAwards } from "@/lib/awards";
import { monthLabel } from "@/lib/mvp";

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

export default async function MvpHistoryPage() {
  const [games, access] = await Promise.all([listGames(), getAccess()]);
  const tz = leagueTimeZone();
  const day = leagueGameDay();
  const weeks = groupByPeriod(games, "week", tz, day);
  const months = groupByPeriod(games, "month", tz, day);
  const thisMonth = monthKey(access.now, tz);

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
          The best average rating across each week&apos;s or month&apos;s
          finished games. A week runs Saturday to Friday.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="label px-1">Month awards</h2>
        {months.some((m) => m.key === thisMonth) && (
          <p className="glass-1 rounded-2xl p-4 text-sm text-muted">
            {monthLabel(thisMonth)} awards are revealed when the month ends.
          </p>
        )}
        {months.filter((m) => m.key < thisMonth).length === 0 ? (
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
      </section>

      <section className="space-y-2.5">
        <h2 className="label px-1">MVP by month</h2>
        <Rows
          periods={months}
          currentKey={monthKey(access.now, tz)}
          noun="monthly"
        />
      </section>

      <section className="space-y-2.5">
        <h2 className="label px-1">MVP by week</h2>
        <Rows
          periods={weeks}
          currentKey={weekKey(access.now, tz, day)}
          noun="weekly"
        />
      </section>
    </div>
  );
}

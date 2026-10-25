import { getAccess } from "@/lib/access";
import { adminLogout } from "@/lib/actions";
import { Countdown } from "@/app/components/Countdown";
import { LoginForm } from "./LoginForm";
import { AwardVoteForm } from "./AwardVoteForm";
import { listGames, listPlayers, listVotedAwards } from "@/lib/queries";
import { groupByPeriod, quarterKey, yearKey } from "@/lib/mvp";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [a, players, games, votedAwards] = await Promise.all([
    getAccess(),
    listPlayers(),
    listGames(),
    listVotedAwards(),
  ]);

  const tz = leagueTimeZone();
  const day = leagueGameDay();
  const years = groupByPeriod(games, "year", tz, day);
  const quarters = groupByPeriod(games, "quarter", tz, day);
  const thisYear = yearKey(a.now, tz);
  const thisQuarter = quarterKey(a.now, tz);

  const periodList = [
    ...years.map((y) => ({ key: y.key, label: `Year ${y.label}` })),
    ...quarters.map((q) => ({ key: q.key, label: `Quarter ${q.label}` })),
  ];
  if (!periodList.some((p) => p.key === thisYear)) {
    periodList.unshift({ key: thisYear, label: `Year ${thisYear}` });
  }
  if (!periodList.some((p) => p.key === thisQuarter)) {
    periodList.unshift({ key: thisQuarter, label: `Quarter ${thisQuarter}` });
  }

  return (
    <div className="space-y-5">
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">Admin</h1>

      <div className="glass-1 space-y-2 rounded-2xl p-4">
        <div className="label text-muted">Who can edit</div>
        <p className="text-sm">
          <b>Everyone</b> can view stats at any time. During <b>{a.windowLabel}</b> anyone can score games and add
          players. Everything else needs the admin password.
        </p>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${a.windowOpen ? "animate-pulse bg-win" : "bg-stone-400"}`} />
          {a.windowOpen ? (
            <span>
              Scoring is open, closes in{" "}
              {a.closesAt ? <Countdown target={a.closesAt} serverNow={a.now} /> : `at ${a.windowEnds}`}
            </span>
          ) : (
            <span>
              Scoring is closed, opens in{" "}
              {a.opensAt ? <Countdown target={a.opensAt} serverNow={a.now} /> : "the next window"}
            </span>
          )}
        </p>
      </div>

      {a.isAdmin ? (
        <div className="space-y-5">
          <div className="glass-2 space-y-3 rounded-2xl p-4">
            <p className="text-sm font-semibold">You&apos;re signed in as admin on this device.</p>
            <p className="text-sm text-muted">
              You can edit at any time, rename or archive players, reopen finished games, delete games, and award peer honors.
            </p>
            <form action={adminLogout}>
              <button className="h-11 rounded-full bg-ink px-6 text-sm font-semibold text-paper active:scale-95">
                Sign out
              </button>
            </form>
          </div>

          {/* Record peer-voted awards (e.g. Most Spectacular Player) */}
          <AwardVoteForm
            players={players}
            periods={periodList}
            votedAwards={votedAwards}
          />
        </div>
      ) : a.adminConfigured ? (
        <LoginForm />
      ) : (
        <p className="rounded-2xl bg-loss/10 p-4 text-sm font-semibold text-loss">
          Admin sign-in isn&apos;t set up yet. Add ADMIN_PASSWORD to the server environment.
        </p>
      )}
    </div>
  );
}

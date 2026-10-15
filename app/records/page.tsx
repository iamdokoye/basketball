import Link from "next/link";
import { leagueGameDay, leagueTimeZone, formatGameDay } from "@/lib/format";
import { clutchTotals } from "@/lib/clutch";
import { listGames } from "@/lib/queries";
import {
  bestMonthEver,
  singleGameRecords,
  teamRecords,
  winStreaks,
  type RecordItem,
} from "@/lib/records";
import { Avatar } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

function RecordRow({ r, tz }: { r: RecordItem; tz: string }) {
  const meta = [
    r.player?.name,
    r.detail,
    r.when ? formatGameDay(r.when, tz) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      {r.player ? (
        <Avatar name={r.player.name} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[0.06] text-sm">
          🏀
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="label text-[10px] text-muted">{r.label}</div>
        <div className="truncate text-sm font-semibold">{meta}</div>
      </div>
      <div className="tabular text-right text-xl font-extrabold leading-6 tracking-tight text-court-ink">
        {r.value}
      </div>
    </>
  );
  const cls = "glass-1 flex items-center gap-3 rounded-2xl p-3";
  const href = r.gameId
    ? `/games/${r.gameId}`
    : r.player
      ? `/players/${r.player.id}`
      : null;
  return href ? (
    <Link href={href} className={`${cls} active:scale-[0.99]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="label px-1">{title}</h2>
      {children}
    </section>
  );
}

export default async function RecordsPage() {
  const games = await listGames();
  const tz = leagueTimeZone();
  const single = singleGameRecords(games);
  const team = teamRecords(games);
  const month = bestMonthEver(games, tz, leagueGameDay());
  const streaks = winStreaks(games);
  const clutch = clutchTotals(games);
  const topWinners = clutch
    .filter((c) => c.gameWinners > 0)
    .sort((a, b) => b.gameWinners - a.gameWinners || b.clutchPts - a.clutchPts)
    .slice(0, 5);
  const topClutch = clutch
    .filter((c) => c.clutchPts > 0)
    .sort((a, b) => b.clutchPts - a.clutchPts || b.gameWinners - a.gameWinners)
    .slice(0, 5);
  const longest = streaks
    .filter((s) => s.longest >= 2)
    .sort((a, b) => b.longest - a.longest || b.current - a.current)
    .slice(0, 5);
  const active = streaks
    .filter((s) => s.current >= 2)
    .sort((a, b) => b.current - a.current)
    .slice(0, 5);

  if (single.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">
          Records
        </h1>
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          Records show up after the first finished game.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Records
        </h1>
        <p className="text-sm text-muted">
          The best single-game performances and longest streaks so far.
        </p>
      </div>

      <Section title="Single-game records">
        <div className="space-y-2">
          {single.map((r) => (
            <RecordRow key={r.id} r={r} tz={tz} />
          ))}
        </div>
      </Section>

      {team.length > 0 && (
        <Section title="Team records">
          <div className="space-y-2">
            {team.map((r) => (
              <RecordRow key={r.id} r={r} tz={tz} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Win streaks">
        {longest.length === 0 ? (
          <p className="glass-1 rounded-2xl p-5 text-center text-sm text-muted">
            No one has won two games in a row yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-1 space-y-2 rounded-2xl p-3.5">
              <div className="label text-[10px] text-muted">Longest ever</div>
              {longest.map((s) => (
                <Link
                  key={s.playerId}
                  href={`/players/${s.playerId}`}
                  className="flex items-center justify-between gap-2 text-sm font-semibold"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="tabular font-extrabold text-court-ink">
                    {s.longest} wins
                  </span>
                </Link>
              ))}
            </div>
            <div className="glass-1 space-y-2 rounded-2xl p-3.5">
              <div className="label text-[10px] text-muted">
                Active right now
              </div>
              {active.length === 0 ? (
                <p className="text-sm text-muted">
                  No active streaks of 2 or more.
                </p>
              ) : (
                active.map((s) => (
                  <Link
                    key={s.playerId}
                    href={`/players/${s.playerId}`}
                    className="flex items-center justify-between gap-2 text-sm font-semibold"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="tabular font-extrabold text-win">
                      {s.current} wins 🔥
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </Section>

      <section id="clutch" className="scroll-mt-4 space-y-2.5">
        <h2 className="label px-1">Clutch</h2>
        {topWinners.length === 0 && topClutch.length === 0 ? (
          <p className="glass-1 rounded-2xl p-5 text-center text-sm text-muted">
            No game-winners yet. A game-winner is the last basket of a game
            decided by 3 or fewer.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-1 space-y-2 rounded-2xl p-3.5">
              <div className="label text-[10px] text-muted">Game-winners</div>
              {topWinners.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                topWinners.map((c) => (
                  <Link
                    key={c.playerId}
                    href={`/players/${c.playerId}`}
                    className="flex items-center justify-between gap-2 text-sm font-semibold"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="tabular font-extrabold text-court-ink">
                      {c.gameWinners} 🎯
                    </span>
                  </Link>
                ))
              )}
            </div>
            <div className="glass-1 space-y-2 rounded-2xl p-3.5">
              <div className="label text-[10px] text-muted">Clutch points</div>
              {topClutch.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                topClutch.map((c) => (
                  <Link
                    key={c.playerId}
                    href={`/players/${c.playerId}`}
                    className="flex items-center justify-between gap-2 text-sm font-semibold"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="tabular font-extrabold text-court-ink">
                      {c.clutchPts} pts
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
        <p className="px-1 text-xs text-muted">
          Clutch points are scored when a team is within 5 of the target and the
          game is within 3. Games added with Import, or whose scoring was edited
          later, are left out because their order of plays isn&apos;t real.
        </p>
      </section>

      {month && (
        <Section title="Best month ever">
          <RecordRow r={month} tz={tz} />
        </Section>
      )}
    </div>
  );
}

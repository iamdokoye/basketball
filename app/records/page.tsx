import Link from "next/link";
import { leagueGameDay, leagueTimeZone, formatGameDay } from "@/lib/format";
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

      {month && (
        <Section title="Best month ever">
          <RecordRow r={month} tz={tz} />
        </Section>
      )}
    </div>
  );
}

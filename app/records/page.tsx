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
import { ShotHeatmap } from "@/app/components/ShotHeatmap";
import { computeLeagueShotProfile, zoneRecordsFromGames } from "@/lib/shotZones";
import { FormatFilter } from "@/app/components/FormatFilter";
import { countByFormat, type GameFormat } from "@/lib/gameFormat";

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
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <h2 className="label">{title}</h2>
        {badge && (
          <span className="rounded-full bg-court-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-court-ink">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{ format?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedFormat = params.format;
  const activeFormat: GameFormat =
    requestedFormat === "target" || requestedFormat === "timed"
      ? requestedFormat
      : "all";

  const games = await listGames();
  const tz = leagueTimeZone();
  const finalGames = games.filter((g) => g.status === "final");
  const counts = countByFormat(finalGames);
  const hasBothFormats = counts.target > 0 && counts.timed > 0;

  // Single game & team records by format
  const targetSingle = singleGameRecords(games, undefined, "target");
  const timedSingle = singleGameRecords(games, undefined, "timed");
  const targetTeam = teamRecords(games, "target");
  const timedTeam = teamRecords(games, "timed");

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
  const zoneRecords = zoneRecordsFromGames(games);
  const leagueShots = computeLeagueShotProfile(games, zoneRecords);

  if (targetSingle.length === 0 && timedSingle.length === 0) {
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
          The best single-game performances and longest streaks so far, separated by game format to keep scoring benchmarks fair.
        </p>
      </div>

      <FormatFilter
        basePath="/records"
        active={activeFormat}
        counts={counts}
      />

      {/* Target (Pickup First to 20) Single-game Records */}
      {(activeFormat === "all" || activeFormat === "target") && targetSingle.length > 0 && (
        <Section
          title="Single-game records"
          badge={hasBothFormats ? "First to 20" : undefined}
        >
          <div className="space-y-2">
            {targetSingle.map((r) => (
              <RecordRow key={r.id} r={r} tz={tz} />
            ))}
          </div>
        </Section>
      )}

      {/* Timed Regulation Single-game Records */}
      {(activeFormat === "all" || activeFormat === "timed") && timedSingle.length > 0 && (
        <Section
          title="Single-game records"
          badge="Timed Regulation"
        >
          <div className="space-y-2">
            {timedSingle.map((r) => (
              <RecordRow key={r.id} r={r} tz={tz} />
            ))}
          </div>
        </Section>
      )}

      {activeFormat === "timed" && timedSingle.length === 0 && (
        <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
          No timed regulation games finished yet. When played, their 4-quarter records will show here!
        </p>
      )}

      {/* Team records */}
      {(activeFormat === "all" || activeFormat === "target") && targetTeam.length > 0 && (
        <Section
          title="Team records"
          badge={hasBothFormats ? "First to 20" : undefined}
        >
          <div className="space-y-2">
            {targetTeam.map((r) => (
              <RecordRow key={r.id} r={r} tz={tz} />
            ))}
          </div>
        </Section>
      )}

      {(activeFormat === "all" || activeFormat === "timed") && timedTeam.length > 0 && (
        <Section
          title="Team records"
          badge="Timed Regulation"
        >
          <div className="space-y-2">
            {timedTeam.map((r) => (
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

      {leagueShots.taggedFga > 0 && (
        <Section title="Shooting by zone">
          <ShotHeatmap
            profile={leagueShots}
            label="League shooting"
            title="Where the league scores"
            subtitle={`${leagueShots.taggedFga} charted shots, all games`}
          />
        </Section>
      )}

      {month && (
        <Section title="Best month ever">
          <RecordRow r={month} tz={tz} />
        </Section>
      )}
    </div>
  );
}

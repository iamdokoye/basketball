import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import {
  computeMvp,
  featuredPeriod,
  groupByPeriod,
  monthKey,
  weekKey,
} from "@/lib/mvp";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { GameRow, LiveGameCard } from "@/app/components/GameRow";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InstallHint } from "@/app/components/InstallHint";
import { MvpCard } from "@/app/components/MvpCard";
import { AwardsCard } from "@/app/components/AwardsCard";
import { monthAwards } from "@/lib/awards";
import { Countdown } from "@/app/components/Countdown";
import { AwardCard, CardBack } from "@/app/components/AwardCard";
import { buildCards, cardsHour, cardsLock } from "@/lib/cards";

export const dynamic = "force-dynamic";

const LEADER_CATEGORIES: { key: SortKey; label: string; unit: string }[] = [
  { key: "ppg", label: "PPG", unit: "pts" },
  { key: "rpg", label: "RPG", unit: "reb" },
  { key: "apg", label: "APG", unit: "ast" },
  { key: "spg", label: "SPG", unit: "stl" },
  { key: "bpg", label: "BPG", unit: "blk" },
];

function hourLabel(h: number) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${h < 12 ? "AM" : "PM"}`;
}

export default async function Home() {
  const [games, players, access] = await Promise.all([
    listGames(),
    listPlayers(),
    getAccess(),
  ]);
  const live = games.filter((g) => g.status === "live");
  const final = games.filter((g) => g.status === "final");
  const career = careerTotals(games, players);
  const { rows: ranked } = rankPlayers(career);
  const top3 = ranked.filter((r) => r.rank !== null).slice(0, 3);

  // MVP of the week (Sat–Fri, so midweek this is last Saturday's games) and of the month.
  const tz = leagueTimeZone();
  const day = leagueGameDay();
  const mvps = (["week", "month"] as const).map((kind) => {
    const periods = groupByPeriod(games, kind, tz, day);
    const currentKey =
      kind === "week" ? weekKey(access.now, tz, day) : monthKey(access.now, tz);
    const featured = featuredPeriod(periods, currentKey);
    const result = featured ? computeMvp(featured.period.games) : null;
    return featured && result ? { kind, featured, result } : null;
  });

  // Title cards for the latest game week. The current week's stay face-down until 2 PM on a game day.
  const weekPeriods = groupByPeriod(games, "week", tz, day);
  const curWeekKey = weekKey(access.now, tz, day);
  const cardPeriod = weekPeriods.find((p) => p.key === curWeekKey) ?? weekPeriods[0];
  const cardLock = cardsLock(access.now, games, tz);
  const cardsHidden = cardLock.locked && cardPeriod?.key === curWeekKey;
  const weekCards =
    cardPeriod && !cardsHidden ? buildCards(cardPeriod.games, "week", cardPeriod) : [];

  // Awards are handed out when a month is over: show the latest completed month.
  const thisMonth = monthKey(access.now, tz);
  const lastDone = groupByPeriod(games, "month", tz, day).find(
    (p) => p.key < thisMonth,
  );
  const lastAwards = lastDone ? monthAwards(lastDone.games) : [];

  const leaders = LEADER_CATEGORIES.flatMap(({ key, label, unit }) => {
    const best = rankPlayers(career, key).rows[0];
    return best ? [{ label, unit, key, player: best }] : [];
  });

  return (
    <div className="space-y-8">
      {/* Start a game (view-only visitors see when scoring opens instead) */}
      {!access.canPlay && (
        <div className="glass-1 flex items-center justify-between gap-4 rounded-3xl p-5">
          <div className="space-y-1">
            <div className="label text-muted">View only · scoring opens in</div>
            <h1 className="text-[30px] font-extrabold leading-9 tracking-tight">
              {access.opensAt ? (
                <Countdown target={access.opensAt} serverNow={access.now} />
              ) : (
                "Scoring is closed"
              )}
            </h1>
            <p className="text-sm text-muted">
              {access.windowLabel}.{" "}
              <Link
                href="/admin"
                className="font-semibold text-court-ink underline-offset-2 hover:underline"
              >
                Admin sign in
              </Link>
            </p>
          </div>
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-black/[0.06] text-muted">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
        </div>
      )}
      {access.canPlay && (
        <Link
          href="/games/new"
          className="glass-1 group relative block overflow-hidden rounded-3xl p-5 transition-transform active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute inset-0 bg-court-soft/10" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="label text-court-ink">Ready?</div>
              <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
                Start a game
              </h1>
              <p className="text-sm text-muted">
                Pick teams, set the target score, tip off.
                {!access.isAdmin && access.closesAt && (
                  <>
                    {" "}
                    Scoring closes in{" "}
                    <Countdown
                      target={access.closesAt}
                      serverNow={access.now}
                      compact
                    />
                    .
                  </>
                )}
              </p>
            </div>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-md transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </Link>
      )}

      <InstallHint />

      {live.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-court-soft opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-court-soft" />
            </span>
            <h2 className="label">Live on court</h2>
          </div>
          {live.map((g) => (
            <LiveGameCard key={g.id} game={g} />
          ))}
        </section>
      )}

      {/* MVPs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="label">MVPs</h2>
          <Link
            href="/mvp"
            className="text-xs font-semibold text-court-ink hover:underline"
          >
            History
          </Link>
        </div>
        {mvps.every((m) => !m) ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            The weekly and monthly MVPs appear after the first finished game.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mvps.map(
              (m) =>
                m && (
                  <MvpCard
                    key={m.kind}
                    kind={m.kind}
                    periodLabel={m.featured.period.label}
                    isCurrent={m.featured.isCurrent}
                    result={m.result}
                  />
                ),
            )}
          </div>
        )}
      </section>

      {/* Title cards */}
      {cardPeriod && (cardsHidden || weekCards.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="label">Cards · {cardPeriod.label}</h2>
            <Link
              href="/cards"
              className="text-xs font-semibold text-court-ink hover:underline"
            >
              All cards
            </Link>
          </div>
          {cardsHidden ? (
            <Link href="/cards" className="glass-2 flex items-center gap-4 rounded-3xl p-4">
              <div className="grid w-28 shrink-0 grid-cols-2 gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <CardBack key={i} tier="week" />
                ))}
              </div>
              <div className="min-w-0">
                <div className="label text-muted">Dropping at {hourLabel(cardsHour())}</div>
                {cardLock.unlockAt && (
                  <div className="text-2xl font-extrabold tracking-tight">
                    <Countdown target={cardLock.unlockAt} serverNow={access.now} compact />
                  </div>
                )}
                <p className="text-xs text-muted">Today&apos;s title cards, after the session.</p>
              </div>
            </Link>
          ) : (
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {weekCards.map((c) => (
                <div key={c.key} className="w-44 shrink-0 snap-start">
                  <AwardCard card={c} sharePath={`/cards?tier=week&period=${c.periodKey}`} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {lastDone && lastAwards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="label">Awards</h2>
            <Link
              href="/mvp"
              className="text-xs font-semibold text-court-ink hover:underline"
            >
              All months
            </Link>
          </div>
          <AwardsCard monthLabel={lastDone.label} awards={lastAwards} />
        </section>
      )}

      {/* Top players */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="label">Top players</h2>
          <Link
            href="/rankings"
            className="text-xs font-semibold text-court-ink hover:underline"
          >
            Full rankings
          </Link>
        </div>
        {top3.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            Finish a game to crown a champion.
          </p>
        ) : (
          <div className="grid grid-cols-3 items-end gap-2.5 pt-4">
            {[2, 1, 3].map((place) => {
              const r: Ranked | undefined = top3[place - 1];
              if (!r) return <div key={place} />;
              const first = place === 1;
              return (
                <Link
                  key={place}
                  href={`/players/${r.playerId}`}
                  className={`relative flex flex-col items-center rounded-2xl p-3 text-center ${
                    first ? "glass-2 -mt-4 pt-7 shadow-md" : "glass-1 pt-6"
                  }`}
                >
                  <span
                    className={`tabular absolute -top-3 grid place-items-center rounded-full font-extrabold shadow-sm ${
                      first
                        ? "h-7 w-7 bg-court-soft text-sm text-white"
                        : "h-6 w-6 bg-white text-xs text-ink ring-1 ring-black/10"
                    }`}
                  >
                    {place}
                  </span>
                  <Avatar
                    id={r.playerId}
                    name={r.name}
                    size={first ? "lg" : "md"}
                    tone={first ? "ink" : "soft"}
                  />
                  <span className="mt-2 w-full truncate text-sm font-bold">
                    {shortName(r.name)}
                  </span>
                  <span
                    className={`tabular text-xs font-semibold ${first ? "text-court-ink" : "text-muted"}`}
                  >
                    {r.rating.toFixed(1)} rtg
                  </span>
                  <span
                    className={`tabular mt-2 w-full rounded py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      first
                        ? "bg-court-soft/10 text-court-ink"
                        : "bg-white/50 text-muted"
                    }`}
                  >
                    {r.wins}-{r.losses} rec
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Category leaders */}
      {leaders.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="label px-1">Category leaders</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {leaders.map(({ label, unit, key, player }) => (
              <Link
                key={key}
                href={`/rankings?sort=${key}`}
                className="glass-1 flex w-36 shrink-0 snap-start flex-col justify-between rounded-2xl p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="label text-court-ink">{label}</span>
                  <Avatar id={player.playerId} name={player.name} size="sm" />
                </div>
                <div className="my-2">
                  <span className="tabular text-[32px] font-extrabold leading-9 tracking-tight">
                    {SORTS[key].value(player).toFixed(1)}
                  </span>
                  <span className="ml-1 text-[11px] font-semibold text-muted">
                    {unit}
                  </span>
                </div>
                <span className="truncate text-[11px] font-semibold text-muted">
                  {player.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore */}
      <section className="space-y-2.5">
        <h2 className="label px-1">Explore</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { href: "/standings", title: "Standings", sub: "Season table" },
            { href: "/digest", title: "Weekly digest", sub: "Share the week" },
            { href: "/records#clutch", title: "Clutch", sub: "Game-winners" },
            { href: "/records", title: "Records", sub: "Highs & streaks" },
            {
              href: "/chemistry",
              title: "Duos & rivals",
              sub: "Who wins together",
            },
            { href: "/mvp", title: "MVPs & awards", sub: "Week & month" },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="glass-1 rounded-2xl p-3 active:scale-[0.98]"
            >
              <div className="text-sm font-extrabold leading-tight">
                {t.title}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted">
                {t.sub}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent games */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="label">Recent games</h2>
          <Link
            href="/games"
            className="text-xs font-semibold text-court-ink hover:underline"
          >
            View all
          </Link>
        </div>
        {final.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No finished games yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {final.slice(0, 5).map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

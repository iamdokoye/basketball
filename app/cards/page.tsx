import Link from "next/link";
import { getAccess } from "@/lib/access";
import {
  buildCards,
  cardsHour,
  cardsLock,
  DECK,
  groupByYear,
  TIER_LABEL,
  TIERS,
  yearKey,
  type Tier,
} from "@/lib/cards";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { groupByPeriod, monthKey, weekKey } from "@/lib/mvp";
import { listGames } from "@/lib/queries";
import { AwardCard, CardBack } from "@/app/components/AwardCard";
import { Countdown } from "@/app/components/Countdown";

export const dynamic = "force-dynamic";

const INTRO: Record<Tier, string> = {
  week: "The stat leaders of each game day, revealed after the session. Every title has a bigger version for the month and the year.",
  month: "Who led the whole month. Same stats, bigger names, and the standings keep moving until the month ends.",
  year: "The legends of the year: the same stat leaders over a full calendar year.",
};

function hourLabel(h: number) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${h < 12 ? "AM" : "PM"}`;
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; period?: string }>;
}) {
  const { tier: t, period } = await searchParams;
  const tier: Tier = TIERS.includes(t as Tier) ? (t as Tier) : "week";
  const [games, access] = await Promise.all([listGames(), getAccess()]);
  const tz = leagueTimeZone();
  const day = leagueGameDay();

  const periods: { key: string; label: string; games: typeof games }[] =
    tier === "week"
      ? groupByPeriod(games, "week", tz, day)
      : tier === "month"
        ? groupByPeriod(games, "month", tz, day)
        : groupByYear(games, tz);
  const currentKey =
    tier === "week"
      ? weekKey(access.now, tz, day)
      : tier === "month"
        ? monthKey(access.now, tz)
        : yearKey(access.now, tz);
  const selected =
    periods.find((p) => p.key === period) ??
    periods.find((p) => p.key === currentKey) ??
    periods[0];

  const lock = cardsLock(access.now, games, tz);
  const hidden = lock.locked && selected?.key === currentKey;
  const cards = selected && !hidden ? buildCards(selected.games, tier, selected) : [];
  const isCurrent = selected?.key === currentKey;
  const path = `/cards?tier=${tier}${selected ? `&period=${selected.key}` : ""}`;
  const href = (nextTier: Tier, key?: string) =>
    `/cards?tier=${nextTier}${key ? `&period=${key}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">Cards</h1>
        <p className="text-sm text-muted">{INTRO[tier]}</p>
      </div>

      <nav
        aria-label="Level"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-black/[0.05] p-1"
      >
        {TIERS.map((x) =>
          x === tier ? (
            <span
              key={x}
              aria-current="page"
              className="grid h-10 place-items-center rounded-xl bg-white text-sm font-bold shadow-sm ring-1 ring-black/5"
            >
              {TIER_LABEL[x]}
            </span>
          ) : (
            <Link
              key={x}
              href={href(x)}
              className="grid h-10 place-items-center rounded-xl text-sm font-bold text-muted"
            >
              {TIER_LABEL[x]}
            </Link>
          ),
        )}
      </nav>

      {periods.length > 0 && (
        <nav
          aria-label="Period"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {periods.slice(0, 12).map((p) =>
            p.key === selected?.key ? (
              <span
                key={p.key}
                aria-current="page"
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper shadow-sm"
              >
                {p.label}
              </span>
            ) : (
              <Link
                key={p.key}
                href={href(tier, p.key)}
                className="glass-1 shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-muted"
              >
                {p.label}
              </Link>
            ),
          )}
        </nav>
      )}

      {!selected ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          Cards appear after the first finished game.
        </p>
      ) : hidden ? (
        <section className="glass-2 space-y-4 rounded-3xl p-5 text-center">
          <div className="grid grid-cols-4 gap-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <CardBack key={i} tier={tier} />
            ))}
          </div>
          <div className="space-y-1">
            <div className="label text-muted">Today&apos;s cards drop at {hourLabel(cardsHour())}</div>
            {lock.unlockAt && (
              <div className="text-3xl font-extrabold tracking-tight">
                <Countdown target={lock.unlockAt} serverNow={access.now} />
              </div>
            )}
            <p className="text-sm text-muted">
              No spoilers while games are being played. Earlier weeks are open below.
            </p>
          </div>
        </section>
      ) : cards.length === 0 ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          No cards for {selected.label} yet.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="label text-muted">
              {tier === "year" ? selected.label : `${TIER_LABEL[tier]} of ${selected.label}`}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isCurrent ? "bg-court-soft/15 text-court-ink" : "bg-black/[0.06] text-muted"
              }`}
            >
              {isCurrent ? "Leading so far" : "Final"}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <li key={c.key} className="min-w-0">
                <AwardCard card={c} sharePath={path} />
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="glass-1 rounded-2xl p-4">
        <summary className="cursor-pointer text-sm font-bold">All the titles</summary>
        <p className="mt-2 text-xs text-muted">
          The same stat leader gets a bigger name the longer the stretch.
        </p>
        <ul className="mt-3 divide-y divide-black/[0.06]">
          {DECK.map((c) => (
            <li key={c.id} className="space-y-1 py-2.5">
              <div className="label text-[10px] text-muted">
                {c.label}: {c.line}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
                {TIERS.map((x) => (
                  <span key={x} className="flex items-center gap-1.5">
                    <span aria-hidden>{c.tierEmoji?.[x] ?? c.emoji}</span>
                    {c.names[x]}
                    <span className="text-[10px] font-semibold uppercase text-muted">{x}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

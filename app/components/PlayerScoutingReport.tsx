"use client";

import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import type { MatchupInsight, ScoutingReport } from "@/lib/scouting";

export function PlayerScoutingReport({ report }: { report: ScoutingReport }) {
  const { nemesis, bunny, bestCoStar, topRival, tendencies, summary, playerId } = report;

  const hasAnyMatchup = Boolean(nemesis || bunny || bestCoStar || topRival);

  if (!hasAnyMatchup && tendencies.length === 0) {
    return null;
  }

  return (
    <section className="glass-1 space-y-4 rounded-3xl p-4 sm:p-6 border border-black/5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-court-soft/30 text-sm">
            📋
          </span>
          <div>
            <h2 className="text-base font-extrabold text-ink tracking-tight">
              Scouting Report &amp; Matchup Intel
            </h2>
            <p className="text-xs text-muted">
              Head-to-head kryptonites, chemistry partners, and court tendencies.
            </p>
          </div>
        </div>

        <Link
          href={`/compare?p1=${playerId}`}
          className="rounded-full bg-court-ink/10 px-3 py-1 text-xs font-bold text-court-ink hover:bg-court-ink hover:text-white transition active:scale-95"
        >
          Tale of the Tape →
        </Link>
      </div>

      {/* Scout Summary Narrative */}
      {summary && (
        <div className="rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold leading-relaxed text-ink/80 border border-black/5">
          <span className="font-extrabold text-court-ink">Scout Summary: </span>
          {summary}
        </div>
      )}

      {/* Key Matchup Cards Grid */}
      {hasAnyMatchup && (
        <div className="space-y-2">
          <div className="label text-[11px] text-muted">Key Personnel Matchups</div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Nemesis / Kryptonite */}
            {nemesis ? (
              <MatchupCard insight={nemesis} currentPlayerId={playerId} type="nemesis" />
            ) : (
              <EmptyMatchupCard
                label="No Clear Nemesis"
                detail="Has not lost multiple games against a single foe yet."
              />
            )}

            {/* 2. Favorite Target */}
            {bunny ? (
              <MatchupCard insight={bunny} currentPlayerId={playerId} type="bunny" />
            ) : (
              <EmptyMatchupCard
                label="No Favorite Target"
                detail="Has not dominated a single opponent across multiple runs."
              />
            )}

            {/* 3. Best Co-Star */}
            {bestCoStar ? (
              <MatchupCard insight={bestCoStar} currentPlayerId={playerId} type="coStar" />
            ) : (
              <EmptyMatchupCard
                label="Solo Operator"
                detail="Needs 2+ games with a regular partner to lock chemistry."
              />
            )}

            {/* 4. Top Rival */}
            {topRival ? (
              <MatchupCard insight={topRival} currentPlayerId={playerId} type="rival" />
            ) : (
              <EmptyMatchupCard
                label="Open Floor"
                detail="Evenly distributed opponent matchups across the league."
              />
            )}
          </div>
        </div>
      )}

      {/* Signature Playstyle Tendencies */}
      {tendencies.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="label text-[11px] text-muted">Signature Tendencies &amp; Habits</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {tendencies.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-black/5 bg-white/70 p-3 shadow-2xs transition hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{t.emoji}</span>
                    <span className="text-xs font-black text-ink">{t.title}</span>
                  </div>
                  <span className="rounded-full bg-court-soft/20 px-2 py-0.5 text-[10px] font-black text-court-ink">
                    {t.stat}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] font-medium leading-normal text-muted">
                  {t.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MatchupCard({
  insight,
  currentPlayerId,
  type,
}: {
  insight: MatchupInsight;
  currentPlayerId: number;
  type: "nemesis" | "bunny" | "coStar" | "rival";
}) {
  const { mate, winPct, label, badge, description } = insight;

  const style = {
    nemesis: {
      bg: "bg-rose-500/10 border-rose-500/20 text-rose-800",
      badge: "bg-rose-500/15 text-rose-700",
      accent: "text-rose-700",
      tone: "soft" as const,
    },
    bunny: {
      bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-800",
      badge: "bg-emerald-500/15 text-emerald-700",
      accent: "text-emerald-700",
      tone: "soft" as const,
    },
    coStar: {
      bg: "bg-amber-500/10 border-amber-500/20 text-amber-800",
      badge: "bg-amber-500/15 text-amber-800",
      accent: "text-amber-800",
      tone: "ink" as const,
    },
    rival: {
      bg: "bg-court-soft/20 border-court-soft/30 text-court-ink",
      badge: "bg-court-soft/30 text-court-ink",
      accent: "text-court-ink",
      tone: "soft" as const,
    },
  }[type];

  const isTeammate = type === "coStar";

  return (
    <div className={`relative flex flex-col justify-between rounded-2xl border p-3.5 shadow-2xs transition-all ${style.bg}`}>
      <div>
        <div className="flex items-center justify-between gap-1.5 pb-2">
          <span className="label text-[10px] font-black uppercase tracking-wider opacity-80">
            {label}
          </span>
          <span className={`rounded-full px-2 py-0.2 text-[9px] font-black uppercase ${style.badge}`}>
            {badge}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Avatar id={mate.playerId} name={mate.name} size="sm" tone={style.tone} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/players/${mate.playerId}`}
              className="truncate block text-sm font-extrabold text-ink hover:underline"
            >
              {shortName(mate.name)}
            </Link>
            <div className="tabular text-xs font-black text-ink/90">
              {mate.wins}W – {mate.losses}L{" "}
              <span className="text-[10px] font-bold opacity-75">
                ({winPct}% {isTeammate ? "together" : ""})
              </span>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-tight opacity-80 font-medium">
          {description}
        </p>
      </div>

      <div className="pt-3">
        <Link
          href={`/compare?p1=${currentPlayerId}&p2=${mate.playerId}`}
          className="flex items-center justify-center gap-1 rounded-xl bg-white/80 py-1.5 text-[11px] font-bold text-ink shadow-2xs hover:bg-white active:scale-95 transition"
        >
          <span>Tale of the Tape</span>
          <span>⚔️</span>
        </Link>
      </div>
    </div>
  );
}

function EmptyMatchupCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 opacity-60">
      <div>
        <div className="label text-[10px] text-muted">{label}</div>
        <p className="mt-1 text-xs text-muted font-medium">{detail}</p>
      </div>
    </div>
  );
}

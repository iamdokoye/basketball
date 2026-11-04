"use client";

import { useState } from "react";
import {
  ARCHETYPE_TIER_META,
  type PlayerArchetype,
} from "@/lib/badges";

const TIER_STYLES = {
  bronze: {
    badge: "bg-amber-900/15 text-amber-800 ring-amber-900/25",
    dot: "bg-amber-700",
  },
  silver: {
    badge: "bg-slate-300/40 text-slate-700 ring-slate-400/30",
    dot: "bg-slate-500",
  },
  gold: {
    badge: "bg-amber-400/20 text-amber-700 ring-amber-500/40",
    dot: "bg-amber-500",
  },
  hof: {
    badge: "bg-purple-600/15 text-purple-700 ring-purple-500/35 shadow-sm",
    dot: "bg-purple-600",
  },
};

export type ArchetypeViewData = {
  seasonLabel: string;
  season: PlayerArchetype;
  allTime: PlayerArchetype;
  defaultView?: "season" | "allTime";
};

export function PlayerBadges({
  archetype,
  viewData,
}: {
  archetype?: PlayerArchetype;
  viewData?: ArchetypeViewData;
}) {
  const [viewMode, setViewMode] = useState<"season" | "allTime">(
    viewData?.defaultView ?? "season",
  );

  const current = viewData
    ? viewMode === "season"
      ? viewData.season
      : viewData.allTime
    : archetype;

  if (!current) return null;

  const tierMeta = ARCHETYPE_TIER_META[current.tier] ?? ARCHETYPE_TIER_META[0];

  return (
    <section className="space-y-4">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="label text-court-ink">Playstyle Archetype</div>
        {viewData && (
          <div className="flex rounded-xl bg-black/[0.05] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("season")}
              className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                viewMode === "season"
                  ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              {viewData.seasonLabel}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("allTime")}
              className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                viewMode === "allTime"
                  ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              All time
            </button>
          </div>
        )}
      </div>

      {/* Archetype Card */}
      <div className="glass-2 relative overflow-hidden rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-black/[0.05] text-2xl shadow-inner"
              aria-hidden
            >
              {current.emoji}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  {current.title}
                </h2>
                <span
                  className={`tabular inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${tierMeta.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tierMeta.dotClass}`} />
                  {tierMeta.label}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-muted">
                {current.gp === 0
                  ? "No games played in this period yet"
                  : `Based on ${current.gp} ${current.gp === 1 ? "game" : "games"} ${
                      viewData
                        ? viewMode === "season"
                          ? `in ${viewData.seasonLabel}`
                          : "across career"
                        : ""
                    }`}
              </div>
            </div>
          </div>
          {current.badges.length > 0 && (
            <span className="tabular rounded-full bg-court-soft/10 px-3 py-1 text-xs font-bold text-court-ink ring-1 ring-court-soft/25">
              {current.badges.length} {current.badges.length === 1 ? "badge" : "badges"}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-medium leading-relaxed text-muted">
          {current.description}
        </p>
      </div>

      {/* Next Archetype Evolution Targets */}
      {current.nextUpgrades && current.nextUpgrades.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="label text-court-ink">Next Archetype Upgrades</div>
            <span className="text-[11px] font-semibold text-muted">
              Evolve your playstyle
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {current.nextUpgrades.map((u) => {
              const upgradeTier = ARCHETYPE_TIER_META[u.tier] ?? ARCHETYPE_TIER_META[1];
              return (
                <div
                  key={u.title}
                  className="glass-1 relative flex flex-col justify-between rounded-2xl p-3.5 transition-transform hover:scale-[1.01]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>
                          {u.emoji}
                        </span>
                        <div>
                          <div className="font-extrabold text-ink leading-tight">
                            {u.title}
                          </div>
                          <span
                            className={`tabular inline-flex items-center gap-1 rounded-sm px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider ${upgradeTier.badgeClass}`}
                          >
                            {upgradeTier.label}
                          </span>
                        </div>
                      </div>
                      <span className="tabular font-black text-xs text-court-ink bg-court-soft/10 px-2 py-0.5 rounded-md">
                        {u.progressPct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="h-full rounded-full bg-court-ink transition-all duration-500"
                        style={{ width: `${Math.max(4, u.progressPct)}%` }}
                      />
                    </div>

                    <div className="mt-2 text-xs font-bold text-court-ink">
                      🎯 {u.requirement}
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] font-medium leading-normal text-muted">
                    {u.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tier 4: The All-Around Threat Supreme Banner */}
      {current.tier === 4 && (
        <div className="glass-1 flex items-center gap-3.5 rounded-2xl p-4.5 ring-2 ring-emerald-500/35 bg-emerald-500/10 shadow-xs">
          <span className="text-3xl" aria-hidden>
            🌟
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span>👑</span>
              <span>The All-Around Threat · Supreme Apex</span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-emerald-950">
              You have combined all 3 core pillars: elite shooting, playmaking, and lockdown defense. The undisputed master on the court.
            </p>
          </div>
        </div>
      )}

      {/* Tier 3: Pinnacle Dual-Pillar Banner */}
      {current.tier === 3 && (
        <div className="glass-1 flex items-center gap-3 rounded-2xl p-4 ring-1 ring-purple-500/25 bg-purple-500/5">
          <span className="text-2xl" aria-hidden>
            👑
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-purple-700">
              Tier 3 Dual-Pillar Master
            </div>
            <p className="mt-0.5 text-xs font-medium text-muted">
              You have mastered two of the three core pillars (Shoot, Assist, Defense). Master the final pillar to unlock Tier 4 · The All-Around Threat 🌟.
            </p>
          </div>
        </div>
      )}

      {/* 2K Badges List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="label text-court-ink">2K Badges</div>
          <span className="text-[11px] font-semibold text-muted">
            {current.badges.length} {current.badges.length === 1 ? "badge" : "badges"} earned
          </span>
        </div>

        {current.badges.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {current.badges.map((b) => {
              const style = TIER_STYLES[b.tier];
              return (
                <div
                  key={b.id}
                  className="glass-1 relative flex flex-col justify-between rounded-2xl p-3.5 transition-transform hover:scale-[1.01]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>
                          {b.emoji}
                        </span>
                        <span className="font-extrabold text-ink">{b.name}</span>
                      </div>
                      <span
                        className={`tabular inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${style.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {b.tierLabel}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-medium text-muted">
                      {b.description}
                    </p>
                  </div>

                  {/* Level Progress & Next Level Requirements */}
                  <div className="tabular mt-3 hairline border-t pt-2 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between font-semibold text-court-ink">
                      <span>{b.progress}</span>
                      {b.nextTier && (
                        <span className="text-[10px] font-bold text-muted">
                          {b.nextTier.progressPct}% to {b.nextTier.tierLabel}
                        </span>
                      )}
                    </div>

                    {b.nextTier ? (
                      <div className="space-y-1">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.06]">
                          <div
                            className="h-full rounded-full bg-court-ink transition-all duration-300"
                            style={{ width: `${Math.max(4, b.nextTier.progressPct)}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-semibold text-ink/80 flex items-baseline gap-1">
                          <span className="text-court-ink font-bold">🎯 Next:</span>
                          <span className="text-muted leading-tight">
                            {b.nextTier.requirement}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-purple-700 flex items-center gap-1 pt-0.5">
                        <span>🏆</span>
                        <span>Max Level Reached ({b.tierLabel})</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="glass-1 rounded-2xl p-6 text-center text-xs font-semibold text-muted">
            Play more games in this period to unlock 2K badges.
          </p>
        )}
      </div>
    </section>
  );
}

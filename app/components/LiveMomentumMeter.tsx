"use client";

import { useMemo } from "react";
import { computeLiveMomentum, detectOnFirePlayers } from "@/lib/momentum";
import type { GameEvent, RosterEntry, Team } from "@/lib/stats";
import { shortName } from "@/app/components/Avatar";

export function LiveMomentumMeter({
  events,
  roster,
  teamNames = { A: "Team A", B: "Team B" },
}: {
  events: GameEvent[];
  roster: RosterEntry[];
  teamNames?: Record<Team, string>;
}) {
  const momentum = useMemo(
    () => computeLiveMomentum(events, roster),
    [events, roster],
  );

  const onFire = useMemo(
    () => detectOnFirePlayers(events, roster, 2),
    [events, roster],
  );

  if (events.length < 2) return null;

  const pctA = momentum.momentumPctA;
  const pctB = 100 - pctA;

  return (
    <div className="glass-1 space-y-2.5 rounded-3xl p-3.5 sm:p-4">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className={pctA > 50 ? "text-court-ink font-black" : "text-muted"}>
          {teamNames.A} ({pctA}%)
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider text-muted">
          ⚡ Court Momentum
        </span>
        <span className={pctB > 50 ? "text-away-dark font-black" : "text-muted"}>
          ({pctB}%) {teamNames.B}
        </span>
      </div>

      {/* Momentum Tug-of-War Bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
        <div
          style={{ width: `${pctA}%` }}
          className={`transition-all duration-500 ${
            pctA >= 60 ? "bg-court-ink" : "bg-black/30"
          }`}
        />
        <div
          style={{ width: `${pctB}%` }}
          className={`transition-all duration-500 ${
            pctB >= 60 ? "bg-zinc-800" : "bg-black/30"
          }`}
        />
      </div>

      {/* Active Run or On Fire Alert */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/5 text-xs">
        {momentum.currentRun ? (
          <div className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-500/15 px-2.5 py-0.5 rounded-full text-[11px]">
            <span>🔥</span>
            <span>
              {teamNames[momentum.currentRun.team]} on a {momentum.currentRun.pts}–0 run!
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted font-medium">Back and forth battle</span>
        )}

        {/* On Fire Badges */}
        {onFire.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {onFire.map((p) => (
              <span
                key={p.playerId}
                className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-700 animate-pulse"
                title={`${p.playerName} has made ${p.streak} straight shots without a miss (${p.ptsInStreak} pts)`}
              >
                <span>🔥</span>
                <span>{shortName(p.playerName)} ({p.streak} in a row!)</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

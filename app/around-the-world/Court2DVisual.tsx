"use client";

import { useMemo } from "react";
import { Avatar } from "@/app/components/Avatar";
import type { CourtSpot, ShootingPlayer } from "@/lib/shootingGame";

export function Court2DVisual({
  spots,
  activeSpotIndex,
  players = [],
  activePlayerId,
  interactive = false,
  selectedSpotId,
  onSelectSpot,
  onCourtClick,
}: {
  spots: CourtSpot[];
  activeSpotIndex?: number;
  players?: ShootingPlayer[];
  activePlayerId?: number;
  interactive?: boolean;
  selectedSpotId?: string;
  onSelectSpot?: (spot: CourtSpot, index: number) => void;
  onCourtClick?: (x: number, y: number) => void;
}) {
  // Generate SVG path connecting all spots in sequence to show the "Around the World" circuit
  const circuitPath = useMemo(() => {
    if (spots.length < 2) return "";
    return spots.reduce((acc, spot, i) => {
      // Scale percentage (0-100) to SVG viewbox (300 x 240)
      const x = (spot.x / 100) * 300;
      const y = (spot.y / 100) * 240;
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "");
  }, [spots]);

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onCourtClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onCourtClick(Math.max(5, Math.min(95, xPct)), Math.max(5, Math.min(95, yPct)));
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl select-none overflow-hidden rounded-3xl border border-amber-950/20 bg-gradient-to-b from-[#dfb17b] via-[#d69f62] to-[#c98f50] p-2.5 sm:p-4 shadow-xl">
      {/* Wood plank line patterns */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(0,0,0,0.15) 18px, rgba(0,0,0,0.15) 19px)",
        }}
      />

      {/* Court Header Badge */}
      <div className="relative z-10 flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-950/80">
            2D Half-Court Circuit
          </span>
        </div>
        <div className="text-[10px] font-extrabold text-amber-950/70 bg-amber-900/10 rounded-full px-2.5 py-0.5">
          {spots.length} Court Spots
        </div>
      </div>

      {/* SVG Court & Spots */}
      <div className="relative aspect-[300/240] w-full">
        <svg
          viewBox="0 0 300 240"
          className="h-full w-full"
          onClick={handleSvgClick}
        >
          {/* Outer Boundary */}
          <rect
            x="4"
            y="4"
            width="292"
            height="232"
            rx="12"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.8"
          />

          {/* Key / Paint */}
          <rect
            x="105"
            y="4"
            width="90"
            height="106"
            fill="#ba7f47"
            fillOpacity="0.4"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />

          {/* Free Throw Circle */}
          <circle
            cx="150"
            cy="110"
            r="44"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.75"
            strokeDasharray="4 4"
          />
          {/* Solid Top Half of Free Throw Circle */}
          <path
            d="M 106 110 A 44 44 0 0 0 194 110"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />

          {/* Restricted Area Arc */}
          <path
            d="M 132 28 A 18 18 0 0 0 168 28"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeOpacity="0.6"
          />

          {/* Backboard & Rim */}
          <line
            x1="125"
            y1="20"
            x2="175"
            y2="20"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line x1="150" y1="20" x2="150" y2="25" stroke="#e04e26" strokeWidth="2.5" />
          <circle
            cx="150"
            cy="31"
            r="7"
            fill="#e04e26"
            fillOpacity="0.25"
            stroke="#e04e26"
            strokeWidth="2.5"
          />

          {/* 3-Point Arc */}
          {/* Baseline Straights */}
          <line
            x1="22"
            y1="4"
            x2="22"
            y2="48"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
          <line
            x1="278"
            y1="4"
            x2="278"
            y2="48"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
          {/* Arc Curve */}
          <path
            d="M 22 48 A 136 136 0 0 0 278 48"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />

          {/* Half-Court Center Circle Segment */}
          <path
            d="M 115 236 A 35 35 0 0 1 185 236"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.7"
          />

          {/* Sequential Circuit Path (Dashed Arrow Trajectory) */}
          {circuitPath && (
            <path
              d={circuitPath}
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeOpacity="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Spot Pins & Interactive Markers (Plotted in Absolute CSS %) */}
        {spots.map((spot, idx) => {
          const isTarget = activeSpotIndex === idx;
          const isSelected = selectedSpotId === spot.id;
          const playersHere = players.filter((p) => p.currentSpotIndex === idx);

          return (
            <div
              key={spot.id}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            >
              {/* Outer Glowing Ring for Active Shooter Target */}
              {isTarget && (
                <div className="absolute -inset-2.5 rounded-full bg-court-ink/30 animate-ping pointer-events-none" />
              )}

              {/* Spot Target Pin Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSpot?.(spot, idx);
                }}
                className={`group relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-black shadow-lg transition-transform ${
                  isTarget
                    ? "bg-court-ink text-white ring-4 ring-court-ink/40 scale-125 z-30"
                    : isSelected
                    ? "bg-amber-400 text-amber-950 ring-4 ring-amber-400/50 scale-110 z-20"
                    : playersHere.length > 0
                    ? "bg-ink text-paper ring-2 ring-white z-20"
                    : "bg-white/95 text-ink ring-1 ring-black/20 hover:scale-110 hover:bg-white z-10"
                }`}
                title={`Spot #${idx + 1}: ${spot.name}`}
              >
                <span>{idx + 1}</span>

                {/* Target Pin Pointer Tag */}
                {isTarget && (
                  <span className="absolute -top-5 whitespace-nowrap rounded-full bg-court-ink px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-white shadow-xs">
                    TARGET
                  </span>
                )}
              </button>

              {/* Spot Label (e.g. "R-CNR", "TOP") */}
              <span className="mt-1 hidden sm:inline-block whitespace-nowrap rounded-md bg-black/75 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-md pointer-events-none">
                {spot.short}
              </span>

              {/* Player Stationed Pins */}
              {playersHere.length > 0 && (
                <div className="absolute -top-7 flex -space-x-1.5 z-40">
                  {playersHere.map((p) => (
                    <span
                      key={p.id}
                      title={`${p.name} is at Spot #${idx + 1}`}
                      className="rounded-full ring-2 ring-white shadow-md"
                    >
                      <Avatar
                        name={p.name}
                        size="sm"
                        tone={p.id === activePlayerId ? "ink" : "soft"}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend / Instructions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-amber-950/15 pt-2 text-[11px] font-semibold text-amber-950/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-court-ink" />
            <span>Target Spot</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-white ring-1 ring-black/20" />
            <span>Available Spot</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-4 rounded-full bg-ink/60" />
            <span>Circuit Path (1 ➔ {spots.length})</span>
          </span>
        </div>
        {interactive && (
          <span className="text-[10px] italic text-amber-950/70">
            Tap any spot to select or inspect
          </span>
        )}
      </div>
    </div>
  );
}

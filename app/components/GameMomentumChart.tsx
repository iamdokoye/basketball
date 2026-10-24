"use client";

import { useState } from "react";
import type { GameMomentum, ScoreMoment } from "@/lib/momentum";

export function GameMomentumChart({
  momentum,
}: {
  momentum: GameMomentum;
}) {
  const { timeline, leadChanges, timesTied, maxLeadA, maxLeadB, biggestRun } = momentum;
  const [activeMoment, setActiveMoment] = useState<ScoreMoment | null>(
    timeline[timeline.length - 1] ?? null,
  );

  if (timeline.length <= 1) return null;

  // Chart dimensions
  const width = 600;
  const height = 180;
  const padX = 24;
  const padY = 24;

  const maxMargin = Math.max(3, maxLeadA, maxLeadB);
  const midY = height / 2;

  // Coordinate mappers
  const getX = (index: number) =>
    padX + (index / (timeline.length - 1)) * (width - 2 * padX);
  const getY = (margin: number) =>
    midY - (margin / maxMargin) * (midY - padY);

  // Path generator
  const points = timeline.map((m, i) => ({ x: getX(i), y: getY(m.margin), m }));
  const pathData = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  // Shaded area paths for positive (Team A) and negative (Team B)
  const areaA = `M ${points[0].x} ${midY} ` +
    points.map((p) => `L ${p.x} ${Math.min(midY, p.y)}`).join(" ") +
    ` L ${points[points.length - 1].x} ${midY} Z`;

  const areaB = `M ${points[0].x} ${midY} ` +
    points.map((p) => `L ${p.x} ${Math.max(midY, p.y)}`).join(" ") +
    ` L ${points[points.length - 1].x} ${midY} Z`;

  return (
    <div className="glass-2 space-y-4 rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <div className="label text-court-ink">Flow of the Game</div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Lead Tracker &amp; Momentum
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-court-soft/15 px-2.5 py-1 text-court-ink">
            Lime +{maxLeadA} max
          </span>
          <span className="rounded-full bg-away-soft/20 px-2.5 py-1 text-away-dark">
            Blue +{maxLeadB} max
          </span>
        </div>
      </div>

      {/* Interactive Tooltip Card */}
      {activeMoment && (
        <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-xs transition-all">
          <div className="min-w-0">
            <div className="font-extrabold text-ink">
              {activeMoment.playerName}{" "}
              {activeMoment.pts > 0 && (
                <span className="text-muted">
                  (+{activeMoment.pts} {activeMoment.type.includes("3") ? "three" : activeMoment.type.includes("FT") ? "FT" : "pts"})
                </span>
              )}
            </div>
            <div className="tabular text-[11px] font-semibold text-muted">
              {activeMoment.margin === 0
                ? "Game Tied"
                : activeMoment.margin > 0
                  ? `Team Lime led by ${activeMoment.margin}`
                  : `Team Blue led by ${Math.abs(activeMoment.margin)}`}
            </div>
          </div>
          <div className="tabular shrink-0 text-right text-base font-black text-ink">
            {activeMoment.aScore} – {activeMoment.bScore}
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <div className="relative overflow-hidden rounded-2xl bg-black/[0.03] p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-36 w-full touch-pan-x select-none overflow-visible"
        >
          {/* Shaded Areas */}
          <path d={areaA} fill="rgba(234, 88, 12, 0.12)" />
          <path d={areaB} fill="rgba(2, 132, 199, 0.12)" />

          {/* Zero baseline (Tied) */}
          <line
            x1={padX}
            y1={midY}
            x2={width - padX}
            y2={midY}
            stroke="rgba(0,0,0,0.15)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Main momentum line */}
          <path
            d={pathData}
            fill="none"
            stroke="#1c1917"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Points */}
          {points.map((p, i) => {
            const isSelected = activeMoment?.step === p.m.step;
            const dotColor =
              p.m.margin > 0 ? "#ea580c" : p.m.margin < 0 ? "#0284c7" : "#78716c";
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setActiveMoment(p.m)}
                onClick={() => setActiveMoment(p.m)}
              >
                {/* Hit target */}
                <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
                {/* Visual circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? "5.5" : "3.5"}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? "2" : "1.5"}
                  className="transition-all"
                />
              </g>
            );
          })}
        </svg>

        <div className="flex justify-between px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
          <span>Tip-off</span>
          <span>Final</span>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="glass-1 rounded-2xl p-2.5">
          <div className="tabular text-base font-extrabold text-ink">
            {leadChanges}
          </div>
          <div className="label text-[10px] text-muted">Lead changes</div>
        </div>
        <div className="glass-1 rounded-2xl p-2.5">
          <div className="tabular text-base font-extrabold text-ink">
            {timesTied}
          </div>
          <div className="label text-[10px] text-muted">Times tied</div>
        </div>
        <div className="glass-1 rounded-2xl p-2.5">
          <div className="tabular text-base font-extrabold text-ink">
            {biggestRun ? `${biggestRun.team === "A" ? "Lime" : "Blue"} ${biggestRun.pts}-0` : "None"}
          </div>
          <div className="label text-[10px] text-muted">Biggest run</div>
        </div>
      </div>
    </div>
  );
}

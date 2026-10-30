"use client";

import { useMemo, useState } from "react";
import {
  calculateWinProbability,
  buildWinProbabilityTimeline,
  type ProbabilityStep,
} from "@/lib/winProbability";
import { computeLiveMomentum } from "@/lib/momentum";
import type { GameEvent, RosterEntry, Team } from "@/lib/stats";

export function LiveWinProbability({
  scoreA,
  scoreB,
  target = 20,
  winBy = 1,
  events = [],
  roster = [],
  teamNames = { A: "Team A", B: "Team B" },
}: {
  scoreA: number;
  scoreB: number;
  target?: number;
  winBy?: number;
  events?: GameEvent[];
  roster?: RosterEntry[];
  teamNames?: Record<Team, string>;
}) {
  const [showChart, setShowChart] = useState(false);
  const [hoveredStep, setHoveredStep] = useState<ProbabilityStep | null>(null);

  // Current live momentum for adjusting base odds
  const momentum = useMemo(
    () => (events.length > 0 ? computeLiveMomentum(events, roster) : null),
    [events, roster],
  );

  // Compute live win probability
  const prob = useMemo(
    () =>
      calculateWinProbability({
        scoreA,
        scoreB,
        target,
        winBy,
        momentumPctA: momentum ? momentum.momentumPctA : 50,
      }),
    [scoreA, scoreB, target, winBy, momentum],
  );

  // Step-by-step history timeline
  const timeline = useMemo(
    () =>
      events.length > 0
        ? buildWinProbabilityTimeline(events, roster, target, winBy)
        : [],
    [events, roster, target, winBy],
  );

  const isHighLeverage = prob.leverageIndex >= 2.5;

  return (
    <div className="glass-1 space-y-3 rounded-3xl p-3.5 sm:p-4">
      {/* Header with Title and Leverage Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-court-ink animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-ink">
            Win Probability
          </span>
          <span className="text-[10px] text-muted font-semibold hidden sm:inline">
            Target {target}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Leverage Index Indicator */}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
              isHighLeverage
                ? "bg-rose-500/20 text-rose-700 ring-1 ring-rose-500/30 animate-pulse"
                : prob.leverageIndex >= 1.8
                ? "bg-amber-500/20 text-amber-800 ring-1 ring-amber-500/30"
                : "bg-black/[0.05] text-muted"
            }`}
            title="Measures how critical the next possession is to the final outcome"
          >
            {prob.leverageIndex}x Leverage
          </span>

          {timeline.length > 2 && (
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-muted hover:text-ink transition"
            >
              {showChart ? "Hide Chart" : "Show Chart"}
            </button>
          )}
        </div>
      </div>

      {/* Tri-Color Probability Distribution Bar */}
      <div className="space-y-1">
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-black/10 shadow-inner">
          {/* Team A Win % */}
          <div
            style={{ width: `${prob.probA}%` }}
            className="flex items-center justify-center bg-court-ink text-[9px] font-black text-white transition-all duration-500"
            title={`${teamNames.A} Win: ${prob.probA}%`}
          >
            {prob.probA >= 14 && `${prob.probA}%`}
          </div>

          {/* Draw / OT Tie % */}
          <div
            style={{ width: `${prob.probDraw}%` }}
            className="flex items-center justify-center bg-amber-400 text-[9px] font-black text-amber-950 transition-all duration-500"
            title={`Draw / OT Tie: ${prob.probDraw}%`}
          >
            {prob.probDraw >= 14 && `${prob.probDraw}%`}
          </div>

          {/* Team B Win % */}
          <div
            style={{ width: `${prob.probB}%` }}
            className="flex items-center justify-center bg-zinc-800 text-[9px] font-black text-white transition-all duration-500"
            title={`${teamNames.B} Win: ${prob.probB}%`}
          >
            {prob.probB >= 14 && `${prob.probB}%`}
          </div>
        </div>

        {/* Labels below the bar */}
        <div className="grid grid-cols-3 text-center text-xs pt-1">
          {/* Team A Card */}
          <div className="text-left">
            <div className="truncate font-extrabold text-court-ink text-[11px] sm:text-xs">
              {teamNames.A}
            </div>
            <div className="text-sm sm:text-base font-black tabular text-ink">
              {prob.probA}% <span className="text-[10px] font-medium text-muted">Win</span>
            </div>
          </div>

          {/* Draw / OT Tie Card */}
          <div className="text-center">
            <div className="font-extrabold text-amber-800 text-[11px] sm:text-xs">
              Draw / OT Tie
            </div>
            <div className="text-sm sm:text-base font-black tabular text-amber-900">
              {prob.probDraw}%{" "}
              <span className="text-[10px] font-medium text-amber-700/80">
                {scoreA >= target - 2 && scoreB >= target - 2 ? "Deuce" : "Tension"}
              </span>
            </div>
          </div>

          {/* Team B Card */}
          <div className="text-right">
            <div className="truncate font-extrabold text-zinc-700 text-[11px] sm:text-xs">
              {teamNames.B}
            </div>
            <div className="text-sm sm:text-base font-black tabular text-ink">
              {prob.probB}% <span className="text-[10px] font-medium text-muted">Win</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description Banner */}
      <div className="rounded-xl bg-black/[0.03] px-3 py-1.5 text-center text-[11px] font-semibold text-muted">
        {prob.description}
      </div>

      {/* Probability Chart SVG Timeline (if toggled) */}
      {showChart && timeline.length > 1 && (
        <div className="pt-2 border-t border-black/5 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted">
            <span>Win Probability Over Time</span>
            <span>{hoveredStep ? hoveredStep.description : "Hover points for details"}</span>
          </div>

          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-white/70 p-2 shadow-2xs border border-black/5">
            <svg viewBox="0 0 300 100" className="h-full w-full overflow-visible">
              {/* 50% Center Line */}
              <line
                x1="0"
                y1="50"
                x2="300"
                y2="50"
                stroke="#000000"
                strokeOpacity="0.12"
                strokeDasharray="3 3"
                strokeWidth="1"
              />

              {/* Draw probability threshold line */}
              <line
                x1="0"
                y1="85"
                x2="300"
                y2="85"
                stroke="#f59e0b"
                strokeOpacity="0.25"
                strokeDasharray="2 2"
                strokeWidth="0.8"
              />

              {/* Area fill for Team A probability */}
              <path
                d={timeline.reduce((acc, step, i) => {
                  const x = (i / (timeline.length - 1)) * 300;
                  // y = 100 - probA (so 100% is at top y=0, 0% is at bottom y=100)
                  const y = 100 - step.probA;
                  return i === 0 ? `M 0 100 L ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, "") + ` L 300 100 Z`}
                fill="currentColor"
                className="text-court-soft/30"
              />

              {/* Team A Win Line */}
              <path
                d={timeline.reduce((acc, step, i) => {
                  const x = (i / (timeline.length - 1)) * 300;
                  const y = 100 - step.probA;
                  return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, "")}
                fill="none"
                stroke="#e04e26"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Draw / OT Line */}
              <path
                d={timeline.reduce((acc, step, i) => {
                  const x = (i / (timeline.length - 1)) * 300;
                  // Map Draw probability near the bottom half
                  const y = 100 - step.probDraw;
                  return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, "")}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.8"
                strokeDasharray="3 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Point Circles */}
              {timeline.map((step, i) => {
                const x = (i / (timeline.length - 1)) * 300;
                const y = 100 - step.probA;
                return (
                  <circle
                    key={step.step}
                    cx={x}
                    cy={y}
                    r={hoveredStep?.step === step.step ? 4.5 : 2.5}
                    className="cursor-pointer fill-court-ink stroke-white stroke-[1.5] transition-all hover:r-[5]"
                    onMouseEnter={() => setHoveredStep(step)}
                    onMouseLeave={() => setHoveredStep(null)}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

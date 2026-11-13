"use client";

import { useState } from "react";
import type { DaggerPlay, ProbabilityStep } from "@/lib/winProbability";
import type { Team } from "@/lib/stats";

export function WinProbabilityChart({
  steps,
  dagger,
  winner,
  teamNames = { A: "Team A", B: "Team B" },
}: {
  steps: ProbabilityStep[];
  dagger?: DaggerPlay | null;
  winner?: Team | null;
  teamNames?: { A: string; B: string };
}) {
  const [activeStep, setActiveStep] = useState<ProbabilityStep | null>(null);

  if (!steps || steps.length < 2) {
    return null;
  }

  // Chart coordinates
  const width = 600;
  const height = 240;
  const padX = 36;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const totalSteps = steps.length - 1;
  const getX = (index: number) => padX + (index / totalSteps) * chartW;
  // 100% probA is at top (padY), 0% probA (100% probB) is at bottom (padY + chartH)
  const getY = (probA: number) => padY + ((100 - probA) / 100) * chartH;

  const linePoints = steps.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.probA).toFixed(1)}`).join(" ");

  // Find dagger play coordinates
  const daggerStepIndex = dagger ? steps.findIndex((s) => s.step === dagger.step) : -1;
  const daggerX = daggerStepIndex >= 0 ? getX(daggerStepIndex) : null;
  const daggerY = daggerStepIndex >= 0 ? getY(steps[daggerStepIndex].probA) : null;

  const currentHover = activeStep ?? steps[steps.length - 1];

  return (
    <div className="glass-2 space-y-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <div className="label text-court-ink">In-Game Flow</div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Win Probability &amp; Clutches
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1.5 text-court-ink">
            <span className="h-2 w-2 rounded-full bg-court-soft" />
            {teamNames.A}
          </span>
          <span className="flex items-center gap-1.5 text-sky-900">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {teamNames.B}
          </span>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative overflow-hidden rounded-2xl bg-white/40 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setActiveStep(null)}
        >
          <defs>
            {/* Top Team A Gradient */}
            <linearGradient id="gradTeamA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#15803d" stopOpacity="0.0" />
            </linearGradient>
            {/* Bottom Team B Gradient */}
            <linearGradient id="gradTeamB" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Advantage Zones */}
          <rect
            x={padX}
            y={padY}
            width={chartW}
            height={chartH / 2}
            fill="url(#gradTeamA)"
          />
          <rect
            x={padX}
            y={padY + chartH / 2}
            width={chartW}
            height={chartH / 2}
            fill="url(#gradTeamB)"
          />

          {/* 50% Neutral Baseline */}
          <line
            x1={padX}
            y1={padY + chartH / 2}
            x2={padX + chartW}
            y2={padY + chartH / 2}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={padX + 4}
            y={padY + chartH / 2 - 4}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
          >
            50% Even
          </text>

          {/* 100% Team A Top Line */}
          <text
            x={padX + 4}
            y={padY + 12}
            fill="#15803d"
            fontSize="10"
            fontWeight="800"
          >
            {teamNames.A} 100%
          </text>

          {/* 100% Team B Bottom Line */}
          <text
            x={padX + 4}
            y={padY + chartH - 4}
            fill="#0369a1"
            fontSize="10"
            fontWeight="800"
          >
            {teamNames.B} 100%
          </text>

          {/* Probability Polyline */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dagger Marker if present */}
          {daggerX !== null && daggerY !== null && (
            <g className="cursor-pointer">
              {/* Outer pulsing ring */}
              <circle
                cx={daggerX}
                cy={daggerY}
                r="11"
                fill="#f43f5e"
                opacity="0.3"
                className="animate-ping"
              />
              <circle
                cx={daggerX}
                cy={daggerY}
                r="7"
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={daggerX}
                y={daggerY - 10}
                textAnchor="middle"
                fontSize="14"
                className="select-none"
              >
                🗡️
              </text>
            </g>
          )}

          {/* Interactive Tap/Hover target points */}
          {steps.map((s, idx) => {
            const cx = getX(idx);
            const cy = getY(s.probA);
            const isActive = activeStep?.step === s.step;
            return (
              <g
                key={s.step}
                className="cursor-pointer"
                onMouseEnter={() => setActiveStep(s)}
                onClick={() => setActiveStep(s)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 6 : 4}
                  fill={isActive ? "#0f172a" : s.probA >= 50 ? "#15803d" : "#0284c7"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* Invisible wide hit target for mobile fingers */}
                <rect
                  x={cx - 10}
                  y={padY}
                  width={20}
                  height={chartH}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip below / inside the chart */}
        {currentHover && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold">
            <span className="text-ink">{currentHover.description}</span>
            <div className="flex items-center gap-2 tabular">
              <span className="text-court-ink">A: {currentHover.probA}%</span>
              <span className="text-muted">·</span>
              <span className="text-sky-900">B: {currentHover.probB}%</span>
              {currentHover.swingPct !== undefined && currentHover.swingPct > 0 && (
                <span className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] text-muted">
                  ±{currentHover.swingPct.toFixed(1)}% swing
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dagger Play Callout Card */}
      {dagger && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-lg shadow-inner">
              🗡️
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700">
                  The Dagger Play
                </span>
                <span className="rounded-full bg-rose-200/80 px-2 py-0.5 text-[10px] font-black text-rose-800">
                  +{dagger.swingPct}% Swing
                </span>
              </div>
              <div className="mt-0.5 text-sm font-black text-ink">
                {dagger.playerName} clinched the game
              </div>
              <p className="mt-0.5 text-xs text-rose-950/80">
                {dagger.description} · Pushed {winner ? `Team ${winner}` : "win"} probability to{" "}
                <span className="font-bold">{dagger.resultingProb}%</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

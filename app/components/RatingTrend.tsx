"use client";

import { useRef, useState } from "react";

export type TrendPoint = {
  gameId: number;
  /** "Oct 10" */
  date: string;
  rating: number;
  result: "W" | "L" | "T";
  /** The player's team first, e.g. "21–18". */
  score: string;
};

const W = 340;
const H = 190;
const ML = 30;
const MR = 14;
const MT = 22;
const MB = 26;

/**
 * One player's game rating over their latest games. A single line, so no legend: the heading says
 * what it is. Hover or tap the chart, or focus it and use the arrow keys, to read each game; the
 * readout above it follows. The game log under it on the page is the table version of the same data.
 */
export function RatingTrend({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const n = points.length;

  const ratings = points.map((p) => p.rating);
  let lo = Math.max(3, Math.floor(Math.min(...ratings)) - 1);
  let hi = Math.min(10, Math.ceil(Math.max(...ratings)) + 1);
  if (hi - lo < 3) {
    hi = Math.min(10, lo + 3);
    lo = Math.max(3, hi - 3);
  }
  const x = (i: number) => ML + (i * (W - ML - MR)) / Math.max(1, n - 1);
  const y = (v: number) => MT + ((hi - v) * (H - MT - MB)) / (hi - lo);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(lo).toFixed(1)} L${x(0).toFixed(1)} ${y(lo).toFixed(1)} Z`;

  const best = ratings.indexOf(Math.max(...ratings));
  const shown = points[active ?? n - 1];

  function nearest(clientX: number): number {
    const box = svg.current?.getBoundingClientRect();
    if (!box || box.width === 0) return n - 1;
    const vx = ((clientX - box.left) * W) / box.width;
    return Math.min(n - 1, Math.max(0, Math.round(((vx - ML) * (n - 1)) / (W - ML - MR))));
  }

  function onKey(e: React.KeyboardEvent) {
    const cur = active ?? n - 1;
    const next =
      e.key === "ArrowLeft" ? cur - 1 : e.key === "ArrowRight" ? cur + 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, next)));
  }

  return (
    <div className="glass-1 space-y-2 rounded-2xl p-3.5">
      {/* Readout: the value leads, then the game it belongs to. */}
      <div className="flex items-baseline justify-between gap-3" role="status" aria-live="polite">
        <div className="tabular text-3xl font-extrabold leading-8 tracking-tight">
          {shown.rating.toFixed(1)}
          <span className="text-sm font-bold text-muted">/10</span>
        </div>
        <div className="tabular text-right text-xs font-semibold text-muted">
          <span className={shown.result === "W" ? "text-win" : shown.result === "L" ? "text-loss" : ""}>
            {shown.result}
          </span>{" "}
          {shown.score} · {shown.date}
        </div>
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-label={`Rating over the last ${n} games, from ${points[0].rating.toFixed(1)} to ${points[n - 1].rating.toFixed(1)}. Use the left and right arrow keys to step through the games.`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-court"
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-pan-y select-none"
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerDown={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          aria-hidden
        >
          {/* hairline grid, with the scale on the left */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-ink/10" strokeWidth={1} />
              <text x={ML - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="currentColor" className="text-muted">
                {t}
              </text>
            </g>
          ))}

          <path d={area} style={{ fill: "var(--color-court)" }} opacity={0.1} />
          <path
            d={line}
            fill="none"
            style={{ stroke: "var(--color-court)" }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={MT - 6} y2={H - MB} stroke="currentColor" className="text-ink/25" strokeWidth={1} />
          )}

          {/* markers with a surface ring, so they stay clear where they meet the line */}
          {points.map((p, i) => (
            <circle
              key={p.gameId}
              cx={x(i)}
              cy={y(p.rating)}
              r={i === active ? 6 : 4.5}
              style={{ fill: "var(--color-court)" }}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}

          {/* label only the best game and the latest, never every point */}
          {best !== n - 1 && n > 2 && (
            <text x={x(best)} y={y(points[best].rating) - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor" className="text-ink">
              {points[best].rating.toFixed(1)}
            </text>
          )}
          <text
            x={x(n - 1)}
            y={y(points[n - 1].rating) - 10}
            textAnchor={n > 2 ? "end" : "middle"}
            fontSize={11}
            fontWeight={700}
            fill="currentColor"
            className="text-ink"
          >
            {points[n - 1].rating.toFixed(1)}
          </text>

          <text x={x(0)} y={H - 8} textAnchor="start" fontSize={10} fill="currentColor" className="text-muted">
            {points[0].date}
          </text>
          <text x={x(n - 1)} y={H - 8} textAnchor="end" fontSize={10} fill="currentColor" className="text-muted">
            {points[n - 1].date}
          </text>
        </svg>
      </div>
    </div>
  );
}

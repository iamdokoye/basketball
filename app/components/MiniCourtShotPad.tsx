"use client";

import { useState } from "react";
import type { ShotZoneId } from "@/lib/shotZones";
import { playClang, playSwish } from "@/lib/courtAudio";

export function MiniCourtShotPad({
  shooterName,
  onRecordShot,
}: {
  shooterName: string;
  onRecordShot: (zone: ShotZoneId, made: boolean, pts: 2 | 3) => void;
}) {
  const [shotOutcome, setShotOutcome] = useState<"make" | "miss">("make");

  function handleZoneTap(zone: ShotZoneId, pts: 2 | 3) {
    const isMade = shotOutcome === "make";
    if (isMade) playSwish();
    else playClang();
    onRecordShot(zone, isMade, pts);
  }

  return (
    <div className="glass-2 space-y-3 rounded-3xl p-4">
      {/* Header & Outcome Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="label text-court-ink">Shot Zone Tracker</div>
          <div className="text-xs font-black truncate">{shooterName}</div>
        </div>

        {/* Make / Miss Toggle Buttons */}
        <div className="flex rounded-full bg-black/[0.08] p-1 text-xs font-black">
          <button
            type="button"
            onClick={() => setShotOutcome("make")}
            className={`rounded-full px-3 py-1 transition ${
              shotOutcome === "make" ? "bg-win text-white shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            ✓ Make
          </button>
          <button
            type="button"
            onClick={() => setShotOutcome("miss")}
            className={`rounded-full px-3 py-1 transition ${
              shotOutcome === "miss" ? "bg-loss text-white shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            ✗ Miss
          </button>
        </div>
      </div>

      {/* Tappable Mini Court Diagram */}
      <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-paper border border-black/15 p-2">
        <svg viewBox="0 0 300 240" className="w-full h-auto select-none">
          {/* Court Perimeter */}
          <rect x="5" y="5" width="290" height="230" rx="8" className="fill-none stroke-black/20 stroke-[2]" />

          {/* Three-point arc boundaries */}
          <line x1="25" y1="5" x2="25" y2="70" className="stroke-black/20 stroke-[2]" />
          <line x1="275" y1="5" x2="275" y2="70" className="stroke-black/20 stroke-[2]" />
          <path d="M 25 70 A 125 125 0 0 0 275 70" className="fill-none stroke-black/20 stroke-[2]" />

          {/* Key & Basket */}
          <rect x="105" y="5" width="90" height="105" className="fill-none stroke-black/20 stroke-[2]" />
          <circle cx="150" cy="110" r="45" className="fill-none stroke-black/20 stroke-[2]" />
          <circle cx="150" cy="30" r="10" className="fill-none stroke-court-soft stroke-[2]" />

          {/* TAPPABLE ZONES */}

          {/* 1. Paint (2 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("paint", 2)}
          >
            <rect
              x="105"
              y="5"
              width="90"
              height="105"
              className="fill-black/[0.04] stroke-black/20 group-hover:fill-court-soft/30 transition stroke-[1.5]"
            />
            <text x="150" y="60" textAnchor="middle" className="fill-ink text-[11px] font-black pointer-events-none">
              Paint / Rim
            </text>
            <text x="150" y="75" textAnchor="middle" className="fill-court-ink text-[9px] font-black pointer-events-none">
              +2 PTS
            </text>
          </g>

          {/* 2. Mid Left (2 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("mid_left", 2)}
          >
            <path
              d="M 25 5 L 105 5 L 105 110 L 25 70 Z"
              className="fill-black/[0.03] stroke-black/20 group-hover:fill-court-soft/30 transition stroke-[1.5]"
            />
            <text x="65" y="50" textAnchor="middle" className="fill-ink text-[10px] font-black pointer-events-none">
              Mid Left
            </text>
            <text x="65" y="65" textAnchor="middle" className="fill-court-ink text-[9px] font-black pointer-events-none">
              +2 PTS
            </text>
          </g>

          {/* 3. Mid Right (2 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("mid_right", 2)}
          >
            <path
              d="M 195 5 L 275 5 L 275 70 L 195 110 Z"
              className="fill-black/[0.03] stroke-black/20 group-hover:fill-court-soft/30 transition stroke-[1.5]"
            />
            <text x="235" y="50" textAnchor="middle" className="fill-ink text-[10px] font-black pointer-events-none">
              Mid Right
            </text>
            <text x="235" y="65" textAnchor="middle" className="fill-court-ink text-[9px] font-black pointer-events-none">
              +2 PTS
            </text>
          </g>

          {/* 4. Left 3PT (3 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("three_left", 3)}
          >
            <path
              d="M 5 5 L 25 5 L 25 70 A 125 125 0 0 0 95 160 L 5 230 Z"
              className="fill-black/[0.04] stroke-black/20 group-hover:fill-amber-500/25 transition stroke-[1.5]"
            />
            <text x="45" y="140" textAnchor="middle" className="fill-ink text-[10px] font-black pointer-events-none">
              3PT Left
            </text>
            <text x="45" y="155" textAnchor="middle" className="fill-amber-700 text-[9px] font-black pointer-events-none">
              +3 PTS
            </text>
          </g>

          {/* 5. Right 3PT (3 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("three_right", 3)}
          >
            <path
              d="M 275 5 L 295 5 L 295 230 L 205 160 A 125 125 0 0 0 275 70 Z"
              className="fill-black/[0.04] stroke-black/20 group-hover:fill-amber-500/25 transition stroke-[1.5]"
            />
            <text x="255" y="140" textAnchor="middle" className="fill-ink text-[10px] font-black pointer-events-none">
              3PT Right
            </text>
            <text x="255" y="155" textAnchor="middle" className="fill-amber-700 text-[9px] font-black pointer-events-none">
              +3 PTS
            </text>
          </g>

          {/* 6. Top 3PT (3 PTS) */}
          <g
            className="cursor-pointer group"
            onClick={() => handleZoneTap("three_top", 3)}
          >
            <path
              d="M 95 160 A 125 125 0 0 0 205 160 L 295 230 L 5 230 Z"
              className="fill-black/[0.04] stroke-black/20 group-hover:fill-amber-500/25 transition stroke-[1.5]"
            />
            <text x="150" y="190" textAnchor="middle" className="fill-ink text-[11px] font-black pointer-events-none">
              Top 3PT (Arc)
            </text>
            <text x="150" y="205" textAnchor="middle" className="fill-amber-700 text-[9px] font-black pointer-events-none">
              +3 PTS
            </text>
          </g>
        </svg>
      </div>
      <p className="text-center text-[11px] text-muted font-medium">
        Tap court zone to record {shotOutcome === "make" ? "made bucket" : "miss"} from spot.
      </p>
    </div>
  );
}

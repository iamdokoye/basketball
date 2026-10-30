"use client";

import { useState } from "react";
import type { PlayerShotProfile, ShotZoneId } from "@/lib/shotZones";

export function ShotHeatmap({ profile }: { profile: PlayerShotProfile }) {
  const [selectedZone, setSelectedZone] = useState<ShotZoneId>("paint");
  const activeZone = profile.zones[selectedZone];

  const zoneColor = (zoneId: ShotZoneId) => {
    const z = profile.zones[zoneId];
    if (z.fga === 0) return "fill-black/[0.03] stroke-black/15";
    if (z.status === "hot") return "fill-amber-500/30 stroke-amber-500 hover:fill-amber-500/40";
    if (z.status === "cold") return "fill-sky-500/25 stroke-sky-400 hover:fill-sky-500/35";
    return "fill-black/[0.07] stroke-black/20 hover:fill-black/[0.12]";
  };

  return (
    <div className="glass-1 space-y-4 rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label text-court-ink">Shooting Efficiency</div>
          <h2 className="text-base font-extrabold tracking-tight">Shot Chart &amp; Heatmap</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">
            🔥 Hot
          </span>
          <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-700">
            ❄️ Cold
          </span>
        </div>
      </div>

      {/* SVG Court Canvas */}
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-paper/90 border border-black/10 p-2 shadow-inner">
        <svg
          viewBox="0 0 300 240"
          className="w-full h-auto select-none"
        >
          {/* Court Perimeter */}
          <rect x="5" y="5" width="290" height="230" rx="10" className="fill-none stroke-black/25 stroke-[2]" />

          {/* Three-point arc: Center at (150, 20), radius 130 */}
          {/* Left corner 3 boundary */}
          <line x1="25" y1="5" x2="25" y2="70" className="stroke-black/25 stroke-[2]" />
          {/* Right corner 3 boundary */}
          <line x1="275" y1="5" x2="275" y2="70" className="stroke-black/25 stroke-[2]" />
          {/* Arc path */}
          <path
            d="M 25 70 A 125 125 0 0 0 275 70"
            className="fill-none stroke-black/25 stroke-[2]"
          />

          {/* Key / Paint area (100 to 200, y=5 to 110) */}
          <rect x="105" y="5" width="90" height="105" className="fill-none stroke-black/25 stroke-[2]" />

          {/* Free throw circle (center 150, 110, radius 45) */}
          <circle cx="150" cy="110" r="45" className="fill-none stroke-black/25 stroke-[2]" />
          <line x1="105" y1="110" x2="195" y2="110" className="stroke-black/25 stroke-[2]" />

          {/* Restricted area / Basket (center 150, 30) */}
          <circle cx="150" cy="30" r="12" className="fill-none stroke-court-soft stroke-[2.5]" />
          <line x1="135" y1="18" x2="165" y2="18" className="stroke-black/40 stroke-[3]" />

          {/* INTERACTIVE ZONE REGIONS */}

          {/* 1. Paint Zone */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("paint")}
          >
            <rect
              x="105"
              y="5"
              width="90"
              height="105"
              className={`${zoneColor("paint")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "paint" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="150" y="65" textAnchor="middle" className="fill-ink text-[13px] font-black pointer-events-none">
              {profile.zones.paint.pct}%
            </text>
            <text x="150" y="80" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.paint.fgm}/{profile.zones.paint.fga}
            </text>
          </g>

          {/* 2. Mid-Range Left */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("mid_left")}
          >
            <path
              d="M 25 5 L 105 5 L 105 110 L 25 70 Z"
              className={`${zoneColor("mid_left")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "mid_left" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="65" y="55" textAnchor="middle" className="fill-ink text-[12px] font-black pointer-events-none">
              {profile.zones.mid_left.pct}%
            </text>
            <text x="65" y="70" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.mid_left.fgm}/{profile.zones.mid_left.fga}
            </text>
          </g>

          {/* 3. Mid-Range Right */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("mid_right")}
          >
            <path
              d="M 195 5 L 275 5 L 275 70 L 195 110 Z"
              className={`${zoneColor("mid_right")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "mid_right" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="235" y="55" textAnchor="middle" className="fill-ink text-[12px] font-black pointer-events-none">
              {profile.zones.mid_right.pct}%
            </text>
            <text x="235" y="70" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.mid_right.fgm}/{profile.zones.mid_right.fga}
            </text>
          </g>

          {/* 4. Left 3PT */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("three_left")}
          >
            <path
              d="M 5 5 L 25 5 L 25 70 A 125 125 0 0 0 95 160 L 5 230 Z"
              className={`${zoneColor("three_left")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "three_left" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="45" y="145" textAnchor="middle" className="fill-ink text-[12px] font-black pointer-events-none">
              {profile.zones.three_left.pct}%
            </text>
            <text x="45" y="160" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.three_left.fgm}/{profile.zones.three_left.fga}
            </text>
          </g>

          {/* 5. Right 3PT */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("three_right")}
          >
            <path
              d="M 275 5 L 295 5 L 295 230 L 205 160 A 125 125 0 0 0 275 70 Z"
              className={`${zoneColor("three_right")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "three_right" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="255" y="145" textAnchor="middle" className="fill-ink text-[12px] font-black pointer-events-none">
              {profile.zones.three_right.pct}%
            </text>
            <text x="255" y="160" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.three_right.fgm}/{profile.zones.three_right.fga}
            </text>
          </g>

          {/* 6. Top 3PT */}
          <g
            className="cursor-pointer transition-transform active:scale-[0.99]"
            onClick={() => setSelectedZone("three_top")}
          >
            <path
              d="M 95 160 A 125 125 0 0 0 205 160 L 295 230 L 5 230 Z"
              className={`${zoneColor("three_top")} transition-colors duration-200 stroke-[2] ${
                selectedZone === "three_top" ? "stroke-court-ink stroke-[3]" : ""
              }`}
            />
            <text x="150" y="195" textAnchor="middle" className="fill-ink text-[13px] font-black pointer-events-none">
              {profile.zones.three_top.pct}%
            </text>
            <text x="150" y="210" textAnchor="middle" className="fill-muted text-[9px] font-bold pointer-events-none">
              {profile.zones.three_top.fgm}/{profile.zones.three_top.fga}
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Zone Detail Card */}
      {activeZone && (
        <div className="rounded-2xl bg-white/70 border border-black/5 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black">{activeZone.label}</span>
              <span className="rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted">
                {activeZone.pts} PTS
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                activeZone.status === "hot"
                  ? "bg-amber-500/20 text-amber-800"
                  : activeZone.status === "cold"
                  ? "bg-sky-500/20 text-sky-800"
                  : "bg-black/[0.06] text-muted"
              }`}
            >
              {activeZone.status === "hot" ? "🔥 Hot Zone" : activeZone.status === "cold" ? "❄️ Cold Zone" : "Average"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-black/5 text-xs">
            <div>
              <div className="text-[10px] text-muted font-bold">EFFICIENCY</div>
              <div className="tabular font-black text-base">{activeZone.pct}%</div>
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold">MADE / ATT</div>
              <div className="tabular font-extrabold text-base">
                {activeZone.fgm} / {activeZone.fga}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold">FREQUENCY</div>
              <div className="tabular font-black text-base">{activeZone.frequency}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Shot Distribution Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-xs font-bold text-muted">
          <span>Shot Breakdown</span>
          <span>{profile.totalFga} total shots</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            style={{ width: `${profile.distribution.paint}%` }}
            className="bg-court-ink transition-all"
            title={`Paint: ${profile.distribution.paint}%`}
          />
          <div
            style={{ width: `${profile.distribution.midRange}%` }}
            className="bg-court-soft transition-all"
            title={`Mid-Range: ${profile.distribution.midRange}%`}
          />
          <div
            style={{ width: `${profile.distribution.three}%` }}
            className="bg-zinc-700 transition-all"
            title={`3PT: ${profile.distribution.three}%`}
          />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-muted">
          <span>Paint {profile.distribution.paint}%</span>
          <span>Mid-Range {profile.distribution.midRange}%</span>
          <span>3-Point {profile.distribution.three}%</span>
        </div>
      </div>
    </div>
  );
}

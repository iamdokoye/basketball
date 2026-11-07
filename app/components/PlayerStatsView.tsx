"use client";

import { useState } from "react";
import type { CareerLine } from "@/lib/queries";
import {
  fmtAvg,
  fmtEfg,
  fmtMinutes,
  fmtPct,
  fmtSigned,
  fmtTs,
} from "@/lib/stats";

export function PlayerStatsView({
  career,
  pickupCareer,
  timedCareer,
}: {
  career: CareerLine;
  pickupCareer?: CareerLine;
  timedCareer?: CareerLine;
}) {
  const [format, setFormat] = useState<"all" | "target" | "timed">("all");
  const [mode, setMode] = useState<"averages" | "totals">("averages");
  const [showAllFields, setShowAllFields] = useState(false);

  const hasBothFormats = Boolean(
    pickupCareer &&
      timedCareer &&
      pickupCareer.gp > 0 &&
      timedCareer.gp > 0,
  );

  const c =
    format === "target" && pickupCareer
      ? pickupCareer
      : format === "timed" && timedCareer
        ? timedCareer
        : career;

  const gp = c.gp;

  // 12 Standard Per-Game Averages
  const averageCards: { label: string; value: string; sub?: string }[] = [
    { label: "PPG", value: fmtAvg(c.pts, gp), sub: `${c.pts} total pts` },
    { label: "RPG", value: fmtAvg(c.reb, gp), sub: `${c.reb} total reb` },
    { label: "APG", value: fmtAvg(c.ast, gp), sub: `${c.ast} total ast` },
    { label: "SPG", value: fmtAvg(c.stl, gp), sub: `${c.stl} total stl` },
    { label: "BPG", value: fmtAvg(c.blk, gp), sub: `${c.blk} total blk` },
    { label: "TOPG", value: fmtAvg(c.tov, gp), sub: `${c.tov} total tov` },
    { label: "FG%", value: fmtPct(c.fgm, c.fga), sub: `${c.fgm}/${c.fga} FGM` },
    { label: "3P%", value: fmtPct(c.fg3m, c.fg3a), sub: `${c.fg3m}/${c.fg3a} 3PM` },
    { label: "FT%", value: fmtPct(c.ftm, c.fta), sub: `${c.ftm}/${c.fta} FTM` },
    { label: "eFG%", value: fmtEfg(c), sub: "effective FG%" },
    { label: "TS%", value: fmtTs(c), sub: "true shooting" },
    { label: "+/-", value: gp ? fmtSigned(c.plusMinus / gp, 1) : "–", sub: `${fmtSigned(c.plusMinus)} total` },
  ];

  // Comprehensive Total Career / Season Stats for Each Field
  const totalCards: { label: string; value: string; sub?: string }[] = [
    { label: "Total Points", value: c.pts.toLocaleString(), sub: `${fmtAvg(c.pts, gp)} PPG` },
    { label: "Total Rebounds", value: c.reb.toLocaleString(), sub: `${c.oreb} OFF · ${c.dreb} DEF` },
    { label: "Total Assists", value: c.ast.toLocaleString(), sub: `${fmtAvg(c.ast, gp)} APG` },
    { label: "Total Steals", value: c.stl.toLocaleString(), sub: `${fmtAvg(c.stl, gp)} SPG` },
    { label: "Total Blocks", value: c.blk.toLocaleString(), sub: `${fmtAvg(c.blk, gp)} BPG` },
    { label: "Total FGM/FGA", value: `${c.fgm}/${c.fga}`, sub: `${fmtPct(c.fgm, c.fga)} FG%` },
    { label: "Total 3PM/3PA", value: `${c.fg3m}/${c.fg3a}`, sub: `${fmtPct(c.fg3m, c.fg3a)} 3P%` },
    { label: "Total 2PM/2PA", value: `${c.fg2m}/${c.fg2a}`, sub: `${fmtPct(c.fg2m, c.fg2a)} 2P%` },
    { label: "Total FTM/FTA", value: `${c.ftm}/${c.fta}`, sub: `${fmtPct(c.ftm, c.fta)} FT%` },
    { label: "Total Turnovers", value: c.tov.toLocaleString(), sub: `A/TO: ${c.tov ? (c.ast / c.tov).toFixed(2) : c.ast}` },
    { label: "Deflections", value: c.defl.toLocaleString(), sub: `${fmtAvg(c.defl, gp)} DEFL/G` },
    { label: "Personal Fouls", value: c.pf.toLocaleString(), sub: `${fmtAvg(c.pf, gp)} PF/G` },
    { label: "Court Minutes", value: fmtMinutes(c.sec), sub: `${gp ? fmtMinutes(c.sec / gp) : "–"} /g` },
    { label: "Cumulative +/-", value: fmtSigned(c.plusMinus), sub: `${gp ? fmtSigned(c.plusMinus / gp, 1) : "–"} /g` },
    { label: "Games Played", value: String(c.gp), sub: `${c.wins}W - ${c.losses}L` },
    { label: "Win Rate", value: `${gp ? Math.round((c.wins / gp) * 100) : 0}%`, sub: `${c.wins} Wins` },
  ];

  const cardsToDisplay = mode === "totals" ? totalCards : averageCards;

  // Breakdown rows grouped by category for the full fields table
  const allFields = [
    {
      category: "Scoring Fields",
      rows: [
        { field: "Points (PTS)", total: c.pts, avg: fmtAvg(c.pts, gp), efficiency: "–" },
        { field: "Field Goals (FGM / FGA)", total: `${c.fgm} / ${c.fga}`, avg: `${fmtAvg(c.fgm, gp)} / ${fmtAvg(c.fga, gp)}`, efficiency: fmtPct(c.fgm, c.fga) },
        { field: "2-Point Shots (2PM / 2PA)", total: `${c.fg2m} / ${c.fg2a}`, avg: `${fmtAvg(c.fg2m, gp)} / ${fmtAvg(c.fg2a, gp)}`, efficiency: fmtPct(c.fg2m, c.fg2a) },
        { field: "3-Point Shots (3PM / 3PA)", total: `${c.fg3m} / ${c.fg3a}`, avg: `${fmtAvg(c.fg3m, gp)} / ${fmtAvg(c.fg3a, gp)}`, efficiency: fmtPct(c.fg3m, c.fg3a) },
        { field: "Free Throws (FTM / FTA)", total: `${c.ftm} / ${c.fta}`, avg: `${fmtAvg(c.ftm, gp)} / ${fmtAvg(c.fta, gp)}`, efficiency: fmtPct(c.ftm, c.fta) },
        { field: "Effective Field Goal % (eFG%)", total: "–", avg: "–", efficiency: fmtEfg(c) },
        { field: "True Shooting % (TS%)", total: "–", avg: "–", efficiency: fmtTs(c) },
      ],
    },
    {
      category: "Rebounding Fields",
      rows: [
        { field: "Total Rebounds (REB)", total: c.reb, avg: fmtAvg(c.reb, gp), efficiency: "–" },
        { field: "Offensive Rebounds (OREB)", total: c.oreb, avg: fmtAvg(c.oreb, gp), efficiency: c.reb ? `${Math.round((c.oreb / c.reb) * 100)}% of reb` : "–" },
        { field: "Defensive Rebounds (DREB)", total: c.dreb, avg: fmtAvg(c.dreb, gp), efficiency: c.reb ? `${Math.round((c.dreb / c.reb) * 100)}% of reb` : "–" },
      ],
    },
    {
      category: "Playmaking & Ball Control",
      rows: [
        { field: "Assists (AST)", total: c.ast, avg: fmtAvg(c.ast, gp), efficiency: "–" },
        { field: "Turnovers (TOV)", total: c.tov, avg: fmtAvg(c.tov, gp), efficiency: "–" },
        { field: "Assist / Turnover Ratio", total: c.tov ? (c.ast / c.tov).toFixed(2) : String(c.ast), avg: "–", efficiency: c.tov && c.ast / c.tov >= 2 ? "Elite" : "Standard" },
      ],
    },
    {
      category: "Defense & Hustle Fields",
      rows: [
        { field: "Steals (STL)", total: c.stl, avg: fmtAvg(c.stl, gp), efficiency: "–" },
        { field: "Blocks (BLK)", total: c.blk, avg: fmtAvg(c.blk, gp), efficiency: "–" },
        { field: "Deflections (DEFL)", total: c.defl, avg: fmtAvg(c.defl, gp), efficiency: "–" },
        { field: "Personal Fouls (PF)", total: c.pf, avg: fmtAvg(c.pf, gp), efficiency: "–" },
      ],
    },
    {
      category: "Participation & Impact",
      rows: [
        { field: "Games Played (GP)", total: c.gp, avg: "–", efficiency: "–" },
        { field: "Win - Loss Record (W-L)", total: `${c.wins} - ${c.losses}`, avg: "–", efficiency: `${gp ? Math.round((c.wins / gp) * 100) : 0}% Win Rate` },
        { field: "Total Court Time", total: fmtMinutes(c.sec), avg: gp ? fmtMinutes(c.sec / gp) : "–", efficiency: "–" },
        { field: "Cumulative Plus/Minus (+/-)", total: fmtSigned(c.plusMinus), avg: gp ? fmtSigned(c.plusMinus / gp, 1) : "–", efficiency: c.plusMinus > 0 ? "Positive Net" : "–" },
      ],
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* Format & Mode Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="label text-xs">Stats &amp; Box Performance</div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher (Only visible when player has participated in multiple formats) */}
          {hasBothFormats && (
            <div className="flex rounded-full bg-black/[0.06] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormat("all")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  format === "all"
                    ? "bg-ink text-paper shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                All ({career.gp})
              </button>
              <button
                type="button"
                onClick={() => setFormat("target")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  format === "target"
                    ? "bg-court-ink text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                First to 20 ({pickupCareer?.gp})
              </button>
              <button
                type="button"
                onClick={() => setFormat("timed")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  format === "timed"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                Timed ({timedCareer?.gp})
              </button>
            </div>
          )}

          {/* Segmented Switcher (Avg vs Totals) */}
          <div className="flex rounded-full bg-black/[0.06] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode("averages")}
              className={`rounded-full px-3 py-1 transition-all ${
                mode === "averages"
                  ? "bg-ink text-paper shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              Per Game (Avg)
            </button>
            <button
              type="button"
              onClick={() => setMode("totals")}
              className={`rounded-full px-3 py-1 transition-all ${
                mode === "totals"
                  ? "bg-court-ink text-white shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              Totals (All Fields)
            </button>
          </div>

          {/* Toggle Full Fields Table */}
          <button
            type="button"
            onClick={() => setShowAllFields(!showAllFields)}
            className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-bold text-muted hover:bg-black/10 hover:text-ink transition"
          >
            {showAllFields ? "Hide Breakdown" : "All Fields Breakdown"}
          </button>
        </div>
      </div>

      {hasBothFormats && (
        <p className="px-1 text-[11px] text-muted">
          {format === "target" && (
            <span>Showing stats from <strong>First to 20 pickup games only</strong> ({pickupCareer?.gp} games).</span>
          )}
          {format === "timed" && (
            <span>Showing stats from <strong>Timed regulation games only</strong> ({timedCareer?.gp} games).</span>
          )}
          {format === "all" && (
            <span>Combined career across all formats ({pickupCareer?.gp} pickup games, {timedCareer?.gp} timed games).</span>
          )}
        </p>
      )}

      {/* Dynamic Stat Cards Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {cardsToDisplay.map((card) => (
          <div
            key={card.label}
            className={`glass-1 flex flex-col justify-between rounded-2xl p-3 text-center transition-all ${
              mode === "totals" ? "border border-court-soft/30 hover:border-court-ink/40" : ""
            }`}
          >
            <div className="tabular text-2xl font-black tracking-tight text-ink">
              {card.value}
            </div>
            <div className="mt-0.5">
              <div className="label text-muted text-[10px] sm:text-xs">
                {card.label}
              </div>
              {card.sub && (
                <div className="text-[10px] font-semibold text-court-ink truncate">
                  {card.sub}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive All-Fields Breakdown Table */}
      {showAllFields && (
        <div className="glass-1 space-y-4 rounded-3xl p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div>
              <h3 className="text-base font-extrabold text-ink">
                Complete Statistical Fields Breakdown
              </h3>
              <p className="text-xs text-muted">
                Career totals, per-game averages, and shooting splits for every tracked metric.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {allFields.map((group) => (
              <div key={group.category} className="space-y-1.5">
                <div className="label text-[11px] text-court-ink">{group.category}</div>
                <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/60">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black/5 bg-black/[0.02] text-muted">
                        <th className="px-3 py-2 font-bold">Field Metric</th>
                        <th className="px-3 py-2 text-right font-bold text-ink">Total Stat</th>
                        <th className="px-3 py-2 text-right font-bold text-muted">Per Game</th>
                        <th className="px-3 py-2 text-right font-bold text-muted">Efficiency / Split</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {group.rows.map((row) => (
                        <tr key={row.field} className="hover:bg-black/[0.02] transition-colors">
                          <td className="px-3 py-2 font-semibold text-ink">{row.field}</td>
                          <td className="px-3 py-2 text-right font-black tabular text-court-ink">
                            {row.total}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular text-muted">
                            {row.avg}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular text-muted">
                            {row.efficiency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

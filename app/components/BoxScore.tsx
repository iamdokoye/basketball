"use client";

import { useState } from "react";
import Link from "next/link";
import { gameContext, rateLine } from "@/lib/rating";
import type { PlayerAdvancedStats } from "@/lib/analytics";
import {
  fmtEfg,
  fmtMinutes,
  fmtPct,
  fmtSigned,
  fmtTs,
  type StatLine,
  type Team,
} from "@/lib/stats";

/** Colour a 0-10 rating: strong games green, poor games red, the rest plain. */
function ratingTone(r: number | undefined): string {
  return r === undefined
    ? "text-muted"
    : r >= 8
      ? "text-win"
      : r < 6
        ? "text-loss"
        : "";
}

function gameScoreTone(gs: number): string {
  if (gs >= 12) return "text-win font-black";
  if (gs < 2) return "text-loss";
  return "text-ink font-bold";
}

const TRAD_HEAD = [
  "PTS",
  "RTG",
  "FG",
  "2P",
  "3P",
  "FT",
  "REB",
  "AST",
  "STL",
  "BLK",
  "TO",
  "PF",
  "+/-",
  "MIN",
];

const ADV_HEAD = [
  "PTS",
  "GmSc",
  "TS%",
  "eFG%",
  "USG%",
  "AST%",
  "TOV%",
  "+/-",
  "MIN",
];

const SUM_KEYS = [
  "pts",
  "fgm",
  "fga",
  "fg2m",
  "fg2a",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "pf",
] as const;

export function BoxScoreTable({
  lines,
  team,
  pogId,
  svpId,
  target,
  gameType = "target",
  quarterMinutes,
  quarterCount,
  advanced,
}: {
  lines: StatLine[];
  team: Team;
  /** Player of the game (MVP), marked with a star. */
  pogId?: number;
  /** Second Valuable Player (SVP), marked with a shield. */
  svpId?: number;
  /** Winning target score for pace normalization. */
  target?: number;
  gameType?: "target" | "timed";
  quarterMinutes?: number;
  quarterCount?: number;
  advanced?: PlayerAdvancedStats[];
}) {
  const [mode, setMode] = useState<"traditional" | "advanced">("traditional");
  const rows = lines.filter((l) => l.team === team);
  const total = Object.fromEntries(
    SUM_KEYS.map((k) => [k, rows.reduce((t, l) => t + l[k], 0)]),
  ) as Record<(typeof SUM_KEYS)[number], number>;
  const ctx = gameContext(lines, target, { gameType, quarterMinutes, quarterCount });
  const accent = team === "A" ? "bg-court-soft" : "bg-away-soft";

  const advMap = new Map<number, PlayerAdvancedStats>(
    (advanced ?? []).map((a) => [a.playerId, a]),
  );

  const cell = "px-2 py-2 text-right";
  const stickyName = "sticky-cell px-3 py-2 text-left";

  const hasAdvanced = Boolean(advanced && advanced.length > 0);

  return (
    <div className="glass-2 overflow-hidden rounded-2xl">
      <div className="label hairline flex items-center justify-between border-b px-3 py-2.5 text-muted">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <span>Team {team}</span>
        </div>

        {hasAdvanced && (
          <div className="flex items-center rounded-full bg-black/[0.05] p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMode("traditional")}
              className={`rounded-full px-2.5 py-0.5 transition ${
                mode === "traditional"
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Traditional
            </button>
            <button
              type="button"
              onClick={() => setMode("advanced")}
              className={`rounded-full px-2.5 py-0.5 transition ${
                mode === "advanced"
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Advanced
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tabular w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="label text-muted">
              <th className={`${stickyName} font-semibold`}>Player</th>
              {(mode === "traditional" ? TRAD_HEAD : ADV_HEAD).map((h) => (
                <th key={h} className={`${cell} font-semibold`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((l) => {
              const adv = advMap.get(l.playerId);
              return (
                <tr key={l.playerId}>
                  <td className={`${stickyName} font-semibold`}>
                    <Link
                      href={`/players/${l.playerId}`}
                      className="hover:underline"
                    >
                      {l.name}
                    </Link>
                    {!rateLine(l, ctx) && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        DNP
                      </span>
                    )}
                    {l.playerId === pogId && (
                      <span
                        title="Player of the game (MVP)"
                        aria-label="Player of the game"
                        className="ml-1 text-court-soft"
                      >
                        ★
                      </span>
                    )}
                    {l.playerId === svpId && (
                      <span
                        title="SVP (Star of the Vanquished Party)"
                        aria-label="SVP"
                        className="ml-1 text-slate-500"
                      >
                        🛡️
                      </span>
                    )}
                  </td>

                  {mode === "traditional" ? (
                    <>
                      <td className={`${cell} font-extrabold`}>{l.pts}</td>
                      <td
                        className={`${cell} font-bold ${ratingTone(rateLine(l, ctx)?.rating)}`}
                      >
                        {rateLine(l, ctx)?.rating.toFixed(1) ?? "–"}
                      </td>
                      <td className={cell}>
                        {l.fgm}-{l.fga}
                      </td>
                      <td className={cell}>
                        {l.fg2m}-{l.fg2a}
                      </td>
                      <td className={cell}>
                        {l.fg3m}-{l.fg3a}
                      </td>
                      <td className={cell}>
                        {l.ftm}-{l.fta}
                      </td>
                      <td className={cell}>{l.reb}</td>
                      <td className={cell}>{l.ast}</td>
                      <td className={cell}>{l.stl}</td>
                      <td className={cell}>{l.blk}</td>
                      <td className={cell}>{l.tov}</td>
                      <td className={cell}>{l.pf}</td>
                      <td
                        className={`${cell} font-semibold ${
                          l.plusMinus > 0
                            ? "text-win"
                            : l.plusMinus < 0
                              ? "text-loss"
                              : ""
                        }`}
                      >
                        {fmtSigned(l.plusMinus)}
                      </td>
                      <td className={`${cell} text-muted`}>{fmtMinutes(l.sec)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`${cell} font-extrabold`}>{l.pts}</td>
                      <td className={`${cell} ${gameScoreTone(adv?.gameScore ?? 0)}`}>
                        {adv ? adv.gameScore.toFixed(1) : "–"}
                      </td>
                      <td className={cell}>{adv ? `${adv.tsPct}%` : "–"}</td>
                      <td className={cell}>{adv ? `${adv.efgPct}%` : "–"}</td>
                      <td className={cell}>{adv ? `${adv.usgPct}%` : "–"}</td>
                      <td className={cell}>{adv ? `${adv.astPct}%` : "–"}</td>
                      <td className={cell}>{adv ? `${adv.tovPct}%` : "–"}</td>
                      <td
                        className={`${cell} font-semibold ${
                          l.plusMinus > 0
                            ? "text-win"
                            : l.plusMinus < 0
                              ? "text-loss"
                              : ""
                        }`}
                      >
                        {fmtSigned(l.plusMinus)}
                      </td>
                      <td className={`${cell} text-muted`}>{fmtMinutes(l.sec)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="hairline border-t bg-white/40 font-bold">
              <td className={stickyName}>Total</td>
              {mode === "traditional" ? (
                <>
                  <td className={cell}>{total.pts}</td>
                  <td className={cell} />
                  <td className={cell}>
                    {total.fgm}-{total.fga}
                  </td>
                  <td className={cell}>
                    {total.fg2m}-{total.fg2a}
                  </td>
                  <td className={cell}>
                    {total.fg3m}-{total.fg3a}
                  </td>
                  <td className={cell}>
                    {total.ftm}-{total.fta}
                  </td>
                  <td className={cell}>{total.reb}</td>
                  <td className={cell}>{total.ast}</td>
                  <td className={cell}>{total.stl}</td>
                  <td className={cell}>{total.blk}</td>
                  <td className={cell}>{total.tov}</td>
                  <td className={cell}>{total.pf}</td>
                  <td className={cell} />
                  <td className={cell} />
                </>
              ) : (
                <>
                  <td className={cell}>{total.pts}</td>
                  <td className={cell} />
                  <td className={cell}>
                    {fmtTs({ pts: total.pts, fga: total.fga, fta: total.fta })}
                  </td>
                  <td className={cell}>
                    {fmtEfg({ fgm: total.fgm, fg3m: total.fg3m, fga: total.fga })}
                  </td>
                  <td className={cell}>100%</td>
                  <td className={cell}>–</td>
                  <td className={cell}>–</td>
                  <td className={cell} />
                  <td className={cell} />
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="hairline border-t px-3 py-2 text-xs text-muted">
        {mode === "traditional" ? (
          <>
            FG {fmtPct(total.fgm, total.fga)} (2P + 3P) · 2P{" "}
            {fmtPct(total.fg2m, total.fg2a)} · 3P {fmtPct(total.fg3m, total.fg3a)} ·
            FT {fmtPct(total.ftm, total.fta)} · eFG{" "}
            {fmtEfg({ fgm: total.fgm, fg3m: total.fg3m, fga: total.fga })} · TS{" "}
            {fmtTs({ pts: total.pts, fga: total.fga, fta: total.fta })}
          </>
        ) : (
          <>
            GmSc (Game Score) · TS% (True Shooting %) · eFG% (Effective FG %) · USG% (Usage Rate %) · AST% (Assist Share %) · TOV% (Turnover Rate %)
          </>
        )}
      </div>
    </div>
  );
}

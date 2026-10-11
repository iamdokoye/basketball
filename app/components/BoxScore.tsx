import Link from "next/link";
import { fmtEfg, fmtMinutes, fmtPct, fmtSigned, fmtTs, type StatLine, type Team } from "@/lib/stats";

const HEAD = ["PTS", "FG", "3P", "FT", "REB", "AST", "STL", "BLK", "TO", "PF", "+/-", "MIN"];

const SUM_KEYS = [
  "pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "reb", "ast", "stl", "blk", "tov", "pf",
] as const;

export function BoxScoreTable({ lines, team }: { lines: StatLine[]; team: Team }) {
  const rows = lines.filter((l) => l.team === team);
  const total = Object.fromEntries(SUM_KEYS.map((k) => [k, rows.reduce((t, l) => t + l[k], 0)])) as Record<
    (typeof SUM_KEYS)[number],
    number
  >;
  const accent = team === "A" ? "bg-court-soft" : "bg-away-soft";

  const cell = "px-2 py-2 text-right";
  const stickyName = "sticky-cell px-3 py-2 text-left";

  return (
    <div className="glass-2 overflow-hidden rounded-2xl">
      <div className="label hairline flex items-center gap-2 border-b px-3 py-2.5 text-muted">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        Team {team}
      </div>
      <div className="overflow-x-auto">
        <table className="tabular w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="label text-muted">
              <th className={`${stickyName} font-semibold`}>Player</th>
              {HEAD.map((h) => (
                <th key={h} className={`${cell} font-semibold`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((l) => (
              <tr key={l.playerId}>
                <td className={`${stickyName} font-semibold`}>
                  <Link href={`/players/${l.playerId}`} className="hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className={`${cell} font-extrabold`}>{l.pts}</td>
                <td className={cell}>
                  {l.fgm}-{l.fga}
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
                    l.plusMinus > 0 ? "text-win" : l.plusMinus < 0 ? "text-loss" : ""
                  }`}
                >
                  {fmtSigned(l.plusMinus)}
                </td>
                <td className={`${cell} text-muted`}>{fmtMinutes(l.sec)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="hairline border-t bg-white/40 font-bold">
              <td className={stickyName}>Total</td>
              <td className={cell}>{total.pts}</td>
              <td className={cell}>
                {total.fgm}-{total.fga}
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
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="hairline border-t px-3 py-2 text-xs text-muted">
        FG {fmtPct(total.fgm, total.fga)} · 3P {fmtPct(total.fg3m, total.fg3a)} · FT{" "}
        {fmtPct(total.ftm, total.fta)} · eFG{" "}
        {fmtEfg({ fgm: total.fgm, fg3m: total.fg3m, fga: total.fga })} · TS{" "}
        {fmtTs({ pts: total.pts, fga: total.fga, fta: total.fta })}
      </div>
    </div>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

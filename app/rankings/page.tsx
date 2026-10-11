import Link from "next/link";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { fmtAvg, fmtPct, fmtSigned } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { RankBadge } from "@/app/components/RankBadge";
import { SortPills } from "./SortPills";

export const dynamic = "force-dynamic";

const COLUMNS: {
  key: SortKey | null;
  label: string;
  cell: (c: Ranked) => string;
}[] = [
  { key: "rating", label: "RTG", cell: (c) => c.rating.toFixed(1) },
  { key: null, label: "GP", cell: (c) => String(c.gp) },
  { key: "win", label: "W-L", cell: (c) => `${c.wins}-${c.losses}` },
  { key: "ppg", label: "PPG", cell: (c) => fmtAvg(c.pts, c.gp) },
  { key: "rpg", label: "RPG", cell: (c) => fmtAvg(c.reb, c.gp) },
  { key: "apg", label: "APG", cell: (c) => fmtAvg(c.ast, c.gp) },
  { key: "spg", label: "SPG", cell: (c) => fmtAvg(c.stl, c.gp) },
  { key: "bpg", label: "BPG", cell: (c) => fmtAvg(c.blk, c.gp) },
  { key: "fg", label: "FG%", cell: (c) => fmtPct(c.fgm, c.fga) },
  { key: null, label: "FT%", cell: (c) => fmtPct(c.ftm, c.fta) },
  { key: "pm", label: "+/-", cell: (c) => fmtSigned(c.plusMinus / c.gp, 1) },
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortKey: SortKey = sort && sort in SORTS ? (sort as SortKey) : "rating";

  const [games, players] = await Promise.all([listGames(), listPlayers()]);
  const { rows, qualifyAt } = rankPlayers(
    careerTotals(games, players),
    sortKey,
  );
  const hasProvisional = rows.some((r) => r.rank === null);

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Rankings
        </h1>
        <p className="text-sm text-muted">
          Sorted by {SORTS[sortKey].label}. Tap the selected stat to see what it
          means.
        </p>
      </div>

      <SortPills
        key={sortKey}
        active={sortKey}
        items={(Object.keys(SORTS) as SortKey[]).map((k) => ({
          key: k,
          label: SORTS[k].label,
        }))}
      />

      {rows.length === 0 ? (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          Finish a game and the rankings show up here.
        </p>
      ) : (
        <div className="glass-2 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="tabular w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="label text-muted">
                  <th className="sticky-cell px-3 py-3 text-left font-semibold">
                    # Player
                  </th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.label}
                      className={`px-2.5 py-3 text-right font-semibold ${c.key === sortKey ? "text-court-ink" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((r) => (
                  <tr
                    key={r.playerId}
                    className={r.rank === null ? "opacity-45" : ""}
                  >
                    <td className="sticky-cell px-3 py-2.5">
                      <Link
                        href={`/players/${r.playerId}`}
                        className="flex items-center gap-2.5"
                      >
                        <RankBadge rank={r.rank} />
                        <Avatar id={r.playerId} name={r.name} size="sm" />
                        <span className="font-bold">{r.name}</span>
                      </Link>
                    </td>
                    {COLUMNS.map((c) => {
                      const v = c.cell(r);
                      const signed = c.label === "+/-";
                      return (
                        <td
                          key={c.label}
                          className={`px-2.5 py-2.5 text-right ${
                            c.key === sortKey
                              ? "bg-court-soft/10 font-extrabold"
                              : ""
                          } ${c.key === "rating" ? "font-bold" : ""} ${
                            signed
                              ? v.startsWith("+")
                                ? "text-win"
                                : v.startsWith("-")
                                  ? "text-loss"
                                  : ""
                              : ""
                          }`}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasProvisional && (
            <p className="hairline border-t px-3 py-2 text-xs text-muted">
              Players need {qualifyAt} games to get a rank.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

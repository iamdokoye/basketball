import Link from "next/link";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { fmtAvg, fmtPct, fmtSigned } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { RankBadge } from "@/app/components/RankBadge";

export const dynamic = "force-dynamic";

const COLUMNS: { key: SortKey | null; label: string; cell: (c: Ranked) => string }[] = [
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
  const { rows, qualifyAt } = rankPlayers(careerTotals(games, players), sortKey);
  const hasProvisional = rows.some((r) => r.rank === null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Rankings</h1>
        <p className="text-sm text-stone-500">
          Ranked by rating: your average Game Score per game, which rolls scoring, efficiency,
          rebounds, assists, steals, blocks, turnovers and fouls into one number.
        </p>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {(Object.keys(SORTS) as SortKey[]).map((k) => (
          <Link
            key={k}
            href={k === "rating" ? "/rankings" : `/rankings?sort=${k}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              k === sortKey ? "bg-ink text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {SORTS[k].label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
          Finish a game and the rankings show up here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
          <div className="overflow-x-auto">
            <table className="tabular w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="sticky left-0 z-[1] bg-white px-3 py-2.5 text-left font-semibold">
                    # Player
                  </th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.label}
                      className={`px-2.5 py-2.5 text-right font-semibold ${
                        c.key === sortKey ? "text-court" : ""
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.playerId} className={r.rank === null ? "text-stone-400" : ""}>
                    <td className="sticky left-0 z-[1] bg-white px-3 py-2.5">
                      <Link href={`/players/${r.playerId}`} className="flex items-center gap-2.5">
                        <RankBadge rank={r.rank} />
                        <Avatar id={r.playerId} name={r.name} size="sm" />
                        <span className="font-bold text-ink">{r.name}</span>
                      </Link>
                    </td>
                    {COLUMNS.map((c) => (
                      <td
                        key={c.label}
                        className={`px-2.5 py-2.5 text-right ${
                          c.key === sortKey ? "bg-orange-50 font-black text-ink" : ""
                        } ${c.key === "rating" ? "font-bold" : ""}`}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasProvisional && (
            <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-500">
              Players need {qualifyAt} games to get a rank. Greyed rows are still qualifying.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

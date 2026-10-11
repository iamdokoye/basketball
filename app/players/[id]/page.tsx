import Link from "next/link";
import { notFound } from "next/navigation";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers } from "@/lib/rankings";
import { fmtAvg, fmtEfg, fmtMinutes, fmtPct, fmtSigned, fmtTs } from "@/lib/stats";
import { formatDate } from "@/app/components/BoxScore";
import { Avatar } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  const [players, games] = await Promise.all([listPlayers(), listGames()]);
  const player = players.find((p) => p.id === playerId);
  if (!player) notFound();

  const career = careerTotals(games, players);
  const c = career.find((x) => x.playerId === playerId)!;
  const ranked = rankPlayers(career).rows.find((r) => r.playerId === playerId);
  const log = games
    .filter((g) => g.status === "final")
    .flatMap((g) => {
      const line = g.lines.find((l) => l.playerId === playerId);
      return line ? [{ game: g, line }] : [];
    });

  const cards: [string, string][] = [
    ["PPG", fmtAvg(c.pts, c.gp)],
    ["RPG", fmtAvg(c.reb, c.gp)],
    ["APG", fmtAvg(c.ast, c.gp)],
    ["SPG", fmtAvg(c.stl, c.gp)],
    ["BPG", fmtAvg(c.blk, c.gp)],
    ["TOPG", fmtAvg(c.tov, c.gp)],
    ["FG%", fmtPct(c.fgm, c.fga)],
    ["3P%", fmtPct(c.fg3m, c.fg3a)],
    ["FT%", fmtPct(c.ftm, c.fta)],
    ["eFG%", fmtEfg(c)],
    ["TS%", fmtTs(c)],
    ["+/-", c.gp ? fmtSigned(c.plusMinus / c.gp, 1) : "–"],
  ];

  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-2 text-right";

  return (
    <div className="space-y-5">
      <Link href="/players" className="text-sm font-semibold text-stone-500 hover:underline">
        ← Players
      </Link>

      <div className="flex items-center gap-4">
        <Avatar id={player.id} name={player.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black tracking-tight">{player.name}</h1>
          <p className="tabular text-sm text-stone-500">
            {c.gp} {c.gp === 1 ? "game" : "games"} · {c.wins}-{c.losses}
            {c.gp > 0 && <> · {fmtMinutes(c.sec / c.gp)} min/g</>}
          </p>
        </div>
      </div>

      {ranked && (
        <Link
          href="/rankings"
          className="flex items-center justify-between rounded-2xl bg-ink p-4 text-white active:opacity-90"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">League rank</div>
            <div className="text-3xl font-black">{ranked.rank ? `#${ranked.rank}` : "Qualifying"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Rating</div>
            <div className="tabular text-3xl font-black text-amber-400">{ranked.rating.toFixed(1)}</div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-stone-200">
            <div className="tabular text-2xl font-black">{value}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">Game log</h2>
        {log.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-stone-500 ring-1 ring-stone-200">
            No finished games yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
            <div className="overflow-x-auto">
              <table className="tabular w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-stone-400">
                    <th className="sticky left-0 z-[1] bg-white px-3 py-2 text-left font-semibold">Game</th>
                    {["PTS", "FG", "3P", "FT", "REB", "AST", "STL", "BLK", "TO", "+/-", "MIN"].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {log.map(({ game, line }) => {
                    const mine = game.score[line.team];
                    const theirs = game.score[line.team === "A" ? "B" : "A"];
                    return (
                      <tr key={game.id}>
                        <td className="sticky left-0 z-[1] bg-white px-3 py-2">
                          <Link href={`/games/${game.id}`} className="hover:underline">
                            <span className={`font-black ${mine > theirs ? "text-emerald-700" : "text-rose-700"}`}>
                              {mine > theirs ? "W" : "L"}
                            </span>{" "}
                            {mine}-{theirs}
                            <span className="ml-1.5 text-xs text-stone-400">{formatDate(game.playedAt)}</span>
                          </Link>
                        </td>
                        <td className={`${td} font-black`}>{line.pts}</td>
                        <td className={td}>
                          {line.fgm}-{line.fga}
                        </td>
                        <td className={td}>
                          {line.fg3m}-{line.fg3a}
                        </td>
                        <td className={td}>
                          {line.ftm}-{line.fta}
                        </td>
                        <td className={td}>{line.reb}</td>
                        <td className={td}>{line.ast}</td>
                        <td className={td}>{line.stl}</td>
                        <td className={td}>{line.blk}</td>
                        <td className={td}>{line.tov}</td>
                        <td className={td}>{fmtSigned(line.plusMinus)}</td>
                        <td className={`${td} text-stone-500`}>{fmtMinutes(line.sec)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

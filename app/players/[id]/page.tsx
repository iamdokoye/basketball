import Link from "next/link";
import { notFound } from "next/navigation";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers } from "@/lib/rankings";
import { fmtAvg, fmtEfg, fmtMinutes, fmtPct, fmtSigned, fmtTs } from "@/lib/stats";
import { formatDate } from "@/app/components/BoxScore";
import { Avatar } from "@/app/components/Avatar";
import { RenamePlayerButton } from "@/app/components/RenamePlayer";

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
      <Link href="/players" className="px-1 text-sm font-semibold text-muted hover:underline">
        ← Players
      </Link>

      <div className="flex items-center gap-4">
        <Avatar id={player.id} name={player.name} size="lg" tone="ink" />
        <div className="min-w-0">
          <h1 className="truncate text-[32px] font-extrabold leading-[38px] tracking-tight">{player.name}</h1>
          <p className="tabular text-sm font-semibold text-muted">
            {c.gp} {c.gp === 1 ? "game" : "games"} · {c.wins}-{c.losses}
            {c.gp > 0 && <> · {fmtMinutes(c.sec / c.gp)} min/g</>}
          </p>
          <RenamePlayerButton
            playerId={player.id}
            name={player.name}
            className="mt-1.5 rounded-full bg-sub/10 px-3 py-1.5 text-xs font-semibold text-sub ring-1 ring-sub/25 transition hover:bg-sub/15 active:scale-95"
          />
        </div>
      </div>

      {ranked && (
        <Link
          href="/rankings"
          className="glass-2 flex items-center justify-between rounded-2xl p-4 active:scale-[0.99]"
        >
          <div>
            <div className="label text-muted">League rank</div>
            <div className="text-3xl font-extrabold tracking-tight">{ranked.rank ? `#${ranked.rank}` : "Qualifying"}</div>
          </div>
          <div className="text-right">
            <div className="label text-muted">Rating</div>
            <div className="tabular text-3xl font-extrabold tracking-tight text-court-ink">{ranked.rating.toFixed(1)}</div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="glass-1 rounded-2xl p-3 text-center">
            <div className="tabular text-2xl font-extrabold tracking-tight">{value}</div>
            <div className="label text-muted">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="label mb-2 px-1">Game log</h2>
        {log.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No finished games yet.
          </p>
        ) : (
          <div className="glass-2 overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="tabular w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="label text-muted">
                    <th className="sticky-cell px-3 py-2.5 text-left font-semibold">Game</th>
                    {["PTS", "FG", "3P", "FT", "REB", "AST", "STL", "BLK", "TO", "+/-", "MIN"].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {log.map(({ game, line }) => {
                    const mine = game.score[line.team];
                    const theirs = game.score[line.team === "A" ? "B" : "A"];
                    return (
                      <tr key={game.id}>
                        <td className="sticky-cell px-3 py-2">
                          <Link href={`/games/${game.id}`} className="hover:underline">
                            <span className={`font-extrabold ${mine > theirs ? "text-win" : "text-loss"}`}>
                              {mine > theirs ? "W" : "L"}
                            </span>{" "}
                            {mine}-{theirs}
                            <span className="ml-1.5 text-xs text-muted">{formatDate(game.playedAt)}</span>
                          </Link>
                        </td>
                        <td className={`${td} font-extrabold`}>{line.pts}</td>
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
                        <td className={`${td} text-muted`}>{fmtMinutes(line.sec)}</td>
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

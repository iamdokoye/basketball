import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { fmtAvg } from "@/lib/stats";
import { PlayerRoster } from "./PlayerRoster";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, games] = await Promise.all([listPlayers(), listGames()]);
  const totals = new Map(careerTotals(games, players).map((c) => [c.playerId, c]));

  const roster = players.map((p) => {
    const c = totals.get(p.id);
    return {
      id: p.id,
      name: p.name,
      archived: p.archived,
      stats:
        c && c.gp > 0
          ? `${c.gp} GP · ${fmtAvg(c.pts, c.gp)} pts · ${fmtAvg(c.reb, c.gp)} reb · ${fmtAvg(c.ast, c.gp)} ast`
          : "No games yet",
    };
  });

  return (
    <div className="space-y-5">
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">Players</h1>
      <PlayerRoster players={roster} />
    </div>
  );
}

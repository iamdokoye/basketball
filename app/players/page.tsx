import Link from "next/link";
import { getAccess } from "@/lib/access";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { fmtAvg } from "@/lib/stats";
import { PlayerRoster } from "./PlayerRoster";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, games, access] = await Promise.all([
    listPlayers(),
    listGames(),
    getAccess(),
  ]);
  const totals = new Map(
    careerTotals(games, players).map((c) => [c.playerId, c]),
  );

  const roster = players.map((p) => {
    const c = totals.get(p.id);
    return {
      id: p.id,
      name: p.name,
      archived: p.archived,
      injured: p.injured,
      nicknames: p.nicknames,
      stats:
        c && c.gp > 0
          ? `${c.gp} GP · ${fmtAvg(c.pts, c.gp)} pts · ${fmtAvg(c.reb, c.gp)} reb · ${fmtAvg(c.ast, c.gp)} ast`
          : "No games yet",
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Players
        </h1>
        <Link
          href="/skill-tree"
          className="flex items-center gap-1.5 rounded-full bg-court-ink/10 px-3.5 py-1.5 text-xs font-black text-court-ink ring-1 ring-inset ring-court-ink/20 transition-all hover:bg-court-ink hover:text-white"
        >
          <span>🌳</span>
          <span>Archetype Tree</span>
        </Link>
      </div>
      <PlayerRoster
        players={roster}
        canAdd={access.canPlay}
        isAdmin={access.isAdmin}
      />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { getGame } from "@/lib/queries";
import { BoxScoreTable, formatDate } from "@/app/components/BoxScore";
import GameAdminActions from "./GameAdminActions";
import Scorekeeper from "./Scorekeeper";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [game, access] = await Promise.all([getGame(Number(id)), getAccess()]);
  if (!game) notFound();

  if (game.status === "live") {
    return (
      <Scorekeeper
        key={access.canPlay ? "edit" : "view"}
        gameId={game.id}
        roster={game.roster}
        initialEvents={game.events}
        startMs={game.startMs}
        target={game.target}
        winBy={game.winBy}
        readOnly={!access.canPlay}
        windowLabel={access.windowLabel}
        opensAt={access.opensAt}
        serverNow={access.now}
      />
    );
  }

  const names = (t: "A" | "B") =>
    game.roster
      .filter((p) => p.team === t)
      .map((p) => p.name)
      .join(", ");

  return (
    <div className="space-y-4">
      <Link href="/games" className="px-1 text-sm font-semibold text-muted hover:underline">
        ← All games
      </Link>
      <div className="glass-2 rounded-3xl p-5">
        <div className="label text-muted">
          {formatDate(game.playedAt)} · Final
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {(["A", "B"] as const).map((t) => (
            <div key={t} className={t === "B" ? "text-right" : ""}>
              <div className="tabular text-6xl font-extrabold leading-none tracking-tighter">
                {game.score[t]}
                {game.winner === t && <span className="ml-2 align-middle text-lg font-extrabold text-win">W</span>}
              </div>
              <div className="mt-2 text-xs font-semibold text-muted">{names(t)}</div>
            </div>
          ))}
        </div>
      </div>

      <BoxScoreTable lines={game.lines} team="A" />
      <BoxScoreTable lines={game.lines} team="B" />

      {access.isAdmin && <GameAdminActions gameId={game.id} />}
    </div>
  );
}

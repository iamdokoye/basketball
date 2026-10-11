import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/queries";
import { reopenGame } from "@/lib/actions";
import { BoxScoreTable, formatDate } from "@/app/components/BoxScore";
import DeleteGameButton from "./DeleteGameButton";
import Scorekeeper from "./Scorekeeper";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGame(Number(id));
  if (!game) notFound();

  if (game.status === "live") {
    return (
      <Scorekeeper
        gameId={game.id}
        roster={game.roster}
        initialEvents={game.events}
        startMs={game.startMs}
        target={game.target}
        winBy={game.winBy}
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

      <div className="flex gap-2">
        <form action={reopenGame.bind(null, game.id)}>
          <button className="glass-1 rounded-full px-4 py-2 text-sm font-semibold active:scale-95">
            Reopen to fix stats
          </button>
        </form>
        <DeleteGameButton gameId={game.id} />
      </div>
    </div>
  );
}

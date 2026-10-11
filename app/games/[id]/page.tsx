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
      <Link href="/games" className="text-sm text-stone-500 hover:underline">
        ← All games
      </Link>
      <div className="rounded-2xl bg-stone-900 p-5 text-white">
        <div className="text-xs uppercase tracking-wider text-stone-400">
          {formatDate(game.playedAt)} · Final
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {(["A", "B"] as const).map((t) => (
            <div key={t} className={t === "B" ? "text-right" : ""}>
              <div className="tabular text-5xl font-black">
                {game.score[t]}
                {game.winner === t && <span className="ml-2 text-lg text-emerald-400">W</span>}
              </div>
              <div className="mt-1 text-sm text-stone-400">{names(t)}</div>
            </div>
          ))}
        </div>
      </div>

      <BoxScoreTable lines={game.lines} team="A" />
      <BoxScoreTable lines={game.lines} team="B" />

      <div className="flex gap-2">
        <form action={reopenGame.bind(null, game.id)}>
          <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-stone-300 active:bg-stone-100">
            Reopen to fix stats
          </button>
        </form>
        <DeleteGameButton gameId={game.id} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { listGames } from "@/lib/queries";
import { GameRow } from "@/app/components/GameRow";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const games = await listGames();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Games</h1>
        <Link
          href="/games/new"
          className="rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white active:bg-orange-700"
        >
          + New game
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-stone-500 ring-1 ring-stone-200">
          No games yet. Start one!
        </p>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

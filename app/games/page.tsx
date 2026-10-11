import Link from "next/link";
import { listGames } from "@/lib/queries";
import { GameRow } from "@/app/components/GameRow";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const games = await listGames();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">Games</h1>
        <Link
          href="/games/new"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-sm active:scale-95"
        >
          + New game
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
          No games yet. Start one!
        </p>
      ) : (
        <ul className="space-y-3">
          {games.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

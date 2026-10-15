import Link from "next/link";
import { getAccess } from "@/lib/access";
import { listGames } from "@/lib/queries";
import { GameRow } from "@/app/components/GameRow";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const [games, access] = await Promise.all([listGames(), getAccess()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">Games</h1>
        <div className="flex items-center gap-2">
          {access.isAdmin && (
            <Link
              href="/games/import"
              className="glass-1 rounded-full px-4 py-2 text-sm font-semibold active:scale-95"
            >
              Import
            </Link>
          )}
          {access.canPlay && (
            <Link
              href="/games/new"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-sm active:scale-95"
            >
              + New game
            </Link>
          )}
        </div>
      </div>
      {games.length === 0 ? (
        <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
          {access.canPlay ? "No games yet. Start one!" : "No games yet."}
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

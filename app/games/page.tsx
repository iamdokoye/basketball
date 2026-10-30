import Link from "next/link";
import { getAccess } from "@/lib/access";
import { listGames } from "@/lib/queries";
import { GameRow } from "@/app/components/GameRow";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const [games, access] = await Promise.all([listGames(), getAccess()]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="label text-court-ink">Matchups &amp; Modes</div>
          <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">Games</h1>
        </div>
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

      {/* Special Game Modes */}
      <section className="space-y-2">
        <h2 className="label px-1">Game Modes &amp; Drills</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/tournaments"
            className="glass-1 group flex items-center justify-between rounded-2xl p-4 transition hover:bg-white active:scale-[0.99] border border-black/5"
          >
            <div className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-2xl shadow-inner">
                👑
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-ink group-hover:text-court-ink transition-colors">
                    King of the Court
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Tournaments
                  </span>
                </div>
                <div className="text-xs text-muted">
                  Winner stays on · 3v3 rotation · 3-win crown defense
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all">
              →
            </span>
          </Link>

          <Link
            href="/around-the-world"
            className="glass-1 group flex items-center justify-between rounded-2xl p-4 transition hover:bg-white active:scale-[0.99] border border-black/5"
          >
            <div className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-court-soft/30 text-2xl shadow-inner">
                🌍
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-ink group-hover:text-court-ink transition-colors">
                    Around the World
                  </span>
                  <span className="rounded-full bg-court-soft/20 px-2 py-0.5 text-[10px] font-bold text-court-ink">
                    Shooting Drill
                  </span>
                </div>
                <div className="text-xs text-muted">
                  Spot shooting circuit · Chance It &amp; Stay on miss modes
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* Match History List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="label">Match History ({games.length})</h2>
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
      </section>
    </div>
  );
}

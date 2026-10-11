import Link from "next/link";
import type { Game } from "@/lib/queries";
import { formatDate } from "./BoxScore";

export function GameRow({ game }: { game: Game }) {
  const names = (t: "A" | "B") =>
    game.roster
      .filter((p) => p.team === t)
      .map((p) => p.name)
      .join(", ");
  return (
    <li>
      <Link
        href={`/games/${game.id}`}
        className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 active:bg-stone-50"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
          <span>{formatDate(game.playedAt)}</span>
          {game.status === "live" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-orange-100 px-2 py-0.5 font-bold text-court-dark">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-court" />
              LIVE
            </span>
          ) : (
            <span>Final</span>
          )}
        </div>
        <div className="mt-2 space-y-1.5">
          {(["A", "B"] as const).map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t === "A" ? "bg-court" : "bg-away"}`} />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${game.winner === t ? "font-black" : "text-stone-600"}`}
              >
                {names(t)}
              </span>
              <span
                className={`tabular text-2xl ${game.winner === t ? "font-black" : "font-semibold text-stone-400"}`}
              >
                {game.score[t]}
              </span>
            </div>
          ))}
        </div>
      </Link>
    </li>
  );
}

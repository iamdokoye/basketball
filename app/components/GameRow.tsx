import Link from "next/link";
import type { Game } from "@/lib/queries";
import { shortName } from "./Avatar";
import { formatDate } from "./BoxScore";

const TEAMS = [
  { t: "A", dot: "bg-court-soft", name: "Team A" },
  { t: "B", dot: "bg-away-soft", name: "Team B" },
] as const;

function names(game: Game, team: "A" | "B") {
  return game.roster
    .filter((p) => p.team === team)
    .map((p) => shortName(p.name))
    .join(", ");
}

/** Compact result card used in lists. */
export function GameRow({ game }: { game: Game }) {
  return (
    <li>
      <Link
        href={`/games/${game.id}`}
        className="glass-1 block space-y-2 rounded-2xl p-3.5 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
          <span>{formatDate(game.playedAt)}</span>
          {game.status === "live" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-court-soft/15 px-2 py-0.5 text-court-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-court-soft" />
              LIVE
            </span>
          ) : (
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5">Final</span>
          )}
        </div>
        <div className="space-y-1.5 pt-1">
          {TEAMS.map(({ t, dot, name }) => {
            const won = game.winner === t;
            return (
              <div key={t} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                <span className="min-w-0 flex-1 truncate">
                  <span className={`text-sm ${won ? "font-bold" : "font-semibold text-muted"}`}>{name}</span>{" "}
                  <span className="text-xs text-muted">({names(game, t)})</span>
                </span>
                <span
                  className={`tabular text-[22px] leading-6 ${won ? "font-extrabold" : "font-semibold text-muted"}`}
                >
                  {game.score[t]}
                </span>
              </div>
            );
          })}
        </div>
      </Link>
    </li>
  );
}

/** Larger card for a game in progress, with a race-to-target bar. */
export function LiveGameCard({ game, canScore = true }: { game: Game; canScore?: boolean }) {
  const pct = (t: "A" | "B") => Math.min(100, (game.score[t] / game.target) * 100);
  const leader = game.score.A >= game.score.B ? "A" : "B";
  return (
    <div className="glass-1 space-y-3 rounded-2xl p-4">
      {TEAMS.map(({ t, dot, name }, i) => (
        <div key={t} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-extrabold shadow-sm ${
                  t === "A" ? "bg-court-soft text-white" : "bg-away-soft text-sky-950"
                }`}
              >
                {t}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[22px] font-semibold leading-7 tracking-tight">{name}</span>
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                </div>
                <p className="truncate text-[11px] font-semibold text-muted">{names(game, t)}</p>
              </div>
            </div>
            <span
              className={`tabular text-6xl font-extrabold leading-none tracking-tighter ${
                leader === t ? "text-ink" : "text-muted"
              }`}
            >
              {game.score[t]}
            </span>
          </div>
          {i === 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-court-soft" style={{ width: `${pct("A")}%` }} />
              </div>
              <span className="whitespace-nowrap text-[11px] font-semibold text-muted">Race to {game.target}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-away-soft" style={{ width: `${pct("B")}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Link
          href={`/games/${game.id}?watch=1`}
          className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-semibold shadow-sm active:scale-95"
        >
          Watch live
        </Link>
        {canScore && (
          <Link
            href={`/games/${game.id}`}
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-paper shadow-sm active:scale-95"
          >
            Open scorekeeper
          </Link>
        )}
      </div>
    </div>
  );
}

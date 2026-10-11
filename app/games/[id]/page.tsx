import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { buildClock, formatClock } from "@/lib/clock";
import { leagueTimeZone } from "@/lib/format";
import { playerOfTheGame, statSummary } from "@/lib/pog";
import { getGame } from "@/lib/queries";
import { buildRecap } from "@/lib/recap";
import { BoxScoreTable, formatDate } from "@/app/components/BoxScore";
import { Avatar } from "@/app/components/Avatar";
import { ShareRecap } from "@/app/components/ShareRecap";
import GameAdminActions from "./GameAdminActions";
import Scorekeeper from "./Scorekeeper";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const pog = playerOfTheGame(game);
  const recap = buildRecap(game, leagueTimeZone());
  // Total playing time (pauses and timeouts excluded) and the timeouts, with who called each.
  const clock = buildClock(game.events, game.startMs, game.roster);
  const lastAt = game.events.length
    ? Math.max(...game.events.map((e) => e.at))
    : game.startMs;
  const nameOf = (id: number) =>
    game.roster.find((p) => p.id === id)?.name ?? "";
  const names = (t: "A" | "B") =>
    game.roster
      .filter((p) => p.team === t)
      .map((p) => p.name)
      .join(", ");

  return (
    <div className="space-y-4">
      <Link
        href="/games"
        className="px-1 text-sm font-semibold text-muted hover:underline"
      >
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
                {game.winner === t && (
                  <span className="ml-2 align-middle text-lg font-extrabold text-win">
                    W
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs font-semibold text-muted">
                {names(t)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {clock.started && (
        <div className="glass-1 space-y-2.5 rounded-3xl p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="label">Game time</h2>
            <span className="tabular text-2xl font-extrabold leading-7">
              {formatClock(clock.gameMs(lastAt))}
            </span>
          </div>
          {clock.timeouts.length > 0 && (
            <ul className="hairline divide-y divide-black/[0.06] border-t">
              {clock.timeouts.map((t) => (
                <li
                  key={t.grp}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-semibold">
                    Timeout · {t.team ? `Team ${t.team}` : "?"}
                    {t.playerId > 0 && (
                      <span className="font-medium text-muted">
                        {" "}
                        · called by {nameOf(t.playerId)}
                      </span>
                    )}
                  </span>
                  {t.endedAt !== null && (
                    <span className="tabular text-xs font-semibold text-muted">
                      {formatClock(t.endedAt - t.at)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pog && (
        <Link
          href={`/players/${pog.line.playerId}`}
          className="glass-2 flex items-center gap-3 rounded-3xl p-4 transition-transform active:scale-[0.99]"
        >
          <Avatar name={pog.line.name} tone="ink" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="label text-court-ink">★ Player of the game</div>
            <div className="truncate text-xl font-extrabold leading-6 tracking-tight">
              {pog.line.name}
            </div>
            <div className="tabular text-xs font-semibold text-muted">
              {statSummary(pog.line)}
            </div>
          </div>
          <div className="text-right">
            <div className="tabular text-2xl font-extrabold leading-7 text-court-ink">
              {pog.rating.toFixed(1)}
              <span className="text-xs font-bold text-muted">/10</span>
            </div>
            <div className="label text-muted">rating</div>
          </div>
        </Link>
      )}

      {recap && <ShareRecap text={recap} gameId={game.id} />}

      <BoxScoreTable lines={game.lines} team="A" pogId={pog?.line.playerId} />
      <BoxScoreTable lines={game.lines} team="B" pogId={pog?.line.playerId} />

      {access.isAdmin && <GameAdminActions gameId={game.id} />}
    </div>
  );
}

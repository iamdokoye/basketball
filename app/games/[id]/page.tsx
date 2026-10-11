import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
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

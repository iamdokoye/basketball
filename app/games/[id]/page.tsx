import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { buildClock, computeQuarterScores, formatClock } from "@/lib/clock";
import { formatGameDateTime, leagueTimeZone } from "@/lib/format";
import { gameSvp, playerOfTheGame, statSummary } from "@/lib/pog";
import { getGame, listPlayers } from "@/lib/queries";
import { buildRecap } from "@/lib/recap";
import { BoxScoreTable, formatDate } from "@/app/components/BoxScore";
import { Avatar } from "@/app/components/Avatar";
import { GameMomentumChart } from "@/app/components/GameMomentumChart";
import { LiveWinProbability } from "@/app/components/LiveWinProbability";
import { ShareRecap } from "@/app/components/ShareRecap";
import { buildGameMomentum, detectOnFirePlayers } from "@/lib/momentum";
import { CourtAudioControls } from "@/app/components/CourtAudio";
import { FourFactorsCard } from "@/app/components/FourFactorsCard";
import { WinProbabilityChart } from "@/app/components/WinProbabilityChart";
import { computeAdvancedLines, computeFourFactors } from "@/lib/analytics";
import { buildWinProbabilityTimeline, findDaggerPlay } from "@/lib/winProbability";
import { ShotHeatmap, ShotZoneTable } from "@/app/components/ShotHeatmap";
import { ShareBoxScore } from "@/app/components/ShareBoxScore";
import { siteUrl } from "@/lib/site";
import {
  computeGameShotProfile,
  computeGameTeamShotProfile,
  zoneRecordsFromGames,
} from "@/lib/shotZones";
import { buildGameHistoryInsights } from "@/lib/gameHistory";
import { GamePlayHistory } from "@/app/components/GamePlayHistory";
import GameAdminActions from "./GameAdminActions";
import Scorekeeper from "./Scorekeeper";
import { parseScoreMode, SCORE_MODE_COOKIE } from "./scoreModeShared";

export const dynamic = "force-dynamic";

/** The link preview: a shared game reads as a scoreboard in the group chat. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(Number(id));
  if (!game) return { title: "Game not found" };
  const live = game.status === "live";
  const title = `${live ? "Live" : "Final"} · Team A ${game.score.A}–${game.score.B} Team B`;
  const pog = playerOfTheGame(game);
  const description = [
    formatGameDateTime(game.playedAt),
    game.gameType === "timed"
      ? `${game.quarterCount} × ${game.quarterMinutes} min`
      : `First to ${game.target}`,
    pog
      ? `Player of the game: ${pog.line.name} (${pog.line.pts} pts, ${pog.line.reb} reb, ${pog.line.ast} ast)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ watch?: string }>;
}) {
  const { id } = await params;
  // ?watch=1 opens a live game as a spectator, even for someone who is allowed to score.
  const spectating = (await searchParams).watch === "1";
  const [game, access] = await Promise.all([getGame(Number(id)), getAccess()]);
  if (!game) notFound();

  if (game.status === "live") {
    // Everyone who could turn up late: active league players (the scorekeeper hides those already in the game).
    const league = access.canPlay && !spectating
      ? (await listPlayers())
          .filter((p) => !p.archived)
          .map((p) => ({ id: p.id, name: p.name }))
      : [];
    return (
      <Scorekeeper
        key={access.canPlay && !spectating ? "edit" : "view"}
        gameId={game.id}
        roster={game.roster}
        players={league}
        initialEvents={game.events}
        startMs={game.startMs}
        target={game.target}
        winBy={game.winBy}
        gameType={game.gameType}
        quarterMinutes={game.quarterMinutes}
        quarterCount={game.quarterCount}
        readOnly={!access.canPlay || spectating}
        spectating={spectating}
        windowLabel={access.windowLabel}
        opensAt={access.opensAt}
        serverNow={access.now}
        initialMode={parseScoreMode((await cookies()).get(SCORE_MODE_COOKIE)?.value)}
      />
    );
  }

  const pog = playerOfTheGame(game);
  const svp = gameSvp(game);
  const momentum = buildGameMomentum(game);
  const onFire = detectOnFirePlayers(game.events, game.roster);
  const recap = buildRecap(game, leagueTimeZone());
  const fourFactors = computeFourFactors(game);
  const advancedLines = computeAdvancedLines(game);

  const probSteps = buildWinProbabilityTimeline(
    game.events,
    game.roster,
    game.target,
    game.winBy,
    game.gameType,
    game.quarterMinutes,
    game.quarterCount,
    game.startMs,
  );
  const daggerPlay = findDaggerPlay(probSteps, game.winner);
  // Total playing time (pauses and timeouts excluded) and the timeouts, with who called each.
  const clock = buildClock(game.events, game.startMs, game.roster);
  const quarterScores =
    game.gameType === "timed"
      ? computeQuarterScores(
          game.events,
          clock,
          game.quarterMinutes,
          game.quarterCount,
          game.roster,
        )
      : [];
  // Only games scored with the court pad carry real locations; older games show no chart at all
  // rather than an estimate.
  const zoneRecords = zoneRecordsFromGames([game]);
  const gameShots = computeGameShotProfile(game, zoneRecords);

  const teamRows = (t: "A" | "B") =>
    game.lines
      .filter((l) => l.team === t)
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name))
      .map((l) => ({
        name: l.name,
        pts: l.pts,
        reb: l.reb,
        ast: l.ast,
        stl: l.stl,
        blk: l.blk,
        tov: l.tov,
      }));
  const boxImage = {
    status: "Final",
    subtitle: `${formatGameDateTime(game.playedAt)} · ${
      game.gameType === "timed"
        ? `${game.quarterCount} × ${game.quarterMinutes} min`
        : `First to ${game.target}`
    }`,
    scoreA: game.score.A,
    scoreB: game.score.B,
    winner: game.winner,
    teamA: teamRows("A"),
    teamB: teamRows("B"),
    pogName: pog?.line.name,
    host: new URL(siteUrl()).host,
  };

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
      <div className="flex items-center justify-between px-1">
        <Link
          href="/games"
          className="text-sm font-semibold text-muted hover:underline"
        >
          ← All games
        </Link>
        <CourtAudioControls />
      </div>
      <div className="glass-2 rounded-3xl p-5">
        <div className="label flex items-center justify-between text-muted">
          <span>{formatDate(game.playedAt)} · Final</span>
          <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            {game.gameType === "timed"
              ? `Timed · ${game.quarterCount} × ${game.quarterMinutes}m`
              : `Target ${game.target}`}
          </span>
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

      {quarterScores.length > 0 && (
        <div className="glass-2 space-y-2 overflow-hidden rounded-2xl p-4">
          <div className="label text-muted">Score by quarter</div>
          <div className="overflow-x-auto">
            <table className="tabular w-full text-center text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-xs font-semibold text-muted">
                  <th className="py-1 text-left">Team</th>
                  {quarterScores.map((q) => (
                    <th key={q.label} className="px-2 py-1">
                      {q.label}
                    </th>
                  ))}
                  <th className="px-2 py-1 font-bold text-ink">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(["A", "B"] as const).map((t) => (
                  <tr key={t} className="font-semibold">
                    <td
                      className={`py-1.5 text-left font-bold ${
                        t === "A" ? "text-court-ink" : "text-away-dark"
                      }`}
                    >
                      Team {t}
                    </td>
                    {quarterScores.map((q) => (
                      <td key={q.label} className="px-2 py-1.5">
                        {q[t]}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 font-extrabold text-ink">
                      {game.score[t]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {(pog || svp) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pog && (
            <Link
              href={`/players/${pog.line.playerId}`}
              className="glass-2 flex items-center gap-3 rounded-3xl p-4 transition-transform active:scale-[0.99]"
            >
              <Avatar name={pog.line.name} tone="ink" size="lg" />
              <div className="min-w-0 flex-1">
                <div className="label text-court-ink">★ MVP · Winning team</div>
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
          {svp && (
            <Link
              href={`/players/${svp.line.playerId}`}
              className="glass-1 flex items-center gap-3 rounded-3xl p-4 transition-transform active:scale-[0.99]"
            >
              <Avatar name={svp.line.name} tone="soft" size="lg" />
              <div className="min-w-0 flex-1">
                <div className="label text-muted">🛡️ SVP · The Lone Wolf</div>
                <div className="truncate text-xl font-extrabold leading-6 tracking-tight">
                  {svp.line.name}
                </div>
                <div className="tabular text-xs font-semibold text-muted">
                  {statSummary(svp.line)}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-2xl font-extrabold leading-7 text-ink">
                  {svp.rating.toFixed(1)}
                  <span className="text-xs font-bold text-muted">/10</span>
                </div>
                <div className="label text-muted">rating</div>
              </div>
            </Link>
          )}
        </div>
      )}

      {onFire.length > 0 && (
        <div className="glass-1 flex items-center justify-between rounded-2xl p-3 px-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-rose-700">
            <span className="animate-pulse">🔥</span>
            <span>Hot Hand / On Fire Streaks:</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {onFire.map((p) => (
              <span key={p.playerId} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700">
                {p.playerName} ({p.streak} straight makes · {p.ptsInStreak} pts)
              </span>
            ))}
          </div>
        </div>
      )}

      <LiveWinProbability
        scoreA={game.score.A}
        scoreB={game.score.B}
        target={game.target}
        winBy={game.winBy}
        gameType={game.gameType}
        quarterMinutes={game.quarterMinutes}
        quarterCount={game.quarterCount}
        elapsedSec={Math.floor(clock.gameMs(lastAt) / 1000)}
        isGameOver={true}
        startMs={game.startMs}
        events={game.events}
        roster={game.roster}
        teamNames={{ A: "Team A", B: "Team B" }}
      />

      <WinProbabilityChart
        steps={probSteps}
        dagger={daggerPlay}
        winner={game.winner}
        teamNames={{ A: "Team A", B: "Team B" }}
      />

      <FourFactorsCard factors={fourFactors} />

      {momentum && <GameMomentumChart momentum={momentum} />}

      {recap && <ShareRecap text={recap} path={`/games/${game.id}`} />}

      <ShareBoxScore
        data={boxImage}
        text={
          recap ??
          `Team A ${game.score.A} – ${game.score.B} Team B`
        }
        path={`/games/${game.id}`}
      />

      {gameShots.taggedFga > 0 && (
        <div className="space-y-3">
          <ShotHeatmap
            profile={gameShots}
            label="Where the shots fell"
            title="Game shot chart"
          />
          <ShotZoneTable
            columns={[
              {
                label: "Team A",
                profile: computeGameTeamShotProfile(game, zoneRecords, "A"),
              },
              {
                label: "Team B",
                profile: computeGameTeamShotProfile(game, zoneRecords, "B"),
              },
            ]}
          />
        </div>
      )}

      <BoxScoreTable
        lines={game.lines}
        team="A"
        pogId={pog?.line.playerId}
        svpId={svp?.line.playerId}
        target={game.target}
        gameType={game.gameType}
        quarterMinutes={game.quarterMinutes}
        quarterCount={game.quarterCount}
        advanced={advancedLines}
      />
      <BoxScoreTable
        lines={game.lines}
        team="B"
        pogId={pog?.line.playerId}
        svpId={svp?.line.playerId}
        target={game.target}
        gameType={game.gameType}
        quarterMinutes={game.quarterMinutes}
        quarterCount={game.quarterCount}
        advanced={advancedLines}
      />

      <GamePlayHistory
        insights={buildGameHistoryInsights(game)}
        teamNames={{ A: "Team A", B: "Team B" }}
      />

      {access.isAdmin && <GameAdminActions gameId={game.id} />}
    </div>
  );
}

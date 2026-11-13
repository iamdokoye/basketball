import Link from "next/link";
import { getAccess } from "@/lib/access";
import { getMe } from "@/lib/identity";
import { computePlayerArchetype } from "@/lib/badges";
import { clutchTotals } from "@/lib/clutch";
import { formatShortDay, leagueGameDay, leagueTimeZone } from "@/lib/format";
import { groupBySeason, seasonKey, seasonLabel, seasonMode } from "@/lib/seasons";
import { getPlayerMilestones } from "@/lib/milestones";
import { playerOfTheGame, statSummary } from "@/lib/pog";
import {
  careerTotals,
  listGames,
  listPlayers,
  listVotedAwards,
} from "@/lib/queries";
import { rankPlayers } from "@/lib/rankings";
import { gameContext, rateLine } from "@/lib/rating";
import { generateScoutingReport } from "@/lib/scouting";
import { shelfEntries, trophyShelf } from "@/lib/trophies";
import { fmtMinutes } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";
import { JerseyEditor } from "./JerseyEditor";
import { ClaimPlayer, SwitchPlayer } from "@/app/components/ClaimPlayer";
import { PlayerBadges } from "@/app/components/PlayerBadges";
import { PlayerMilestonesCard } from "@/app/components/PlayerMilestonesCard";
import { PlayerScoutingReport } from "@/app/components/PlayerScoutingReport";
import { RatingTrend, type TrendPoint } from "@/app/components/RatingTrend";

export const dynamic = "force-dynamic";

export const metadata = { title: "My page | Pickup League" };

const TREND_GAMES = 15;
const RECENT_GAMES = 5;

export default async function MePage() {
  const me = await getMe();

  if (!me) {
    const players = await listPlayers();
    return (
      <div className="space-y-5">
        <div className="glass-2 space-y-4 rounded-3xl p-6 text-center">
          <div className="text-4xl" aria-hidden>
            🏀
          </div>
          <h1 className="text-[28px] font-extrabold leading-9 tracking-tight">
            Who are you?
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Pick your name once and this device remembers you. You get your own
            page with your games, rating, milestones and trophies. There is no
            password, and you can switch any time.
          </p>
          <div className="flex justify-center">
            <ClaimPlayer options={players.filter((p) => !p.archived)} />
          </div>
          <p className="mx-auto max-w-sm text-xs text-muted">
            On iPhone, the installed app and Safari don&apos;t share memory, so
            pick your name once in each.
          </p>
        </div>
      </div>
    );
  }

  const playerId = me.playerId;
  const [players, games, access, votedAwards] = await Promise.all([
    listPlayers(),
    listGames(),
    getAccess(),
    listVotedAwards(),
  ]);
  const player = players.find((p) => p.id === playerId);
  const career = careerTotals(games, players);
  const c = career.find((x) => x.playerId === playerId);
  // Cookie points at a player who vanished between the two lookups: show the picker next time.
  if (!player || !c) return <MissingPlayer />;

  const finalGames = games.filter((g) => g.status === "final");
  const { rows, qualifyAt, totalGames } = rankPlayers(
    career,
    "rating",
    finalGames.length,
  );
  const ranked = rows.find((r) => r.playerId === playerId);

  // Everything this player has finished, newest first.
  const log = finalGames
    .flatMap((game) => {
      const line = game.lines.find((l) => l.playerId === playerId);
      if (!line) return [];
      const r = rateLine(line, gameContext(game.lines, game.target, game));
      const mine = game.score[line.team];
      const theirs = game.score[line.team === "A" ? "B" : "A"];
      return [
        {
          game,
          line,
          rating: r?.rating ?? null,
          mine,
          theirs,
          result: (mine > theirs ? "W" : mine < theirs ? "L" : "T") as
            | "W"
            | "L"
            | "T",
        },
      ];
    })
    .sort((a, b) => b.game.startMs - a.game.startMs || b.game.id - a.game.id);

  const last = log[0];
  const lastIsPog = last
    ? playerOfTheGame(last.game)?.line.playerId === playerId
    : false;
  const liveGame = games.find(
    (g) => g.status === "live" && g.lines.some((l) => l.playerId === playerId),
  );

  const trend: TrendPoint[] = [...log]
    .reverse()
    .flatMap((e) =>
      e.rating === null
        ? []
        : [
            {
              gameId: e.game.id,
              date: formatShortDay(e.game.playedAt),
              rating: e.rating,
              result: e.result,
              score: `${e.mine}–${e.theirs}`,
            } satisfies TrendPoint,
          ],
    )
    .slice(-TREND_GAMES);

  const playerNames = new Map<number, string>(players.map((p) => [p.id, p.name]));
  const shelf = shelfEntries(
    trophyShelf(
      games,
      leagueTimeZone(),
      leagueGameDay(),
      access.now,
      votedAwards,
      playerNames,
    ).get(playerId),
  );
  const timeZone = leagueTimeZone();
  const sMode = seasonMode();
  const currentSeasonKey = seasonKey(access.now, timeZone, sMode);
  const sLabel = seasonLabel(currentSeasonKey);
  const seasons = groupBySeason(games, timeZone, sMode);
  const currentSeason = seasons.find((s) => s.key === currentSeasonKey);
  const seasonGames = currentSeason ? currentSeason.games : [];

  const clutch = clutchTotals(games).find((x) => x.playerId === playerId);
  // Archetypes compare against fixed bars, so feed them stats standardized to a game to 20.
  const standardAllTime =
    careerTotals(games, players, { standardize: true }).find((x) => x.playerId === playerId) ?? c;
  const allTimeArchetype = computePlayerArchetype(standardAllTime, clutch, finalGames.length);

  const seasonCareer = careerTotals(seasonGames, players);
  const seasonC = seasonCareer.find((x) => x.playerId === playerId) ?? {
    ...c,
    gp: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    defl: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    tov: 0,
    plusMinus: 0,
  };
  const seasonClutch = clutchTotals(seasonGames).find((x) => x.playerId === playerId);
  const standardSeason =
    careerTotals(seasonGames, players, { standardize: true }).find((x) => x.playerId === playerId) ??
    seasonC;
  const seasonArchetype = computePlayerArchetype(standardSeason, seasonClutch, seasonGames.length);

  const archetypeView = {
    seasonLabel: `${sLabel} Season`,
    season: seasonArchetype,
    allTime: allTimeArchetype,
    defaultView: (seasonC.gp >= 2 ? "season" : c.gp >= 2 ? "allTime" : "season") as "season" | "allTime",
  };
  const milestones = getPlayerMilestones(c);
  const scoutingReport = generateScoutingReport({
    playerId,
    playerName: player.name,
    career: c,
    games,
    clutch,
  });

  const resultTone = (r: "W" | "L" | "T") =>
    r === "W" ? "text-win" : r === "L" ? "text-loss" : "text-muted";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar
          id={player.id}
          name={player.name}
          size="lg"
          tone="ink"
          jersey={player.jersey}
        />
        <div className="min-w-0">
          <div className="label text-muted">Your page</div>
          <h1 className="truncate text-[32px] font-extrabold leading-[38px] tracking-tight">
            {player.name}
          </h1>
          <p className="tabular text-sm font-semibold text-muted">
            {c.gp} {c.gp === 1 ? "game" : "games"} · {c.wins}-{c.losses}
            {c.gp > 0 && <> · {fmtMinutes(c.sec / c.gp)} min/g</>}
          </p>
        </div>
      </div>

      <JerseyEditor playerId={player.id} currentJersey={player.jersey} />

      {liveGame && (
        <Link
          href={`/games/${liveGame.id}`}
          className="glass-2 flex items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-win/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-win" />
            You&apos;re in a live game
          </div>
          <span className="text-sm font-semibold text-court-ink">Open →</span>
        </Link>
      )}

      {ranked && (
        <Link
          href="/rankings"
          className="glass-2 flex items-center justify-between rounded-2xl p-4 active:scale-[0.99]"
        >
          <div>
            <div className="label text-muted">League rank</div>
            <div className="text-3xl font-extrabold tracking-tight">
              {ranked.rank ? (
                `#${ranked.rank}`
              ) : (
                <span className="text-2xl text-muted">Under threshold</span>
              )}
            </div>
            {ranked.rank === null && (
              <p className="text-xs font-medium text-muted">
                Needs {qualifyAt} of {totalGames} games to qualify
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="label text-muted">Rating</div>
            <div className="tabular text-3xl font-extrabold tracking-tight text-court-ink">
              {ranked.rating.toFixed(1)}
              <span className="text-sm font-bold text-muted">/10</span>
            </div>
          </div>
        </Link>
      )}

      {last ? (
        <Link
          href={`/games/${last.game.id}`}
          className="glass-2 block space-y-2 rounded-2xl p-4 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="label text-muted">
              Your last game · {formatShortDay(last.game.playedAt)}
            </div>
            <div className={`tabular text-sm font-extrabold ${resultTone(last.result)}`}>
              {last.result} {last.mine}–{last.theirs}
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {statSummary(last.line)}
              </div>
              {lastIsPog && (
                <div className="text-xs font-bold text-court-ink">
                  ⭐ Player of the game
                </div>
              )}
            </div>
            {last.rating !== null && (
              <div className="tabular text-3xl font-extrabold tracking-tight text-court-ink">
                {last.rating.toFixed(1)}
              </div>
            )}
          </div>
        </Link>
      ) : (
        <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
          No finished games yet. Your feed fills in after your first game.
        </p>
      )}

      {shelf.length > 0 && (
        <section className="space-y-2">
          <h2 className="label px-1">Trophies &amp; honors</h2>
          <div className="flex flex-wrap gap-2">
            {shelf.map((t) => (
              <span
                key={t.label}
                className="tabular flex items-center gap-1.5 rounded-full bg-court-soft/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-court-soft/25"
              >
                <span aria-hidden>🏆</span>
                {t.label}
                {t.count > 1 && (
                  <span className="font-extrabold text-court-ink">×{t.count}</span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      <PlayerMilestonesCard milestones={milestones} />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="label">Rating trend</h2>
          {trend.length >= 2 && (
            <span className="text-xs font-semibold text-muted">
              Last {trend.length} games
            </span>
          )}
        </div>
        {trend.length >= 2 ? (
          <RatingTrend points={trend} />
        ) : (
          <p className="glass-1 rounded-2xl p-5 text-center text-sm text-muted">
            The trend appears after two rated games.
          </p>
        )}
      </section>

      {log.length > 1 && (
        <section className="space-y-2">
          <h2 className="label px-1">Recent games</h2>
          <div className="glass-2 divide-y divide-black/5 overflow-hidden rounded-2xl">
            {log.slice(0, RECENT_GAMES).map((e) => (
              <Link
                key={e.game.id}
                href={`/games/${e.game.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-black/[0.04]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {statSummary(e.line)}
                  </div>
                  <div className="text-xs text-muted">
                    {formatShortDay(e.game.playedAt)}
                  </div>
                </div>
                <div className="flex items-baseline gap-3">
                  <span
                    className={`tabular text-sm font-extrabold ${resultTone(e.result)}`}
                  >
                    {e.result} {e.mine}–{e.theirs}
                  </span>
                  {e.rating !== null && (
                    <span className="tabular w-9 text-right text-sm font-bold text-court-ink">
                      {e.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <PlayerBadges viewData={archetypeView} playerId={player.id} />

      <PlayerScoutingReport report={scoutingReport} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
        <Link
          href={`/players/${player.id}`}
          className="text-sm font-semibold text-court-ink hover:underline"
        >
          Full profile &amp; game log →
        </Link>
        <SwitchPlayer className="text-sm font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-60" />
      </div>
    </div>
  );
}

function MissingPlayer() {
  return (
    <div className="glass-2 space-y-3 rounded-3xl p-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">
        We lost track of you
      </h1>
      <p className="text-sm text-muted">That player is no longer in the league.</p>
      <div className="flex justify-center">
        <SwitchPlayer className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper active:scale-95" />
      </div>
    </div>
  );
}

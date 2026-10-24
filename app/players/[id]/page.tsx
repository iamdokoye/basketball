import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { gameContext, rateLine } from "@/lib/rating";
import { pairStats, relationsFor, type Mate } from "@/lib/chemistry";
import { formatShortDay, leagueGameDay, leagueTimeZone } from "@/lib/format";
import { clutchTotals } from "@/lib/clutch";
import { singleGameRecords, winStreaks } from "@/lib/records";
import { shelfEntries, trophyShelf } from "@/lib/trophies";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers } from "@/lib/rankings";
import {
  fmtAvg,
  fmtEfg,
  fmtMinutes,
  fmtPct,
  fmtSigned,
  fmtTs,
} from "@/lib/stats";
import { formatDate } from "@/app/components/BoxScore";
import { Avatar } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import { InjuryToggle } from "@/app/components/InjuryToggle";
import { NicknamesButton } from "@/app/components/NicknamesEditor";
import { RenamePlayerButton } from "@/app/components/RenamePlayer";
import { RatingTrend, type TrendPoint } from "@/app/components/RatingTrend";
import { computePlayerArchetype } from "@/lib/badges";
import { getPlayerMilestones } from "@/lib/milestones";
import { PlayerBadges } from "@/app/components/PlayerBadges";
import { PlayerMilestonesCard } from "@/app/components/PlayerMilestonesCard";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  const [players, games, access] = await Promise.all([
    listPlayers(),
    listGames(),
    getAccess(),
  ]);
  const player = players.find((p) => p.id === playerId);
  if (!player) notFound();

  const career = careerTotals(games, players);
  const c = career.find((x) => x.playerId === playerId)!;
  const finalGames = games.filter((g) => g.status === "final");
  const { rows: rankedRows, qualifyAt, totalGames } = rankPlayers(career, "rating", finalGames.length);
  const ranked = rankedRows.find((r) => r.playerId === playerId);
  const log = games
    .filter((g) => g.status === "final")
    .flatMap((g) => {
      const line = g.lines.find((l) => l.playerId === playerId);
      return line ? [{ game: g, line }] : [];
    });

  const cards: [string, string][] = [
    ["PPG", fmtAvg(c.pts, c.gp)],
    ["RPG", fmtAvg(c.reb, c.gp)],
    ["APG", fmtAvg(c.ast, c.gp)],
    ["SPG", fmtAvg(c.stl, c.gp)],
    ["BPG", fmtAvg(c.blk, c.gp)],
    ["TOPG", fmtAvg(c.tov, c.gp)],
    ["FG%", fmtPct(c.fgm, c.fga)],
    ["3P%", fmtPct(c.fg3m, c.fg3a)],
    ["FT%", fmtPct(c.ftm, c.fta)],
    ["eFG%", fmtEfg(c)],
    ["TS%", fmtTs(c)],
    ["+/-", c.gp ? fmtSigned(c.plusMinus / c.gp, 1) : "–"],
  ];

  const shelf = shelfEntries(
    trophyShelf(games, leagueTimeZone(), leagueGameDay(), access.now).get(
      playerId,
    ),
  );
  const relations = relationsFor(playerId, pairStats(games));

  // Rating trend: the latest 15 rated games, oldest to newest.
  const TREND_GAMES = 15;
  const trend: TrendPoint[] = [...log]
    .sort((a, b) => a.game.startMs - b.game.startMs || a.game.id - b.game.id)
    .flatMap(({ game, line }) => {
      const r = rateLine(line, gameContext(game.lines));
      if (!r) return [];
      const mine = game.score[line.team];
      const theirs = game.score[line.team === "A" ? "B" : "A"];
      return [
        {
          gameId: game.id,
          date: formatShortDay(game.playedAt),
          rating: r.rating,
          result: mine > theirs ? "W" : mine < theirs ? "L" : "T",
          score: `${mine}–${theirs}`,
        } satisfies TrendPoint,
      ];
    })
    .slice(-TREND_GAMES);

  // Personal bests, game-winners and clutch points.
  const BEST_LABELS: Record<string, string> = {
    pts: "Points",
    reb: "Rebounds",
    ast: "Assists",
    stl: "Steals",
    blk: "Blocks",
    fg3m: "Threes",
    rating: "Rating",
  };
  const bests = singleGameRecords(games, playerId);
  const streak = winStreaks(games).find((x) => x.playerId === playerId);
  const clutch = clutchTotals(games).find((x) => x.playerId === playerId);
  const archetype = computePlayerArchetype(c, clutch);
  const milestones = getPlayerMilestones(c);

  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-2 text-right";

  return (
    <div className="space-y-5">
      <Link
        href="/players"
        className="px-1 text-sm font-semibold text-muted hover:underline"
      >
        ← Players
      </Link>

      <div className="flex items-center gap-4">
        <Avatar id={player.id} name={player.name} size="lg" tone="ink" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[32px] font-extrabold leading-[38px] tracking-tight">
              {player.name}
            </h1>
            {player.injured && <InjuredBadge />}
          </div>
          <p className="tabular text-sm font-semibold text-muted">
            {c.gp} {c.gp === 1 ? "game" : "games"} · {c.wins}-{c.losses}
            {c.gp > 0 && <> · {fmtMinutes(c.sec / c.gp)} min/g</>}
          </p>
          {player.nicknames.length > 0 && (
            <p className="truncate text-sm font-semibold text-court-ink">
              aka {player.nicknames.join(", ")}
            </p>
          )}
          {(access.canPlay || access.isAdmin) && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              <InjuryToggle
                playerId={player.id}
                injured={player.injured}
                name={player.name}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition hover:opacity-90 active:scale-95 ${
                  player.injured
                    ? "bg-rose-500/15 text-rose-700 ring-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25"
                }`}
              />
              <NicknamesButton
                playerId={player.id}
                name={player.name}
                nicknames={player.nicknames}
                className="rounded-full bg-court-soft/40 px-3 py-1.5 text-xs font-semibold text-court-ink ring-1 ring-court/30 transition hover:bg-court-soft/60 active:scale-95"
              />
              {access.isAdmin && (
                <RenamePlayerButton
                  playerId={player.id}
                  name={player.name}
                  className="rounded-full bg-sub/10 px-3 py-1.5 text-xs font-semibold text-sub ring-1 ring-sub/25 transition hover:bg-sub/15 active:scale-95"
                />
              )}
            </div>
          )}
        </div>
      </div>

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
              ) : player.injured ? (
                <span className="text-2xl text-rose-600">Inactive</span>
              ) : (
                <span className="text-2xl text-muted">Under threshold</span>
              )}
            </div>
            {player.injured ? (
              <p className="text-xs font-medium text-rose-600">
                Injured · Averages frozen at {c.gp} {c.gp === 1 ? "game" : "games"}
              </p>
            ) : ranked.rank === null ? (
              <p className="text-xs font-medium text-muted">
                Needs {qualifyAt} of {totalGames} games (40%) to qualify
              </p>
            ) : null}
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

      {shelf.length > 0 && (
        <section className="space-y-2">
          <h2 className="label px-1">Trophy shelf</h2>
          <div className="flex flex-wrap gap-2">
            {shelf.map((t) => (
              <span
                key={t.label}
                className="tabular flex items-center gap-1.5 rounded-full bg-court-soft/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-court-soft/25"
              >
                <span aria-hidden>🏆</span>
                {t.label}
                {t.count > 1 && (
                  <span className="font-extrabold text-court-ink">
                    ×{t.count}
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      <PlayerBadges archetype={archetype} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="glass-1 rounded-2xl p-3 text-center">
            <div className="tabular text-2xl font-extrabold tracking-tight">
              {value}
            </div>
            <div className="label text-muted">{label}</div>
          </div>
        ))}
      </div>

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

      {(bests.length > 0 || clutch || (streak && streak.longest >= 2)) && (
        <section className="space-y-2">
          <h2 className="label px-1">Personal bests</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {bests.map((b) => (
              <Link
                key={b.id}
                href={`/games/${b.gameId}`}
                className="glass-1 rounded-2xl p-3 text-center active:scale-[0.98]"
              >
                <div className="tabular text-2xl font-extrabold tracking-tight">
                  {b.value}
                </div>
                <div className="label text-muted">{BEST_LABELS[b.id] ?? b.label}</div>
              </Link>
            ))}
            {streak && streak.longest >= 2 && (
              <div className="glass-1 rounded-2xl p-3 text-center">
                <div className="tabular text-2xl font-extrabold tracking-tight">
                  {streak.longest}
                </div>
                <div className="label text-muted">Win streak</div>
              </div>
            )}
            {clutch && clutch.gameWinners > 0 && (
              <Link
                href="/records#clutch"
                className="glass-1 rounded-2xl p-3 text-center active:scale-[0.98]"
              >
                <div className="tabular text-2xl font-extrabold tracking-tight">
                  {clutch.gameWinners} 🎯
                </div>
                <div className="label text-muted">Game-winners</div>
              </Link>
            )}
            {clutch && clutch.clutchPts > 0 && (
              <Link
                href="/records#clutch"
                className="glass-1 rounded-2xl p-3 text-center active:scale-[0.98]"
              >
                <div className="tabular text-2xl font-extrabold tracking-tight">
                  {clutch.clutchPts}
                </div>
                <div className="label text-muted">Clutch pts</div>
              </Link>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="label mb-2 px-1">Game log</h2>
        {log.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No finished games yet.
          </p>
        ) : (
          <div className="glass-2 overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="tabular w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="label text-muted">
                    <th className="sticky-cell px-3 py-2.5 text-left font-semibold">
                      Game
                    </th>
                    {[
                      "PTS",
                      "RTG",
                      "FG",
                      "3P",
                      "FT",
                      "REB",
                      "AST",
                      "STL",
                      "BLK",
                      "TO",
                      "+/-",
                      "MIN",
                    ].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {log.map(({ game, line }) => {
                    const mine = game.score[line.team];
                    const theirs = game.score[line.team === "A" ? "B" : "A"];
                    return (
                      <tr key={game.id}>
                        <td className="sticky-cell px-3 py-2">
                          <Link
                            href={`/games/${game.id}`}
                            className="hover:underline"
                          >
                            <span
                              className={`font-extrabold ${mine > theirs ? "text-win" : "text-loss"}`}
                            >
                              {mine > theirs ? "W" : "L"}
                            </span>{" "}
                            {mine}-{theirs}
                            <span className="block text-xs font-medium text-muted">
                              {formatDate(game.playedAt)}
                            </span>
                          </Link>
                        </td>
                        <td className={`${td} font-extrabold`}>{line.pts}</td>
                        <td className={`${td} font-bold`}>
                          {rateLine(
                            line,
                            gameContext(game.lines),
                          )?.rating.toFixed(1) ?? (
                            <span className="text-muted">DNP</span>
                          )}
                        </td>
                        <td className={td}>
                          {line.fgm}-{line.fga}
                        </td>
                        <td className={td}>
                          {line.fg3m}-{line.fg3a}
                        </td>
                        <td className={td}>
                          {line.ftm}-{line.fta}
                        </td>
                        <td className={td}>{line.reb}</td>
                        <td className={td}>{line.ast}</td>
                        <td className={td}>{line.stl}</td>
                        <td className={td}>{line.blk}</td>
                        <td className={td}>{line.tov}</td>
                        <td className={td}>{fmtSigned(line.plusMinus)}</td>
                        <td className={`${td} text-muted`}>
                          {fmtMinutes(line.sec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {(relations.teammates.length > 0 || relations.opponents.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MateList
            title="With (teammates)"
            empty="No games with teammates yet."
            rows={relations.teammates}
          />
          <MateList
            title="Against (opponents)"
            empty="No games against anyone yet."
            rows={relations.opponents}
          />
        </div>
      )}
    </div>
  );
}

/** Record with or against each other player: games, W-L and win rate. Most games first. */
function MateList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Mate[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="label px-1">{title}</h2>
      {rows.length === 0 ? (
        <p className="glass-1 rounded-2xl p-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="glass-1 divide-y divide-black/[0.06] rounded-2xl">
          {rows.slice(0, 8).map((m) => (
            <li key={m.playerId}>
              <Link
                href={`/players/${m.playerId}`}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
              >
                <span className="truncate font-semibold">{m.name}</span>
                <span className="tabular shrink-0 text-xs font-semibold text-muted">
                  <span className="font-extrabold text-ink">
                    {m.wins}-{m.losses}
                  </span>{" "}
                  · {Math.round((m.wins / m.gp) * 100)}% · {m.gp}{" "}
                  {m.gp === 1 ? "game" : "games"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

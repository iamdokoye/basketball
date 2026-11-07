import type { Game, Player } from "./queries";
import { gameContext, rateLine } from "./rating";
import { SHOT_ZONES, type ShotZoneId } from "./shotZones";
import type { StatLine, Team } from "./stats";

export type AssistedTeammateEntry = {
  playerId: number;
  playerName: string;
  count: number;
  pointsGenerated: number;
  twoPointers: number;
  threePointers: number;
};

export type BlockedOpponentEntry = {
  playerId: number;
  playerName: string;
  count: number;
};

export type StolenFromEntry = {
  playerId: number;
  playerName: string;
  count: number;
};

export type AssistedByEntry = {
  playerId: number;
  playerName: string;
  count: number;
  points: number;
};

export type BlockedByEntry = {
  playerId: number;
  playerName: string;
  count: number;
};

export type StolenByEntry = {
  playerId: number;
  playerName: string;
  count: number;
};

export type GameZoneShot = {
  zone: ShotZoneId;
  label: string;
  made: number;
  attempted: number;
};

export type PlayerGameInsight = {
  gameId: number;
  playedAt: string;
  startMs: number;
  gameType: "target" | "timed";
  status: "final" | "live";
  result: "W" | "L" | "T";
  score: { mine: number; theirs: number };
  team: Team;
  line: StatLine;
  rating: number | null;
  teammates: { id: number; name: string }[];
  opponents: { id: number; name: string }[];

  // Scoring details
  scoring: {
    totalPts: number;
    fgm: number;
    fga: number;
    fgPct: number;
    fg2m: number;
    fg2a: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    assistedMakesCount: number;
    unassistedMakesCount: number;
    assistedBy: AssistedByEntry[];
    zones: GameZoneShot[];
  };

  // Assists given (who did this player assist?)
  assists: {
    totalAst: number;
    assistedPlayers: AssistedTeammateEntry[];
    unattributedAst: number;
  };

  // Blocks made (who did this player block?)
  blocks: {
    totalBlk: number;
    blockedPlayers: BlockedOpponentEntry[];
    unattributedBlk: number;
  };

  // Steals made (who did this player steal from?)
  steals: {
    totalStl: number;
    stolenFromPlayers: StolenFromEntry[];
    unattributedStl: number;
  };

  // Turnovers suffered (who intercepted / stole from them?)
  turnovers: {
    totalTov: number;
    stolenByPlayers: StolenByEntry[];
    unattributedTov: number;
  };

  // Blocks suffered (who blocked this player's shots?)
  blockedBy: BlockedByEntry[];

  // Rebounds breakdown
  rebounds: {
    totalReb: number;
    oreb: number;
    dreb: number;
  };

  // Defensive disruptions
  defense: {
    defl: number;
    stocks: number; // stl + blk + defl
  };
};

export type PlayerHistoryCareerHighlights = {
  totalGames: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalPts: number;
  avgPts: number;
  totalAst: number;
  avgAst: number;
  totalBlk: number;
  totalStl: number;
  totalReb: number;
  topAssistedTeammates: {
    playerId: number;
    playerName: string;
    totalAssists: number;
    totalPointsGenerated: number;
    gamesCount: number;
  }[];
  topBlockVictims: {
    playerId: number;
    playerName: string;
    count: number;
    gamesCount: number;
  }[];
  topStealTargets: {
    playerId: number;
    playerName: string;
    count: number;
    gamesCount: number;
  }[];
  topPlaymakersAssisting: {
    playerId: number;
    playerName: string;
    count: number;
    gamesCount: number;
  }[];
  assistedBasketsPct: number;
  unassistedBasketsPct: number;
  highestScoringGame: {
    gameId: number;
    pts: number;
    date: string;
    result: string;
    score: string;
  } | null;
  highestAssistGame: {
    gameId: number;
    ast: number;
    date: string;
    result: string;
    score: string;
  } | null;
  highestBlockGame: {
    gameId: number;
    blk: number;
    date: string;
    result: string;
    score: string;
  } | null;
};

export type PlayerHistorySummary = {
  playerId: number;
  playerName: string;
  games: PlayerGameInsight[];
  highlights: PlayerHistoryCareerHighlights;
};

/**
 * Builds comprehensive game-by-game insights for a player, including
 * who they assisted, who they blocked, who assisted them, shot breakdown,
 * and overall career synergy highlights.
 */
export function buildPlayerGameInsights(
  playerId: number,
  games: Game[],
  players: Player[],
): PlayerHistorySummary {
  const playerNames = new Map<number, string>(players.map((p) => [p.id, p.name]));
  const targetPlayer = players.find((p) => p.id === playerId);
  const playerName = targetPlayer ? targetPlayer.name : "Player";

  // Filter for final games where this player logged a line
  const playerGames = games
    .filter((g) => g.status === "final")
    .filter((g) => g.lines.some((l) => l.playerId === playerId))
    .sort((a, b) => b.startMs - a.startMs || b.id - a.id);

  const gameInsights: PlayerGameInsight[] = [];

  // Career aggregation counters
  const careerAssistedTeammates = new Map<
    number,
    { assists: number; points: number; games: Set<number> }
  >();
  const careerBlockedOpponents = new Map<number, { count: number; games: Set<number> }>();
  const careerStolenTargets = new Map<number, { count: number; games: Set<number> }>();
  const careerAssistedBy = new Map<number, { count: number; games: Set<number> }>();

  let totalFgm = 0;
  let totalAssistedMakes = 0;
  let totalUnassistedMakes = 0;

  for (const game of playerGames) {
    const line = game.lines.find((l) => l.playerId === playerId)!;
    const myTeam = line.team;
    const opponentTeam = myTeam === "A" ? "B" : "A";
    const mine = game.score[myTeam];
    const theirs = game.score[opponentTeam];
    const result: "W" | "L" | "T" = mine > theirs ? "W" : mine < theirs ? "L" : "T";

    // Teammates and opponents
    const teammates = (game.roster ?? [])
      .filter((r) => r.team === myTeam && r.id !== playerId)
      .map((r) => ({ id: r.id, name: r.name || playerNames.get(r.id) || `Player #${r.id}` }));

    const opponents = (game.roster ?? [])
      .filter((r) => r.team === opponentTeam)
      .map((r) => ({ id: r.id, name: r.name || playerNames.get(r.id) || `Player #${r.id}` }));

    // Calculate rating
    const ratingCtx = gameContext(game.lines, game.target, game);
    const rated = rateLine(line, ratingCtx);
    const rating = rated ? Number(rated.rating.toFixed(1)) : null;

    // Group events by group ID (grp)
    const groups = new Map<string, typeof game.events>();
    for (const ev of game.events) {
      const list = groups.get(ev.grp) ?? [];
      list.push(ev);
      groups.set(ev.grp, list);
    }

    // Tracking per game
    const gameAssistsMap = new Map<
      number,
      { count: number; pointsGenerated: number; twoPointers: number; threePointers: number }
    >();
    const gameBlockedMap = new Map<number, number>();
    const gameStolenFromMap = new Map<number, number>();
    const gameAssistedByMap = new Map<number, { count: number; points: number }>();
    const gameBlockedByMap = new Map<number, number>();
    const gameStolenByMap = new Map<number, number>();

    let gameAssistedMakes = 0;
    let gameUnassistedMakes = 0;

    // Shot zones tracking
    const zoneAttemptsMap = new Map<ShotZoneId, { made: number; attempted: number }>();

    for (const evs of groups.values()) {
      // 1. Did this player assist a basket in this play group?
      const hasMyAst = evs.some((e) => e.type === "AST" && e.playerId === playerId);
      if (hasMyAst) {
        // Look for the teammate's made shot in the same group
        const teammateMake = evs.find(
          (e) => (e.type === "MAKE2" || e.type === "MAKE3") && e.playerId !== playerId,
        );
        if (teammateMake && teammateMake.playerId) {
          const tId = teammateMake.playerId;
          const is3 = teammateMake.type === "MAKE3";
          const pts = is3 ? 3 : 2;
          const cur = gameAssistsMap.get(tId) ?? {
            count: 0,
            pointsGenerated: 0,
            twoPointers: 0,
            threePointers: 0,
          };
          cur.count += 1;
          cur.pointsGenerated += pts;
          if (is3) cur.threePointers += 1;
          else cur.twoPointers += 1;
          gameAssistsMap.set(tId, cur);

          // Career aggregator
          const careerAst = careerAssistedTeammates.get(tId) ?? {
            assists: 0,
            points: 0,
            games: new Set<number>(),
          };
          careerAst.assists += 1;
          careerAst.points += pts;
          careerAst.games.add(game.id);
          careerAssistedTeammates.set(tId, careerAst);
        }
      }

      // 2. Did this player make a basket in this play group?
      const myMake = evs.find(
        (e) => (e.type === "MAKE2" || e.type === "MAKE3") && e.playerId === playerId,
      );
      if (myMake) {
        const is3 = myMake.type === "MAKE3";
        const pts = is3 ? 3 : 2;
        // Check if a teammate assisted it
        const assister = evs.find((e) => e.type === "AST" && e.playerId !== playerId);
        if (assister && assister.playerId) {
          gameAssistedMakes++;
          const aId = assister.playerId;
          const cur = gameAssistedByMap.get(aId) ?? { count: 0, points: 0 };
          cur.count += 1;
          cur.points += pts;
          gameAssistedByMap.set(aId, cur);

          // Career aggregator
          const careerAssister = careerAssistedBy.get(aId) ?? {
            count: 0,
            games: new Set<number>(),
          };
          careerAssister.count += 1;
          careerAssister.games.add(game.id);
          careerAssistedBy.set(aId, careerAssister);
        } else {
          gameUnassistedMakes++;
        }
      }

      // 3. Did this player record a block?
      const hasMyBlk = evs.some((e) => e.type === "BLK" && e.playerId === playerId);
      if (hasMyBlk) {
        // Look for the shooter who missed in this group
        const blockedShooter = evs.find(
          (e) => (e.type === "MISS2" || e.type === "MISS3") && e.playerId !== playerId,
        );
        if (blockedShooter && blockedShooter.playerId) {
          const sId = blockedShooter.playerId;
          gameBlockedMap.set(sId, (gameBlockedMap.get(sId) ?? 0) + 1);

          // Career aggregator
          const careerBlk = careerBlockedOpponents.get(sId) ?? {
            count: 0,
            games: new Set<number>(),
          };
          careerBlk.count += 1;
          careerBlk.games.add(game.id);
          careerBlockedOpponents.set(sId, careerBlk);
        }
      }

      // 4. Was this player's shot blocked by an opponent?
      const myMiss = evs.find(
        (e) => (e.type === "MISS2" || e.type === "MISS3") && e.playerId === playerId,
      );
      if (myMiss) {
        const blocker = evs.find((e) => e.type === "BLK" && e.playerId !== playerId);
        if (blocker && blocker.playerId) {
          const bId = blocker.playerId;
          gameBlockedByMap.set(bId, (gameBlockedByMap.get(bId) ?? 0) + 1);
        }
      }

      // 5. Did this player make a steal?
      const hasMyStl = evs.some((e) => e.type === "STL" && e.playerId === playerId);
      if (hasMyStl) {
        // Look for opponent turnover in same group
        const victim = evs.find((e) => e.type === "TOV" && e.playerId !== playerId);
        if (victim && victim.playerId) {
          const vId = victim.playerId;
          gameStolenFromMap.set(vId, (gameStolenFromMap.get(vId) ?? 0) + 1);

          // Career aggregator
          const careerStl = careerStolenTargets.get(vId) ?? {
            count: 0,
            games: new Set<number>(),
          };
          careerStl.count += 1;
          careerStl.games.add(game.id);
          careerStolenTargets.set(vId, careerStl);
        }
      }

      // 6. Did this player turn the ball over and get stripped?
      const hasMyTov = evs.some((e) => e.type === "TOV" && e.playerId === playerId);
      if (hasMyTov) {
        const stealer = evs.find((e) => e.type === "STL" && e.playerId !== playerId);
        if (stealer && stealer.playerId) {
          const stId = stealer.playerId;
          gameStolenByMap.set(stId, (gameStolenByMap.get(stId) ?? 0) + 1);
        }
      }

      // 7. Shot Zone recording
      const zoneEvent = evs.find((e) => e.type === "ZONE" && e.zone);
      const shotByMe = evs.find(
        (e) =>
          (e.type === "MAKE2" || e.type === "MAKE3" || e.type === "MISS2" || e.type === "MISS3") &&
          e.playerId === playerId,
      );
      if (zoneEvent && zoneEvent.zone && shotByMe) {
        const z = zoneEvent.zone;
        const cur = zoneAttemptsMap.get(z) ?? { made: 0, attempted: 0 };
        cur.attempted += 1;
        if (shotByMe.type === "MAKE2" || shotByMe.type === "MAKE3") {
          cur.made += 1;
        }
        zoneAttemptsMap.set(z, cur);
      }
    }

    // Reconcile attributed with official stat line:
    // If total ast in line > sum of attributed, the remainder is unattributed
    const attributedAstCount = Array.from(gameAssistsMap.values()).reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const unattributedAst = Math.max(0, line.ast - attributedAstCount);

    const attributedBlkCount = Array.from(gameBlockedMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );
    const unattributedBlk = Math.max(0, line.blk - attributedBlkCount);

    const attributedStlCount = Array.from(gameStolenFromMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );
    const unattributedStl = Math.max(0, line.stl - attributedStlCount);

    const attributedTovCount = Array.from(gameStolenByMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );
    const unattributedTov = Math.max(0, line.tov - attributedTovCount);

    // If game has makes but events weren't grouped with assists, adjust unassisted/assisted count
    if (line.fgm > gameAssistedMakes + gameUnassistedMakes) {
      gameUnassistedMakes += line.fgm - (gameAssistedMakes + gameUnassistedMakes);
    }

    totalFgm += line.fgm;
    totalAssistedMakes += gameAssistedMakes;
    totalUnassistedMakes += gameUnassistedMakes;

    // Build assisted teammates list
    const assistedPlayers: AssistedTeammateEntry[] = Array.from(gameAssistsMap.entries())
      .map(([tId, data]) => ({
        playerId: tId,
        playerName: playerNames.get(tId) || `Player #${tId}`,
        count: data.count,
        pointsGenerated: data.pointsGenerated,
        twoPointers: data.twoPointers,
        threePointers: data.threePointers,
      }))
      .sort((a, b) => b.count - a.count || b.pointsGenerated - a.pointsGenerated);

    // Build blocked opponents list
    const blockedPlayers: BlockedOpponentEntry[] = Array.from(gameBlockedMap.entries())
      .map(([oId, count]) => ({
        playerId: oId,
        playerName: playerNames.get(oId) || `Player #${oId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Build stolen from opponents list
    const stolenFromPlayers: StolenFromEntry[] = Array.from(gameStolenFromMap.entries())
      .map(([oId, count]) => ({
        playerId: oId,
        playerName: playerNames.get(oId) || `Player #${oId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Build assisted by teammates list
    const assistedBy: AssistedByEntry[] = Array.from(gameAssistedByMap.entries())
      .map(([aId, data]) => ({
        playerId: aId,
        playerName: playerNames.get(aId) || `Player #${aId}`,
        count: data.count,
        points: data.points,
      }))
      .sort((a, b) => b.count - a.count);

    // Build blocked by opponents list
    const blockedBy: BlockedByEntry[] = Array.from(gameBlockedByMap.entries())
      .map(([bId, count]) => ({
        playerId: bId,
        playerName: playerNames.get(bId) || `Player #${bId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Build stolen by opponents list
    const stolenByPlayers: StolenByEntry[] = Array.from(gameStolenByMap.entries())
      .map(([sId, count]) => ({
        playerId: sId,
        playerName: playerNames.get(sId) || `Player #${sId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Build zones list
    const zones: GameZoneShot[] = (Object.keys(SHOT_ZONES) as ShotZoneId[]).flatMap((zid) => {
      const data = zoneAttemptsMap.get(zid);
      if (!data || data.attempted === 0) return [];
      return [
        {
          zone: zid,
          label: SHOT_ZONES[zid].label,
          made: data.made,
          attempted: data.attempted,
        },
      ];
    });

    const fgPct = line.fga > 0 ? (line.fgm / line.fga) * 100 : 0;

    gameInsights.push({
      gameId: game.id,
      playedAt: game.playedAt,
      startMs: game.startMs,
      gameType: game.gameType ?? "target",
      status: game.status,
      result,
      score: { mine, theirs },
      team: myTeam,
      line,
      rating,
      teammates,
      opponents,
      scoring: {
        totalPts: line.pts,
        fgm: line.fgm,
        fga: line.fga,
        fgPct,
        fg2m: line.fg2m,
        fg2a: line.fg2a,
        fg3m: line.fg3m,
        fg3a: line.fg3a,
        ftm: line.ftm,
        fta: line.fta,
        assistedMakesCount: gameAssistedMakes,
        unassistedMakesCount: gameUnassistedMakes,
        assistedBy,
        zones,
      },
      assists: {
        totalAst: line.ast,
        assistedPlayers,
        unattributedAst,
      },
      blocks: {
        totalBlk: line.blk,
        blockedPlayers,
        unattributedBlk,
      },
      steals: {
        totalStl: line.stl,
        stolenFromPlayers,
        unattributedStl,
      },
      turnovers: {
        totalTov: line.tov,
        stolenByPlayers,
        unattributedTov,
      },
      blockedBy,
      rebounds: {
        totalReb: line.reb,
        oreb: line.oreb,
        dreb: line.dreb,
      },
      defense: {
        defl: line.defl,
        stocks: line.stl + line.blk + line.defl,
      },
    });
  }

  // Career Highlights Aggregation
  const totalGames = gameInsights.length;
  const wins = gameInsights.filter((g) => g.result === "W").length;
  const losses = gameInsights.filter((g) => g.result === "L").length;
  const winRatePct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const totalPts = gameInsights.reduce((sum, g) => sum + g.line.pts, 0);
  const totalAst = gameInsights.reduce((sum, g) => sum + g.line.ast, 0);
  const totalBlk = gameInsights.reduce((sum, g) => sum + g.line.blk, 0);
  const totalStl = gameInsights.reduce((sum, g) => sum + g.line.stl, 0);
  const totalReb = gameInsights.reduce((sum, g) => sum + g.line.reb, 0);

  const avgPts = totalGames > 0 ? Number((totalPts / totalGames).toFixed(1)) : 0;
  const avgAst = totalGames > 0 ? Number((totalAst / totalGames).toFixed(1)) : 0;

  const topAssistedTeammates = Array.from(careerAssistedTeammates.entries())
    .map(([tId, data]) => ({
      playerId: tId,
      playerName: playerNames.get(tId) || `Player #${tId}`,
      totalAssists: data.assists,
      totalPointsGenerated: data.points,
      gamesCount: data.games.size,
    }))
    .sort((a, b) => b.totalAssists - a.totalAssists || b.totalPointsGenerated - a.totalPointsGenerated)
    .slice(0, 5);

  const topBlockVictims = Array.from(careerBlockedOpponents.entries())
    .map(([oId, data]) => ({
      playerId: oId,
      playerName: playerNames.get(oId) || `Player #${oId}`,
      count: data.count,
      gamesCount: data.games.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topStealTargets = Array.from(careerStolenTargets.entries())
    .map(([oId, data]) => ({
      playerId: oId,
      playerName: playerNames.get(oId) || `Player #${oId}`,
      count: data.count,
      gamesCount: data.games.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topPlaymakersAssisting = Array.from(careerAssistedBy.entries())
    .map(([aId, data]) => ({
      playerId: aId,
      playerName: playerNames.get(aId) || `Player #${aId}`,
      count: data.count,
      gamesCount: data.games.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const assistedBasketsPct =
    totalFgm > 0 ? Math.round((totalAssistedMakes / totalFgm) * 100) : 0;
  const unassistedBasketsPct =
    totalFgm > 0 ? Math.round((totalUnassistedMakes / totalFgm) * 100) : 0;

  // Single game career bests in game insights
  let highestScoringGame: PlayerHistoryCareerHighlights["highestScoringGame"] = null;
  let highestAssistGame: PlayerHistoryCareerHighlights["highestAssistGame"] = null;
  let highestBlockGame: PlayerHistoryCareerHighlights["highestBlockGame"] = null;

  for (const g of gameInsights) {
    if (!highestScoringGame || g.line.pts > highestScoringGame.pts) {
      highestScoringGame = {
        gameId: g.gameId,
        pts: g.line.pts,
        date: g.playedAt,
        result: g.result,
        score: `${g.score.mine}–${g.score.theirs}`,
      };
    }
    if (!highestAssistGame || g.line.ast > highestAssistGame.ast) {
      highestAssistGame = {
        gameId: g.gameId,
        ast: g.line.ast,
        date: g.playedAt,
        result: g.result,
        score: `${g.score.mine}–${g.score.theirs}`,
      };
    }
    if (!highestBlockGame || g.line.blk > highestBlockGame.blk) {
      highestBlockGame = {
        gameId: g.gameId,
        blk: g.line.blk,
        date: g.playedAt,
        result: g.result,
        score: `${g.score.mine}–${g.score.theirs}`,
      };
    }
  }

  return {
    playerId,
    playerName,
    games: gameInsights,
    highlights: {
      totalGames,
      wins,
      losses,
      winRatePct,
      totalPts,
      avgPts,
      totalAst,
      avgAst,
      totalBlk,
      totalStl,
      totalReb,
      topAssistedTeammates,
      topBlockVictims,
      topStealTargets,
      topPlaymakersAssisting,
      assistedBasketsPct,
      unassistedBasketsPct,
      highestScoringGame,
      highestAssistGame,
      highestBlockGame,
    },
  };
}

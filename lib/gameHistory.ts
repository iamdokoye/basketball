import type { Game } from "./queries";
import { formatClock } from "./clock";
import { POINTS, type EventType, type Team } from "./stats";

export type GameAssistInsight = {
  assisterId: number;
  assisterName: string;
  assisterTeam: Team;
  scorerId: number;
  scorerName: string;
  scorerTeam: Team;
  count: number;
  pointsGenerated: number;
  twoPointers: number;
  threePointers: number;
};

export type GameBlockInsight = {
  blockerId: number;
  blockerName: string;
  blockerTeam: Team;
  shooterId: number;
  shooterName: string;
  shooterTeam: Team;
  count: number;
};

export type GameStealInsight = {
  stealerId: number;
  stealerName: string;
  stealerTeam: Team;
  victimId: number;
  victimName: string;
  victimTeam: Team;
  count: number;
};

export type GameTeamCreationInsight = {
  team: Team;
  totalFgm: number;
  assistedMakes: number;
  unassistedMakes: number;
  assistedPct: number;
  unassistedPct: number;
};

export type GameChronologicalPlay = {
  step: number;
  grp: string;
  at: number;
  elapsedMs: number;
  timeStr: string;
  team: Team | null;
  type: string;
  icon: string;
  title: string;
  detail: string;
  scoreAfter: { A: number; B: number };
  marginAfter: number; // A - B
  leaderAfter: Team | "TIE";
  primaryPlayer?: { id: number; name: string; team?: Team };
  secondaryPlayer?: { id: number; name: string; team?: Team };
  isScoring: boolean;
  ptsScored: number;
  isClutch: boolean;
};

export type GameHistoryInsights = {
  gameId: number;
  assists: GameAssistInsight[];
  unattributedAssists: number;
  blocks: GameBlockInsight[];
  unattributedBlocks: number;
  steals: GameStealInsight[];
  unattributedSteals: number;
  teamCreation: {
    A: GameTeamCreationInsight;
    B: GameTeamCreationInsight;
  };
  plays: GameChronologicalPlay[];
  leadChanges: number;
  timesTied: number;
  biggestRun: { team: Team; pts: number } | null;
  totalPlays: number;
};

/**
 * Builds full game history and play-by-play insights for a game,
 * including who assisted who, who blocked who, who stole from who,
 * team shot creation ratios, and a chronological play-by-play log with running score.
 */
export function buildGameHistoryInsights(game: Game): GameHistoryInsights {
  const rosterMap = new Map<number, { name: string; team: Team }>();
  for (const r of game.roster) {
    rosterMap.set(r.id, { name: r.name, team: r.team });
  }

  const nameOf = (id: number): string => rosterMap.get(id)?.name || `Player #${id}`;
  const teamOf = (id: number): Team | null => rosterMap.get(id)?.team || null;

  // Group events by grp
  const groupsMap = new Map<string, typeof game.events>();
  const groupFirstAt = new Map<string, number>();
  const groupOrder: string[] = [];

  for (const ev of game.events) {
    if (!groupsMap.has(ev.grp)) {
      groupsMap.set(ev.grp, []);
      groupOrder.push(ev.grp);
      groupFirstAt.set(ev.grp, ev.at);
    }
    groupsMap.get(ev.grp)!.push(ev);
  }

  // Sort groups by time
  groupOrder.sort((a, b) => (groupFirstAt.get(a) ?? 0) - (groupFirstAt.get(b) ?? 0));

  // Matrices for assists, blocks, steals
  const assistPairs = new Map<
    string,
    {
      assisterId: number;
      scorerId: number;
      count: number;
      pts: number;
      twoPointers: number;
      threePointers: number;
    }
  >();
  const blockPairs = new Map<
    string,
    { blockerId: number; shooterId: number; count: number }
  >();
  const stealPairs = new Map<
    string,
    { stealerId: number; victimId: number; count: number }
  >();

  let unattributedAssists = 0;
  let unattributedBlocks = 0;
  let unattributedSteals = 0;

  const teamMakes = {
    A: { totalFgm: 0, assisted: 0, unassisted: 0 },
    B: { totalFgm: 0, assisted: 0, unassisted: 0 },
  };

  const plays: GameChronologicalPlay[] = [];
  let scoreA = 0;
  let scoreB = 0;
  let leadChanges = 0;
  let timesTied = 0;
  let lastLeader: Team | null = null;

  // Run tracker
  let currentRunTeam: Team | null = null;
  let currentRunPts = 0;
  let biggestRun: { team: Team; pts: number } | null = null;

  let step = 1;

  for (const grp of groupOrder) {
    const evs = groupsMap.get(grp)!;
    const firstEv = evs[0];
    const at = firstEv.at;
    const elapsedMs = Math.max(0, at - game.startMs);
    const timeStr = formatClock(elapsedMs);

    const find = (...types: EventType[]) => evs.find((e) => types.includes(e.type));
    const make = find("MAKE2", "MAKE3", "MAKE_FT");
    const miss = find("MISS2", "MISS3", "MISS_FT");
    const blk = find("BLK");
    const stl = find("STL");
    const reb = find("OREB", "DREB");
    const ast = find("AST");
    const tov = find("TOV");
    const foul = find("FOUL");
    const defl = find("DEFL");
    const subIn = find("SUB_IN");
    const subOut = find("SUB_OUT");
    const clockEv = find("PAUSE", "RESUME", "TIMEOUT", "POSS");

    let isScoring = false;
    let ptsScored = 0;
    let playTeam: Team | null = null;
    let primaryPlayer: { id: number; name: string; team?: Team } | undefined;
    let secondaryPlayer: { id: number; name: string; team?: Team } | undefined;
    let icon = "⚡";
    let title = "";
    let detail = "";

    // 1. Scoring Play
    if (make) {
      isScoring = true;
      const pts = POINTS[make.type] ?? 0;
      ptsScored = pts;
      const sId = make.playerId;
      const sTeam = teamOf(sId) ?? make.team ?? "A";
      playTeam = sTeam;
      primaryPlayer = { id: sId, name: nameOf(sId), team: sTeam };

      if (sTeam === "A") scoreA += pts;
      else scoreB += pts;

      const isThree = make.type === "MAKE3";
      const isFt = make.type === "MAKE_FT";
      icon = isThree ? "🎯" : isFt ? "🏀" : "⛹️";

      if (!isFt) {
        teamMakes[sTeam].totalFgm += 1;
      }

      if (ast && ast.playerId && ast.playerId !== sId) {
        const aId = ast.playerId;
        const aTeam = teamOf(aId) ?? sTeam;
        secondaryPlayer = { id: aId, name: nameOf(aId), team: aTeam };

        if (!isFt) {
          teamMakes[sTeam].assisted += 1;
        }

        title = `${nameOf(sId)} hit a ${isThree ? "3-pointer" : "2-pointer"}`;
        detail = `Assisted by ${nameOf(aId)}`;

        // Pair tracking
        const k = `${aId}->${sId}`;
        const cur = assistPairs.get(k) ?? {
          assisterId: aId,
          scorerId: sId,
          count: 0,
          pts: 0,
          twoPointers: 0,
          threePointers: 0,
        };
        cur.count += 1;
        cur.pts += pts;
        if (isThree) cur.threePointers += 1;
        else cur.twoPointers += 1;
        assistPairs.set(k, cur);
      } else {
        if (!isFt) {
          teamMakes[sTeam].unassisted += 1;
        }
        title = `${nameOf(sId)} made a ${isFt ? "free throw" : isThree ? "3-pointer" : "2-pointer"}`;
        detail = isFt ? "Free throw" : "Unassisted make";
      }

      // Track scoring runs
      if (currentRunTeam === sTeam) {
        currentRunPts += pts;
      } else {
        currentRunTeam = sTeam;
        currentRunPts = pts;
      }
      if (!biggestRun || currentRunPts > biggestRun.pts) {
        biggestRun = { team: sTeam, pts: currentRunPts };
      }
    }
    // 2. Missed Shot (with possible Block and Rebound)
    else if (miss) {
      const sId = miss.playerId;
      const sTeam = teamOf(sId) ?? miss.team ?? "A";
      playTeam = sTeam;
      primaryPlayer = { id: sId, name: nameOf(sId), team: sTeam };
      const isThree = miss.type === "MISS3";
      const isFt = miss.type === "MISS_FT";
      icon = "❌";

      if (blk && blk.playerId && blk.playerId !== sId) {
        const bId = blk.playerId;
        const bTeam = teamOf(bId) ?? (sTeam === "A" ? "B" : "A");
        secondaryPlayer = { id: bId, name: nameOf(bId), team: bTeam };
        icon = "🧱";
        title = `${nameOf(sId)} missed a ${isThree ? "3-pointer" : "2-pointer"}`;
        detail = `Blocked by ${nameOf(bId)}`;

        const k = `${bId}->${sId}`;
        const cur = blockPairs.get(k) ?? { blockerId: bId, shooterId: sId, count: 0 };
        cur.count += 1;
        blockPairs.set(k, cur);
      } else {
        title = `${nameOf(sId)} missed a ${isFt ? "free throw" : isThree ? "3-pointer" : "2-pointer"}`;
        detail = "Shot missed";
      }

      if (reb && reb.playerId) {
        const rId = reb.playerId;
        const isOff = reb.type === "OREB";
        detail += `${detail ? " · " : ""}${isOff ? "Offensive" : "Defensive"} rebound by ${nameOf(rId)}`;
      }
    }
    // 3. Steal / Turnover
    else if (stl) {
      const stId = stl.playerId;
      const stTeam = teamOf(stId) ?? "A";
      playTeam = stTeam;
      primaryPlayer = { id: stId, name: nameOf(stId), team: stTeam };
      icon = "🥷";

      if (tov && tov.playerId && tov.playerId !== stId) {
        const vId = tov.playerId;
        const vTeam = teamOf(vId) ?? (stTeam === "A" ? "B" : "A");
        secondaryPlayer = { id: vId, name: nameOf(vId), team: vTeam };
        title = `${nameOf(stId)} steal`;
        detail = `Turnover forced from ${nameOf(vId)}`;

        const k = `${stId}->${vId}`;
        const cur = stealPairs.get(k) ?? { stealerId: stId, victimId: vId, count: 0 };
        cur.count += 1;
        stealPairs.set(k, cur);
      } else {
        title = `${nameOf(stId)} steal`;
        detail = "Takeaway";
        unattributedSteals += 1;
      }
    }
    // 4. Standalone Block
    else if (blk) {
      const bId = blk.playerId;
      const bTeam = teamOf(bId) ?? "A";
      playTeam = bTeam;
      primaryPlayer = { id: bId, name: nameOf(bId), team: bTeam };
      icon = "🧱";
      title = `${nameOf(bId)} blocked shot`;
      detail = "Rejection at the rim";
      unattributedBlocks += 1;
    }
    // 5. Standalone Assist
    else if (ast) {
      const aId = ast.playerId;
      const aTeam = teamOf(aId) ?? "A";
      playTeam = aTeam;
      primaryPlayer = { id: aId, name: nameOf(aId), team: aTeam };
      icon = "🪄";
      title = `${nameOf(aId)} assist`;
      detail = "Dime";
      unattributedAssists += 1;
    }
    // 6. Standalone Turnover
    else if (tov) {
      const tId = tov.playerId;
      const tTeam = teamOf(tId) ?? "A";
      playTeam = tTeam;
      primaryPlayer = { id: tId, name: nameOf(tId), team: tTeam };
      icon = "⚠️";
      title = `${nameOf(tId)} turnover`;
      detail = "Lost possession";
    }
    // 7. Standalone Rebound
    else if (reb) {
      const rId = reb.playerId;
      const rTeam = teamOf(rId) ?? "A";
      playTeam = rTeam;
      primaryPlayer = { id: rId, name: nameOf(rId), team: rTeam };
      const isOff = reb.type === "OREB";
      icon = "🦍";
      title = `${nameOf(rId)} ${isOff ? "offensive" : "defensive"} rebound`;
      detail = isOff ? "Second chance opportunity" : "Secured defensive glass";
    }
    // 8. Foul / Deflection
    else if (foul || defl) {
      const ev = foul ?? defl!;
      const pId = ev.playerId;
      const pTeam = teamOf(pId) ?? "A";
      playTeam = pTeam;
      primaryPlayer = { id: pId, name: nameOf(pId), team: pTeam };
      icon = foul ? "🛑" : "⚡";
      title = `${nameOf(pId)} ${foul ? "personal foul" : "deflection"}`;
      detail = foul ? "Foul called" : "Disrupted pass/play";
    }
    // 9. Substitution
    else if (subIn || subOut) {
      icon = "🔄";
      playTeam = subIn ? teamOf(subIn.playerId) : subOut ? teamOf(subOut.playerId) : null;
      if (subIn && subOut) {
        title = "Substitution";
        detail = `${nameOf(subIn.playerId)} in for ${nameOf(subOut.playerId)}`;
        primaryPlayer = { id: subIn.playerId, name: nameOf(subIn.playerId) };
        secondaryPlayer = { id: subOut.playerId, name: nameOf(subOut.playerId) };
      } else if (subIn) {
        title = `${nameOf(subIn.playerId)} checked in`;
        detail = "Substitution";
        primaryPlayer = { id: subIn.playerId, name: nameOf(subIn.playerId) };
      } else {
        title = `${nameOf(subOut!.playerId)} checked out`;
        detail = "Substitution";
        primaryPlayer = { id: subOut!.playerId, name: nameOf(subOut!.playerId) };
      }
    }
    // 10. Clock / Timeout / Possession
    else if (clockEv) {
      icon = "⏱";
      title =
        clockEv.type === "TIMEOUT"
          ? `Timeout ${clockEv.team ? `Team ${clockEv.team}` : ""}`
          : clockEv.type === "PAUSE"
            ? "Clock Paused"
            : clockEv.type === "RESUME"
              ? "Play Resumed"
              : "Possession";
      detail = clockEv.playerId ? `Called by ${nameOf(clockEv.playerId)}` : "";
      playTeam = clockEv.team ?? (clockEv.playerId ? teamOf(clockEv.playerId) : null);
    } else {
      title = "Play action";
      detail = "Recorded on court";
    }

    // Lead tracking
    const marginAfter = scoreA - scoreB;
    const leaderAfter: Team | "TIE" = marginAfter > 0 ? "A" : marginAfter < 0 ? "B" : "TIE";

    if (leaderAfter === "TIE") {
      timesTied++;
    } else if (lastLeader && leaderAfter !== lastLeader) {
      leadChanges++;
    }
    if (leaderAfter !== "TIE") {
      lastLeader = leaderAfter;
    }

    // Clutch detection: within 3 points in a game that reached 18+ or final minutes
    const isClutch = (scoreA >= 17 || scoreB >= 17) && Math.abs(marginAfter) <= 3;

    plays.push({
      step: step++,
      grp,
      at,
      elapsedMs,
      timeStr,
      team: playTeam,
      type: make ? make.type : miss ? miss.type : firstEv.type,
      icon,
      title,
      detail,
      scoreAfter: { A: scoreA, B: scoreB },
      marginAfter,
      leaderAfter,
      primaryPlayer,
      secondaryPlayer,
      isScoring,
      ptsScored,
      isClutch,
    });
  }

  // Format Assists List
  const assists: GameAssistInsight[] = Array.from(assistPairs.values())
    .map((item) => ({
      assisterId: item.assisterId,
      assisterName: nameOf(item.assisterId),
      assisterTeam: teamOf(item.assisterId) ?? "A",
      scorerId: item.scorerId,
      scorerName: nameOf(item.scorerId),
      scorerTeam: teamOf(item.scorerId) ?? "A",
      count: item.count,
      pointsGenerated: item.pts,
      twoPointers: item.twoPointers,
      threePointers: item.threePointers,
    }))
    .sort((a, b) => b.count - a.count || b.pointsGenerated - a.pointsGenerated);

  // Format Blocks List
  const blocks: GameBlockInsight[] = Array.from(blockPairs.values())
    .map((item) => ({
      blockerId: item.blockerId,
      blockerName: nameOf(item.blockerId),
      blockerTeam: teamOf(item.blockerId) ?? "A",
      shooterId: item.shooterId,
      shooterName: nameOf(item.shooterId),
      shooterTeam: teamOf(item.shooterId) ?? "B",
      count: item.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Format Steals List
  const steals: GameStealInsight[] = Array.from(stealPairs.values())
    .map((item) => ({
      stealerId: item.stealerId,
      stealerName: nameOf(item.stealerId),
      stealerTeam: teamOf(item.stealerId) ?? "A",
      victimId: item.victimId,
      victimName: nameOf(item.victimId),
      victimTeam: teamOf(item.victimId) ?? "B",
      count: item.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Team Creation Percentages
  const computeCreation = (team: Team): GameTeamCreationInsight => {
    const data = teamMakes[team];
    const total = data.totalFgm;
    return {
      team,
      totalFgm: total,
      assistedMakes: data.assisted,
      unassistedMakes: data.unassisted,
      assistedPct: total > 0 ? Math.round((data.assisted / total) * 100) : 0,
      unassistedPct: total > 0 ? Math.round((data.unassisted / total) * 100) : 0,
    };
  };

  return {
    gameId: game.id,
    assists,
    unattributedAssists,
    blocks,
    unattributedBlocks,
    steals,
    unattributedSteals,
    teamCreation: {
      A: computeCreation("A"),
      B: computeCreation("B"),
    },
    plays,
    leadChanges,
    timesTied,
    biggestRun,
    totalPlays: plays.length,
  };
}

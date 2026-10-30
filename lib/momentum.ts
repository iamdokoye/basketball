import type { Game } from "./queries";
import { POINTS, type Team } from "./stats";

export type ScoreMoment = {
  step: number;
  aScore: number;
  bScore: number;
  margin: number; // positive = A leads, negative = B leads, 0 = tie
  team: Team | null;
  playerId: number | null;
  playerName: string;
  pts: number;
  type: string;
};

export type GameMomentum = {
  timeline: ScoreMoment[];
  leadChanges: number;
  timesTied: number;
  maxLeadA: number;
  maxLeadB: number;
  biggestRun: { team: Team; pts: number } | null;
};

/**
 * Builds the chronological lead tracker and momentum timeline from game events.
 */
export function buildGameMomentum(game: Game): GameMomentum | null {
  if (game.status !== "final" || game.events.length === 0) return null;

  const rosterMap = new Map<number, { name: string; team: Team }>(
    game.roster.map((p) => [p.id, { name: p.name, team: p.team }]),
  );

  const timeline: ScoreMoment[] = [
    {
      step: 0,
      aScore: 0,
      bScore: 0,
      margin: 0,
      team: null,
      playerId: null,
      playerName: "Tip-off",
      pts: 0,
      type: "START",
    },
  ];

  let aScore = 0;
  let bScore = 0;
  let leadChanges = 0;
  let timesTied = 0;
  let maxLeadA = 0;
  let maxLeadB = 0;
  let lastLeader: Team | null = null;

  // Track runs
  let currentRunTeam: Team | null = null;
  let currentRunPts = 0;
  let bestRun = { team: "A" as Team, pts: 0 };

  const sortedEvents = [...game.events].sort(
    (a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() ||
      (a.id ?? 0) - (b.id ?? 0),
  );

  let step = 1;
  for (const e of sortedEvents) {
    const pts = POINTS[e.type];
    if (!pts || pts <= 0) continue;

    const player = rosterMap.get(e.playerId);
    if (!player) continue;

    if (player.team === "A") aScore += pts;
    else bScore += pts;

    const margin = aScore - bScore;
    if (margin > maxLeadA) maxLeadA = margin;
    if (-margin > maxLeadB) maxLeadB = -margin;

    // Lead changes & ties
    if (aScore === bScore) {
      timesTied++;
    } else {
      const currentLeader: Team = aScore > bScore ? "A" : "B";
      if (lastLeader && currentLeader !== lastLeader) {
        leadChanges++;
      }
      lastLeader = currentLeader;
    }

    // Run tracking
    if (currentRunTeam === player.team) {
      currentRunPts += pts;
    } else {
      currentRunTeam = player.team;
      currentRunPts = pts;
    }
    if (currentRunPts > bestRun.pts) {
      bestRun = { team: player.team, pts: currentRunPts };
    }

    timeline.push({
      step: step++,
      aScore,
      bScore,
      margin,
      team: player.team,
      playerId: e.playerId,
      playerName: player.name,
      pts,
      type: e.type,
    });
  }

  return {
    timeline,
    leadChanges,
    timesTied,
    maxLeadA,
    maxLeadB,
    biggestRun: bestRun.pts >= 4 ? bestRun : null,
  };
}

export type OnFirePlayer = {
  playerId: number;
  playerName: string;
  team: Team;
  streak: number; // Consecutive field goals made without a miss
  ptsInStreak: number;
};

/**
 * Detects players who currently have a hot shooting hand (streak of consecutive made shots without a miss).
 * Triggers at 2+ consecutive field goals.
 */
export function detectOnFirePlayers(
  events: { playerId: number; type: string; at: number }[],
  roster: { id: number; name: string; team: Team }[],
  threshold = 2,
): OnFirePlayer[] {
  const rosterMap = new Map<number, { name: string; team: Team }>(
    roster.map((p) => [p.id, { name: p.name, team: p.team }]),
  );

  // Track each player's active make streak
  const streakMap = new Map<number, { streak: number; pts: number }>();

  const sorted = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  for (const e of sorted) {
    if (!e.playerId) continue;
    let s = streakMap.get(e.playerId);
    if (!s) {
      s = { streak: 0, pts: 0 };
      streakMap.set(e.playerId, s);
    }

    if (e.type === "MAKE2") {
      s.streak += 1;
      s.pts += 2;
    } else if (e.type === "MAKE3") {
      s.streak += 1;
      s.pts += 3;
    } else if (e.type === "MISS2" || e.type === "MISS3" || e.type === "TOV") {
      s.streak = 0;
      s.pts = 0;
    }
  }

  const onFire: OnFirePlayer[] = [];
  for (const [playerId, s] of streakMap.entries()) {
    if (s.streak >= threshold) {
      const p = rosterMap.get(playerId);
      if (p) {
        onFire.push({
          playerId,
          playerName: p.name,
          team: p.team,
          streak: s.streak,
          ptsInStreak: s.pts,
        });
      }
    }
  }

  return onFire.sort((a, b) => b.streak - a.streak);
}

export type LiveMomentum = {
  momentumTeam: Team | "TIE";
  momentumPctA: number; // 0 to 100
  currentRun: { team: Team; pts: number; opponentPts: number } | null;
  hotTeam: Team | null;
};

/**
 * Computes live game momentum from recent events (last 6 scoring events).
 */
export function computeLiveMomentum(
  events: { playerId: number; type: string; at: number }[],
  roster: { id: number; team: Team }[],
): LiveMomentum {
  const teamMap = new Map<number, Team>(roster.map((p) => [p.id, p.team]));

  const scoringEvents = [...events]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .filter((e) => ((POINTS[e.type as keyof typeof POINTS] ?? 0) > 0));

  if (scoringEvents.length === 0) {
    return {
      momentumTeam: "TIE",
      momentumPctA: 50,
      currentRun: null,
      hotTeam: null,
    };
  }

  // Look at last 6 scoring events
  const recent = scoringEvents.slice(-6);
  let ptsA = 0;
  let ptsB = 0;

  for (const e of recent) {
    const t = teamMap.get(e.playerId);
    const pts = POINTS[e.type as keyof typeof POINTS] || 0;
    if (t === "A") ptsA += pts;
    else if (t === "B") ptsB += pts;
  }

  const total = ptsA + ptsB;
  const pctA = total > 0 ? Math.round((ptsA / total) * 100) : 50;

  // Active unanswered run
  let runTeam: Team | null = null;
  let runPts = 0;
  let oppPts = 0;

  for (let i = scoringEvents.length - 1; i >= 0; i--) {
    const e = scoringEvents[i];
    const t = teamMap.get(e.playerId);
    const pts = POINTS[e.type as keyof typeof POINTS] || 0;
    if (!t) continue;

    if (!runTeam) {
      runTeam = t;
      runPts = pts;
    } else if (t === runTeam) {
      runPts += pts;
    } else {
      oppPts += pts;
      // If opponent scored and run is broken, stop accumulating unanswered run
      break;
    }
  }

  const currentRun = runPts >= 4 && runTeam ? { team: runTeam, pts: runPts, opponentPts: oppPts } : null;

  return {
    momentumTeam: pctA > 55 ? "A" : pctA < 45 ? "B" : "TIE",
    momentumPctA: pctA,
    currentRun,
    hotTeam: pctA >= 65 ? "A" : pctA <= 35 ? "B" : null,
  };
}


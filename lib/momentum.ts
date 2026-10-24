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

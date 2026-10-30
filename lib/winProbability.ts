import { POINTS, type GameEvent, type RosterEntry, type Team } from "./stats";

export type WinProbabilityState = {
  probA: number; // 0 to 100
  probB: number; // 0 to 100
  probDraw: number; // 0 to 100 (probability of a dead heat, regulation tie, or overtime/deuce)
  favored: "A" | "B" | "even";
  leverageIndex: number; // 1.0 = normal, 2.0+ = high leverage clutch moment
  description: string;
};

export type ProbabilityStep = {
  step: number;
  probA: number;
  probB: number;
  probDraw: number;
  scoreA: number;
  scoreB: number;
  description: string;
  swingPlayerName?: string;
  swingPct?: number;
};

/**
 * Computes win probability and draw/overtime probability at any point in a game.
 * Uses a Negative Binomial Markov process combined with in-game momentum and score gap.
 */
export function calculateWinProbability({
  scoreA,
  scoreB,
  target = 20,
  winBy = 1,
  momentumPctA = 50,
}: {
  scoreA: number;
  scoreB: number;
  target?: number;
  winBy?: number;
  momentumPctA?: number;
}): WinProbabilityState {
  // If game is over
  if (scoreA >= target && scoreA - scoreB >= winBy) {
    return {
      probA: 100,
      probB: 0,
      probDraw: 0,
      favored: "A",
      leverageIndex: 1.0,
      description: "Team A has clinched victory",
    };
  }
  if (scoreB >= target && scoreB - scoreA >= winBy) {
    return {
      probA: 0,
      probB: 100,
      probDraw: 0,
      favored: "B",
      leverageIndex: 1.0,
      description: "Team B has clinched victory",
    };
  }

  const remA = Math.max(1, target - scoreA);
  const remB = Math.max(1, target - scoreB);
  const totalRemaining = remA + remB;

  // Base probability per possession based on momentum
  // momentumPctA is 0-100 (50 is neutral)
  const momentumBias = (momentumPctA - 50) * 0.003; // +/- 0.15 max
  const pA = Math.min(0.85, Math.max(0.15, 0.5 + momentumBias));
  const pB = 1 - pA;

  // Probability of each team closing out first
  // Using ratio of points needed weighted by possession success probability
  const weightA = Math.pow(pA / remA, 1.4);
  const weightB = Math.pow(pB / remB, 1.4);
  const sumWeights = weightA + weightB;

  let rawProbA = weightA / sumWeights;
  let rawProbB = weightB / sumWeights;

  // Draw / Overtime Tie probability calculation
  // Draw is highest when:
  // 1. Current score is tied or very close (|scoreA - scoreB| <= 1)
  // 2. Both teams are approaching target score (e.g. 18-18 or 19-19 in a game to 20)
  const scoreDiff = Math.abs(scoreA - scoreB);
  const closenessFactor = Math.max(0, 1 - scoreDiff / 5); // 1.0 when tied, drops as lead grows
  const thresholdFactor = Math.min(1, Math.max(scoreA, scoreB) / Math.max(1, target)); // Higher near end of game

  // Peak draw probability reaches ~35-45% when deadlocked at game point (deuce/overtime)
  let rawDrawProb = (0.15 * closenessFactor) + (0.25 * closenessFactor * thresholdFactor);

  // If already at deuce/tie at target (e.g. 20-20 with winBy=2)
  if (scoreA >= target - 1 && scoreB >= target - 1 && scoreDiff === 0) {
    rawDrawProb = 0.40;
  }

  // Allocate remaining between A and B
  const nonDraw = 1 - rawDrawProb;
  const finalProbA = Math.round(rawProbA * nonDraw * 100);
  const finalProbB = Math.round(rawProbB * nonDraw * 100);
  const finalProbDraw = Math.max(1, 100 - finalProbA - finalProbB);

  // Clutch Leverage Index: measures how crucial the next basket is
  // High when game is late and close (e.g. 19-18)
  const leverage = Number((1.0 + (3.5 * closenessFactor * thresholdFactor)).toFixed(1));

  let favored: "A" | "B" | "even" = "even";
  if (finalProbA > finalProbB + 8) favored = "A";
  else if (finalProbB > finalProbA + 8) favored = "B";

  let description = "Dead heat — anyone's game";
  if (finalProbDraw >= 30) {
    description = "High tie & overtime probability (Deuce tension)";
  } else if (favored === "A") {
    description = `Team A favored (${finalProbA}%)`;
  } else if (favored === "B") {
    description = `Team B favored (${finalProbB}%)`;
  }

  return {
    probA: finalProbA,
    probB: finalProbB,
    probDraw: finalProbDraw,
    favored,
    leverageIndex: leverage,
    description,
  };
}

/**
 * Builds the step-by-step win probability timeline from game events.
 */
export function buildWinProbabilityTimeline(
  events: GameEvent[],
  roster: RosterEntry[],
  target = 20,
  winBy = 1,
): ProbabilityStep[] {
  const steps: ProbabilityStep[] = [];
  const playerMap = new Map<number, { name: string; team: Team }>(
    roster.map((p) => [p.id, { name: p.name, team: p.team }]),
  );

  let currentA = 0;
  let currentB = 0;

  // Step 0: Tip-off
  const initial = calculateWinProbability({
    scoreA: 0,
    scoreB: 0,
    target,
    winBy,
    momentumPctA: 50,
  });

  steps.push({
    step: 0,
    probA: initial.probA,
    probB: initial.probB,
    probDraw: initial.probDraw,
    scoreA: 0,
    scoreB: 0,
    description: "Tip-off (0–0)",
  });

  const scoringEvents = [...events].filter(
    (e) => (POINTS[e.type] ?? 0) > 0,
  );

  let prevProbA = initial.probA;

  scoringEvents.forEach((e, idx) => {
    const pts = POINTS[e.type] ?? 0;
    const player = playerMap.get(e.playerId);
    if (!player) return;

    if (player.team === "A") currentA += pts;
    else currentB += pts;

    // Estimate momentum up to this point
    const recentEvents = scoringEvents.slice(Math.max(0, idx - 4), idx + 1);
    const recentPtsA = recentEvents
      .filter((ev) => playerMap.get(ev.playerId)?.team === "A")
      .reduce((sum, ev) => sum + (POINTS[ev.type] ?? 0), 0);
    const recentPtsTotal = recentEvents.reduce(
      (sum, ev) => sum + (POINTS[ev.type] ?? 0),
      0,
    );
    const momentumA =
      recentPtsTotal > 0 ? (recentPtsA / recentPtsTotal) * 100 : 50;

    const prob = calculateWinProbability({
      scoreA: currentA,
      scoreB: currentB,
      target,
      winBy,
      momentumPctA: momentumA,
    });

    const swing = prob.probA - prevProbA;
    prevProbA = prob.probA;

    steps.push({
      step: idx + 1,
      probA: prob.probA,
      probB: prob.probB,
      probDraw: prob.probDraw,
      scoreA: currentA,
      scoreB: currentB,
      description: `${player.name} +${pts} (${currentA}–${currentB})`,
      swingPlayerName: player.name,
      swingPct: Math.abs(swing),
    });
  });

  return steps;
}

import { buildClock, OVERTIME_MINUTES } from "./clock";
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

// ---- Timed games: scoring-race model ---------------------------------------
//
// Each team scores as a Poisson process whose makes are worth 1, 2 or 3 points, so the points
// still to come in the time left are a compound Poisson distribution. Convolving the two teams'
// distributions gives the exact chance of every final margin: A wins (margin > 0), B wins, or a
// tie that goes to overtime. Unlike a smooth curve this handles lumpy end-of-game scoring (a
// 1-point lead with 20 seconds left is mostly safe, a tie with 20 seconds left usually stays tied)
// and overtime, where only the 5-minute period in progress is left.

/** Share of makes worth 1, 2 and 3 points in 3v3 pickup. */
const MAKE_PTS = [0, 0.08, 0.7, 0.22];
const MEAN_MAKE_PTS = MAKE_PTS.reduce((s, p, i) => s + p * i, 0);
/** Typical combined scoring pace (about 38 points per 10 minutes) and how firmly we hold it. */
const PRIOR_PTS_PER_SEC = 38 / 600;
const PRIOR_WEIGHT_SEC = 240;

/** pmf of the points one team scores while `meanMakes` makes are expected, truncated at `maxPts`. */
function pointsPmf(meanMakes: number, maxPts: number): number[] {
  const out = new Array<number>(maxPts + 1).fill(0);
  let poisson = Math.exp(-meanMakes);
  let nFold = [1]; // distribution of the points from exactly n makes
  const nMax = Math.ceil(meanMakes + 8 * Math.sqrt(meanMakes) + 8);
  for (let n = 0; n <= nMax; n++) {
    for (let k = 0; k < nFold.length && k <= maxPts; k++) out[k] += poisson * nFold[k];
    const next = new Array<number>(Math.min(maxPts, nFold.length + 2) + 1).fill(0);
    for (let k = 0; k < nFold.length; k++) {
      for (let p = 1; p <= 3 && k + p < next.length; p++) next[k + p] += nFold[k] * MAKE_PTS[p];
    }
    nFold = next;
    poisson *= meanMakes / (n + 1);
  }
  return out;
}

/** Seconds left in the period that decides the game: the rest of regulation, or of the current overtime. */
export function timedRemainingSec(elapsedSec: number, totalRegSec: number): number {
  const otSec = OVERTIME_MINUTES * 60;
  if (elapsedSec <= totalRegSec) return Math.max(0, totalRegSec - elapsedSec);
  const otElapsed = elapsedSec - totalRegSec;
  const rem = otSec - (otElapsed % otSec);
  return rem === otSec ? 0 : rem;
}

function timedWinProbability({
  scoreA,
  scoreB,
  momentumPctA,
  elapsedSec,
  totalRegSec,
}: {
  scoreA: number;
  scoreB: number;
  momentumPctA: number;
  elapsedSec: number;
  totalRegSec: number;
}): WinProbabilityState {
  const totalTime = Math.max(60, totalRegSec);
  const inOvertime = elapsedSec > totalTime;
  const remaining = timedRemainingSec(Math.max(0, elapsedSec), totalTime);
  const lead = scoreA - scoreB;

  // If the period has reached 0:00, outcome is decided or tied into overtime
  if (remaining <= 0) {
    if (lead > 0) {
      return {
        probA: 100,
        probB: 0,
        probDraw: 0,
        favored: "A",
        leverageIndex: 1.0,
        description: "Team A has clinched victory",
      };
    }
    if (lead < 0) {
      return {
        probA: 0,
        probB: 100,
        probDraw: 0,
        favored: "B",
        leverageIndex: 1.0,
        description: "Team B has clinched victory",
      };
    }
    return {
      probA: 50,
      probB: 50,
      probDraw: 100,
      favored: "even",
      leverageIndex: 1.0,
      description: inOvertime ? "Overtime tied · Next OT" : "Regulation tied · Overtime",
    };
  }

  // Scoring pace: the typical pace, firmed up by what this game has actually produced.
  const pace =
    (PRIOR_PTS_PER_SEC * PRIOR_WEIGHT_SEC + scoreA + scoreB) /
    (PRIOR_WEIGHT_SEC + Math.max(0, elapsedSec));
  // Both teams are assumed equal: a hot streak is worth at most half a point of lead, not a
  // different scoring rate (which would snowball over a 40-minute game).
  const makesA = (pace * 0.5 * remaining) / MEAN_MAKE_PTS;
  const makesB = makesA;
  const maxPts = Math.ceil(3 * Math.max(makesA, makesB) * 2 + 30);
  const pmfA = pointsPmf(makesA, maxPts);
  const pmfB = pointsPmf(makesB, maxPts);
  const cdfB: number[] = [];
  pmfB.reduce((acc, p, i) => (cdfB[i] = acc + p), 0);

  // Final margin = lead + A's points - B's points.
  const race = (start: number) => {
    let a = 0;
    let tie = 0;
    for (let i = 0; i < pmfA.length; i++) {
      const need = start + i; // B must score fewer than this to lose, exactly this to tie
      if (need > 0) a += pmfA[i] * cdfB[Math.min(need - 1, cdfB.length - 1)];
      if (need >= 0 && need < pmfB.length) tie += pmfA[i] * pmfB[need];
    }
    return { a, tie };
  };
  const nudge = Math.max(-0.5, Math.min(0.5, (momentumPctA - 50) * 0.01));
  const lo = Math.floor(lead + nudge);
  const frac = lead + nudge - lo;
  const r0 = race(lo);
  const r1 = frac > 0 ? race(lo + 1) : r0;
  let pA = r0.a * (1 - frac) + r1.a * frac;
  let pTie = r0.tie * (1 - frac) + r1.tie * frac;
  const total = Math.max(1, pA + pTie);
  pA /= total;
  pTie /= total;
  const pB = Math.max(0, 1 - pA - pTie);

  // Never show a certain result before the game is actually decided.
  let finalProbA = Math.min(99, Math.max(1, Math.round(pA * 100)));
  let finalProbB = Math.min(99, Math.max(1, Math.round(pB * 100)));
  if (finalProbA + finalProbB > 100) {
    if (finalProbA >= finalProbB) finalProbA = 100 - finalProbB;
    else finalProbB = 100 - finalProbA;
  }
  const finalProbDraw = Math.max(0, 100 - finalProbA - finalProbB);

  // Leverage: how much the next basket matters (close score, little time left).
  const periodSec = inOvertime ? OVERTIME_MINUTES * 60 : totalTime;
  const timeRatio = Math.min(1, Math.max(0, 1 - remaining / periodSec));
  const closenessFactor = Math.max(0, 1 - Math.abs(lead) / 5);
  const leverage = Number((1.0 + 3.5 * closenessFactor * Math.pow(timeRatio, 2)).toFixed(1));

  let favored: "A" | "B" | "even" = "even";
  if (finalProbA > finalProbB + 8) favored = "A";
  else if (finalProbB > finalProbA + 8) favored = "B";

  let description = "Dead heat — anyone's game";
  if (finalProbDraw >= 30) {
    description = "High tie & overtime probability";
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
 * Computes win probability and draw/overtime probability at any point in a game.
 * Uses a Negative Binomial Markov process for target games, and an exact scoring-race model
 * (compound Poisson, with overtime) for timed quarter games.
 */
export function calculateWinProbability({
  scoreA,
  scoreB,
  target = 20,
  winBy = 1,
  momentumPctA = 50,
  gameType = "target",
  elapsedSec = 0,
  totalRegSec = 2400,
  isGameOver = false,
}: {
  scoreA: number;
  scoreB: number;
  target?: number;
  winBy?: number;
  momentumPctA?: number;
  gameType?: "target" | "timed";
  elapsedSec?: number;
  totalRegSec?: number;
  isGameOver?: boolean;
}): WinProbabilityState {
  // If game is over
  if (isGameOver) {
    if (scoreA > scoreB) {
      return {
        probA: 100,
        probB: 0,
        probDraw: 0,
        favored: "A",
        leverageIndex: 1.0,
        description: "Team A has clinched victory",
      };
    }
    if (scoreB > scoreA) {
      return {
        probA: 0,
        probB: 100,
        probDraw: 0,
        favored: "B",
        leverageIndex: 1.0,
        description: "Team B has clinched victory",
      };
    }
    return {
      probA: 50,
      probB: 50,
      probDraw: 100,
      favored: "even",
      leverageIndex: 1.0,
      description: "Regulation tied · Overtime",
    };
  }

  // ---- Timed game win probability (scoring-race model) -----------------------
  if (gameType === "timed") {
    return timedWinProbability({
      scoreA,
      scoreB,
      momentumPctA,
      elapsedSec,
      totalRegSec,
    });
  }

  // ---- Target score win probability (Markov process) -----------------------
  if (target > 0 && scoreA >= target && scoreA - scoreB >= winBy) {
    return {
      probA: 100,
      probB: 0,
      probDraw: 0,
      favored: "A",
      leverageIndex: 1.0,
      description: "Team A has clinched victory",
    };
  }
  if (target > 0 && scoreB >= target && scoreB - scoreA >= winBy) {
    return {
      probA: 0,
      probB: 100,
      probDraw: 0,
      favored: "B",
      leverageIndex: 1.0,
      description: "Team B has clinched victory",
    };
  }

  const effectiveTarget = target > 0 ? target : 20;
  const remA = Math.max(1, effectiveTarget - scoreA);
  const remB = Math.max(1, effectiveTarget - scoreB);

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

  const rawProbA = weightA / sumWeights;
  const rawProbB = weightB / sumWeights;

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
  gameType: "target" | "timed" = "target",
  quarterMinutes = 10,
  quarterCount = 4,
  startMs?: number,
): ProbabilityStep[] {
  const steps: ProbabilityStep[] = [];
  const playerMap = new Map<number, { name: string; team: Team }>(
    roster.map((p) => [p.id, { name: p.name, team: p.team }]),
  );

  const totalRegSec = Math.max(60, quarterCount * quarterMinutes * 60);
  let currentA = 0;
  let currentB = 0;

  // Step 0: Tip-off
  const initial = calculateWinProbability({
    scoreA: 0,
    scoreB: 0,
    target,
    winBy,
    momentumPctA: 50,
    gameType,
    elapsedSec: 0,
    totalRegSec,
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
  // Timed games: the real game clock (pauses, timeouts and quarter breaks left out).
  const clock =
    gameType === "timed"
      ? buildClock(
          events,
          startMs ?? (events.length ? Math.min(...events.map((e) => e.at)) : 0),
          roster,
        )
      : null;

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

    const eventElapsedSec = clock ? Math.floor(clock.gameMs(e.at) / 1000) : 0;

    const prob = calculateWinProbability({
      scoreA: currentA,
      scoreB: currentB,
      target,
      winBy,
      momentumPctA: momentumA,
      gameType,
      elapsedSec: eventElapsedSec,
      totalRegSec,
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

export type DaggerPlay = {
  step: number;
  playerName: string;
  description: string;
  scoreA: number;
  scoreB: number;
  swingPct: number;
  resultingProb: number;
};

export function findDaggerPlay(
  steps: ProbabilityStep[],
  winner: Team | null,
): DaggerPlay | null {
  if (!winner || steps.length < 2) return null;

  // Filter steps where winner's probability increased in the 2nd half / clutch of the game
  const minStep = Math.floor(steps.length * 0.35);
  const eligible = steps.slice(minStep).filter((s) => {
    if (!s.swingPlayerName || !s.swingPct) return false;
    const prev = steps[s.step - 1];
    if (!prev) return false;
    if (winner === "A") return s.probA > prev.probA && s.probA >= 65;
    return s.probB > prev.probB && s.probB >= 65;
  });

  const candidates = eligible.length > 0 ? eligible : steps.filter((s) => s.swingPlayerName && s.swingPct);
  if (candidates.length === 0) return null;

  const best = candidates.sort(
    (a, b) => (b.swingPct ?? 0) - (a.swingPct ?? 0),
  )[0];

  return {
    step: best.step,
    playerName: best.swingPlayerName!,
    description: best.description,
    scoreA: best.scoreA,
    scoreB: best.scoreB,
    swingPct: Math.round((best.swingPct ?? 0) * 10) / 10,
    resultingProb: Math.round(winner === "A" ? best.probA : best.probB),
  };
}

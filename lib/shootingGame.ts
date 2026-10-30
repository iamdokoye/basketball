export type CourtSpot = {
  id: string;
  name: string;
  short: string;
  x: number; // 0 - 100% on half-court visual
  y: number; // 0 - 100% on half-court visual
  type: "corner" | "wing" | "elbow" | "top" | "free_throw" | "custom";
};

export const DEFAULT_COURT_SPOTS: CourtSpot[] = [
  { id: "spot-1", name: "Right Corner 3", short: "R-CNR", x: 86, y: 76, type: "corner" },
  { id: "spot-2", name: "Right Wing", short: "R-WNG", x: 74, y: 48, type: "wing" },
  { id: "spot-3", name: "Right Elbow", short: "R-ELB", x: 61, y: 34, type: "elbow" },
  { id: "spot-4", name: "Top of the Key", short: "TOP", x: 50, y: 22, type: "top" },
  { id: "spot-5", name: "Left Elbow", short: "L-ELB", x: 39, y: 34, type: "elbow" },
  { id: "spot-6", name: "Left Wing", short: "L-WNG", x: 26, y: 48, type: "wing" },
  { id: "spot-7", name: "Left Corner 3", short: "L-CNR", x: 14, y: 76, type: "corner" },
  { id: "spot-8", name: "Free Throw (Money Ball)", short: "FT", x: 50, y: 42, type: "free_throw" },
];

export type ShootingGameMode =
  | "classic_chance" // Miss -> Chance It or Save. Miss on chance drops back.
  | "steady_stay"; // Miss -> Stay at current spot without penalty.

export type ShootingPlayer = {
  id: number;
  name: string;
  currentSpotIndex: number; // 0 to spots.length - 1, spots.length means completed!
  attempts: number;
  makes: number;
  chancesTaken: number;
  chancesFailed: number;
  completedAt?: number;
  streak: number;
};

export type ShootingGame = {
  id: string;
  title: string;
  mode: ShootingGameMode;
  keepShootingOnMake: boolean; // If true, making a shot lets you shoot from next spot immediately
  chancePenalty: "reset_to_start" | "back_one";
  spots: CourtSpot[];
  players: ShootingPlayer[];
  activePlayerIndex: number;
  status: "playing" | "finished";
  winnerId: number | null;
  chancePending: boolean; // True when classic mode miss requires choice: Save or Chance
  logs: {
    text: string;
    type: "make" | "miss" | "chance_make" | "chance_fail" | "win";
    timestamp: number;
  }[];
};

export function createShootingGame({
  title = "Around the World Shootout",
  mode = "classic_chance",
  keepShootingOnMake = true,
  chancePenalty = "reset_to_start",
  spots = DEFAULT_COURT_SPOTS,
  players,
}: {
  title?: string;
  mode?: ShootingGameMode;
  keepShootingOnMake?: boolean;
  chancePenalty?: "reset_to_start" | "back_one";
  spots?: CourtSpot[];
  players: { id: number; name: string }[];
}): ShootingGame {
  return {
    id: `shoot-${Date.now()}`,
    title,
    mode,
    keepShootingOnMake,
    chancePenalty,
    spots,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      currentSpotIndex: 0,
      attempts: 0,
      makes: 0,
      chancesTaken: 0,
      chancesFailed: 0,
      streak: 0,
    })),
    activePlayerIndex: 0,
    status: "playing",
    winnerId: null,
    chancePending: false,
    logs: [
      {
        text: `Game started with ${players.length} shooters. Mode: ${
          mode === "classic_chance" ? "Classic (Chance It / Save)" : "Stay on Miss (No Penalty)"
        }.`,
        type: "make",
        timestamp: Date.now(),
      },
    ],
  };
}

export function handleShotMake(game: ShootingGame): ShootingGame {
  if (game.status === "finished") return game;

  const currentIdx = game.activePlayerIndex;
  const p = game.players[currentIdx];
  const currentSpot = game.spots[p.currentSpotIndex];

  const nextSpotIndex = p.currentSpotIndex + 1;
  const isWinner = nextSpotIndex >= game.spots.length;

  const updatedPlayer: ShootingPlayer = {
    ...p,
    attempts: p.attempts + 1,
    makes: p.makes + 1,
    streak: p.streak + 1,
    currentSpotIndex: isWinner ? game.spots.length : nextSpotIndex,
    completedAt: isWinner ? Date.now() : undefined,
  };

  const nextPlayers = [...game.players];
  nextPlayers[currentIdx] = updatedPlayer;

  const logText = isWinner
    ? `🏆 ${p.name} SUNK the final shot from ${currentSpot.name} and WINS Around the World!`
    : `🎯 ${p.name} MADE the shot from ${currentSpot.name} and advanced to spot #${nextSpotIndex + 1} (${game.spots[nextSpotIndex].name})!`;

  if (isWinner) {
    return {
      ...game,
      players: nextPlayers,
      status: "finished",
      winnerId: p.id,
      chancePending: false,
      logs: [
        { text: logText, type: "win", timestamp: Date.now() },
        ...game.logs.slice(0, 30),
      ],
    };
  }

  // If keepShootingOnMake is enabled, same player shoots again at the next spot!
  // Otherwise, pass to next player.
  const nextActiveIndex = game.keepShootingOnMake
    ? currentIdx
    : (currentIdx + 1) % game.players.length;

  return {
    ...game,
    players: nextPlayers,
    activePlayerIndex: nextActiveIndex,
    chancePending: false,
    logs: [
      { text: logText, type: "make", timestamp: Date.now() },
      ...game.logs.slice(0, 30),
    ],
  };
}

export function handleShotMiss(game: ShootingGame): ShootingGame {
  if (game.status === "finished") return game;

  const currentIdx = game.activePlayerIndex;
  const p = game.players[currentIdx];
  const currentSpot = game.spots[p.currentSpotIndex];

  const updatedPlayer: ShootingPlayer = {
    ...p,
    attempts: p.attempts + 1,
    streak: 0,
  };

  const nextPlayers = [...game.players];
  nextPlayers[currentIdx] = updatedPlayer;

  // In Classic Chance mode, player can choose to Chance It or Save
  if (game.mode === "classic_chance") {
    return {
      ...game,
      players: nextPlayers,
      chancePending: true,
      logs: [
        {
          text: `❌ ${p.name} missed from ${currentSpot.name}. Save spot or CHANCE IT?`,
          type: "miss",
          timestamp: Date.now(),
        },
        ...game.logs.slice(0, 30),
      ],
    };
  }

  // In Stay Mode: No penalty, stay at spot, next player's turn!
  const nextActiveIndex = (currentIdx + 1) % game.players.length;
  return {
    ...game,
    players: nextPlayers,
    activePlayerIndex: nextActiveIndex,
    chancePending: false,
    logs: [
      {
        text: `❌ ${p.name} missed from ${currentSpot.name}. Stays at current position.`,
        type: "miss",
        timestamp: Date.now(),
      },
      ...game.logs.slice(0, 30),
    ],
  };
}

export function handleSaveSpot(game: ShootingGame): ShootingGame {
  if (!game.chancePending) return game;
  const currentIdx = game.activePlayerIndex;
  const p = game.players[currentIdx];
  const currentSpot = game.spots[p.currentSpotIndex];

  const nextActiveIndex = (currentIdx + 1) % game.players.length;
  return {
    ...game,
    chancePending: false,
    activePlayerIndex: nextActiveIndex,
    logs: [
      {
        text: `🛡️ ${p.name} chose to save their spot at ${currentSpot.name}. Next shooter up!`,
        type: "miss",
        timestamp: Date.now(),
      },
      ...game.logs.slice(0, 30),
    ],
  };
}

export function handleChanceShot(game: ShootingGame, made: boolean): ShootingGame {
  if (!game.chancePending) return game;

  const currentIdx = game.activePlayerIndex;
  const p = game.players[currentIdx];
  const currentSpot = game.spots[p.currentSpotIndex];

  if (made) {
    const nextSpotIndex = p.currentSpotIndex + 1;
    const isWinner = nextSpotIndex >= game.spots.length;

    const updatedPlayer: ShootingPlayer = {
      ...p,
      attempts: p.attempts + 1,
      makes: p.makes + 1,
      chancesTaken: p.chancesTaken + 1,
      streak: p.streak + 1,
      currentSpotIndex: isWinner ? game.spots.length : nextSpotIndex,
      completedAt: isWinner ? Date.now() : undefined,
    };

    const nextPlayers = [...game.players];
    nextPlayers[currentIdx] = updatedPlayer;

    const logText = isWinner
      ? `🔥 CLUTCH! ${p.name} CHANCED IT, SUNK IT from ${currentSpot.name}, and WINS Around the World!`
      : `🔥 CLUTCH! ${p.name} chanced it and MADE IT from ${currentSpot.name}! Advanced to spot #${nextSpotIndex + 1}!`;

    if (isWinner) {
      return {
        ...game,
        players: nextPlayers,
        status: "finished",
        winnerId: p.id,
        chancePending: false,
        logs: [
          { text: logText, type: "win", timestamp: Date.now() },
          ...game.logs.slice(0, 30),
        ],
      };
    }

    const nextActiveIndex = game.keepShootingOnMake
      ? currentIdx
      : (currentIdx + 1) % game.players.length;

    return {
      ...game,
      players: nextPlayers,
      activePlayerIndex: nextActiveIndex,
      chancePending: false,
      logs: [
        { text: logText, type: "chance_make", timestamp: Date.now() },
        ...game.logs.slice(0, 30),
      ],
    };
  } else {
    // Failed chance! Demote
    const penaltySpot =
      game.chancePenalty === "reset_to_start"
        ? 0
        : Math.max(0, p.currentSpotIndex - 1);

    const updatedPlayer: ShootingPlayer = {
      ...p,
      attempts: p.attempts + 1,
      chancesTaken: p.chancesTaken + 1,
      chancesFailed: p.chancesFailed + 1,
      currentSpotIndex: penaltySpot,
      streak: 0,
    };

    const nextPlayers = [...game.players];
    nextPlayers[currentIdx] = updatedPlayer;

    const penaltyText =
      game.chancePenalty === "reset_to_start"
        ? `sent all the way back to Spot #1 (${game.spots[0].name})!`
        : `knocked back 1 spot to ${game.spots[penaltySpot].name}!`;

    const nextActiveIndex = (currentIdx + 1) % game.players.length;

    return {
      ...game,
      players: nextPlayers,
      activePlayerIndex: nextActiveIndex,
      chancePending: false,
      logs: [
        {
          text: `💀 OUCH! ${p.name} chanced it and MISSED! ${penaltyText}`,
          type: "chance_fail",
          timestamp: Date.now(),
        },
        ...game.logs.slice(0, 30),
      ],
    };
  }
}

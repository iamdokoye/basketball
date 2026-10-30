export type TournamentFormat = "king_of_court" | "single_elimination" | "round_robin";

export type TournamentTeam = {
  id: string;
  name: string;
  playerIds: number[];
  color?: string;
};

export type TournamentMatch = {
  id: string;
  label: string; // e.g. "Game 1", "Semi-Final 1", "Championship Game"
  teamAId: string;
  teamBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  isChampionship: boolean;
  gameId?: number; // Linked official game ID if played via app scorekeeper
};

export type TeamStanding = {
  team: TournamentTeam;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  streak: number;
};

export type TournamentState = {
  id: string;
  name: string;
  format: TournamentFormat;
  targetScore: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  status: "active" | "finished";
  currentKingTeamId?: string;
  kingStreak?: number;
  championTeamId?: string;
  createdAt: string;
};

export function createTournament(
  name: string,
  format: TournamentFormat,
  teams: TournamentTeam[],
  targetScore = 15,
): TournamentState {
  const id = `tourney-${Date.now()}`;
  const matches: TournamentMatch[] = [];

  if (format === "king_of_court") {
    // Winner stays on court. Queue begins with Team 1 vs Team 2
    if (teams.length >= 2) {
      matches.push({
        id: `match-1`,
        label: "Game 1 (Opening Matchup)",
        teamAId: teams[0].id,
        teamBId: teams[1].id,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isChampionship: false,
      });
    }
  } else if (format === "single_elimination") {
    // 4-team bracket: Semi 1, Semi 2, 3rd place, Championship
    if (teams.length >= 4) {
      matches.push(
        {
          id: `semi-1`,
          label: "Semi-Final 1",
          teamAId: teams[0].id,
          teamBId: teams[3].id,
          scoreA: null,
          scoreB: null,
          winnerTeamId: null,
          isChampionship: false,
        },
        {
          id: `semi-2`,
          label: "Semi-Final 2",
          teamAId: teams[1].id,
          teamBId: teams[2].id,
          scoreA: null,
          scoreB: null,
          winnerTeamId: null,
          isChampionship: false,
        },
        {
          id: `final`,
          label: "🏆 Championship Game (Gold Medal)",
          teamAId: "",
          teamBId: "",
          scoreA: null,
          scoreB: null,
          winnerTeamId: null,
          isChampionship: true,
        },
      );
    } else if (teams.length >= 2) {
      // 2 teams: Single championship series
      matches.push({
        id: `final`,
        label: "🏆 Championship Game (Gold Medal)",
        teamAId: teams[0].id,
        teamBId: teams[1].id,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isChampionship: true,
      });
    }
  } else if (format === "round_robin") {
    // Everyone plays everyone once
    let matchCount = 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `rr-${matchCount}`,
          label: `Match ${matchCount}: ${teams[i].name} vs ${teams[j].name}`,
          teamAId: teams[i].id,
          teamBId: teams[j].id,
          scoreA: null,
          scoreB: null,
          winnerTeamId: null,
          isChampionship: false,
        });
        matchCount++;
      }
    }
    // Final game between top 2 seeds
    matches.push({
      id: `final`,
      label: "🏆 Championship Game (Top 2 Seeds)",
      teamAId: "",
      teamBId: "",
      scoreA: null,
      scoreB: null,
      winnerTeamId: null,
      isChampionship: true,
    });
  }

  return {
    id,
    name: name || "Pickup 3v3 Tournament",
    format,
    targetScore,
    teams,
    matches,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function recordMatch(
  state: TournamentState,
  matchId: string,
  scoreA: number,
  scoreB: number,
  gameId?: number,
): TournamentState {
  const winnerTeamId = scoreA > scoreB ? state.matches.find((m) => m.id === matchId)?.teamAId : state.matches.find((m) => m.id === matchId)?.teamBId;
  if (!winnerTeamId) return state;

  const nextMatches = state.matches.map((m) => {
    if (m.id !== matchId) return m;
    return {
      ...m,
      scoreA,
      scoreB,
      winnerTeamId,
      gameId,
    };
  });

  let nextKing = state.currentKingTeamId;
  let nextStreak = state.kingStreak ?? 0;
  let championId = state.championTeamId;
  let nextStatus: "active" | "finished" = state.status;

  if (state.format === "king_of_court") {
    if (winnerTeamId === state.currentKingTeamId) {
      nextStreak += 1;
    } else {
      nextKing = winnerTeamId;
      nextStreak = 1;
    }

    // A team that achieves 3 straight wins (or whatever King threshold) or when user finishes
    if (nextStreak >= 3) {
      championId = winnerTeamId;
    }

    // Spawn the next rotation matchup against the next challenger in line
    const finishedCount = nextMatches.filter((m) => m.winnerTeamId).length;
    const currentMatch = nextMatches.find((m) => m.id === matchId)!;
    const loserTeamId = winnerTeamId === currentMatch.teamAId ? currentMatch.teamBId : currentMatch.teamAId;

    // Find the team waiting the longest (not the winner, not the loser)
    const otherTeams = state.teams.filter((t) => t.id !== winnerTeamId && t.id !== loserTeamId);
    const nextChallenger = otherTeams.length > 0 ? otherTeams[0] : state.teams.find((t) => t.id === loserTeamId)!;

    if (championId) {
      nextStatus = "finished";
    } else {
      nextMatches.push({
        id: `match-${finishedCount + 1}`,
        label: `Game ${finishedCount + 1} (King Defense #${nextStreak})`,
        teamAId: winnerTeamId,
        teamBId: nextChallenger.id,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
        isChampionship: false,
      });
    }
  } else if (state.format === "single_elimination") {
    // Check if semi-finals are complete to fill Championship Game
    const semi1 = nextMatches.find((m) => m.id === "semi-1");
    const semi2 = nextMatches.find((m) => m.id === "semi-2");
    const finalMatch = nextMatches.find((m) => m.id === "final");

    if (semi1?.winnerTeamId && semi2?.winnerTeamId && finalMatch && !finalMatch.teamAId) {
      finalMatch.teamAId = semi1.winnerTeamId;
      finalMatch.teamBId = semi2.winnerTeamId;
    }

    if (finalMatch?.winnerTeamId) {
      championId = finalMatch.winnerTeamId;
      nextStatus = "finished";
    }
  } else if (state.format === "round_robin") {
    const finalMatch = nextMatches.find((m) => m.id === "final");
    const rrMatches = nextMatches.filter((m) => m.id !== "final");
    const allRrDone = rrMatches.every((m) => m.winnerTeamId);

    if (allRrDone && finalMatch && !finalMatch.teamAId) {
      // Seed top 2 teams from standings
      const standings = computeStandings({ ...state, matches: nextMatches });
      if (standings.length >= 2) {
        finalMatch.teamAId = standings[0].team.id;
        finalMatch.teamBId = standings[1].team.id;
      }
    }

    if (finalMatch?.winnerTeamId) {
      championId = finalMatch.winnerTeamId;
      nextStatus = "finished";
    }
  }

  return {
    ...state,
    matches: nextMatches,
    currentKingTeamId: nextKing,
    kingStreak: nextStreak,
    championTeamId: championId,
    status: nextStatus,
  };
}

export function computeStandings(state: TournamentState): TeamStanding[] {
  const standingsMap = new Map<string, TeamStanding>();

  for (const t of state.teams) {
    standingsMap.set(t.id, {
      team: t,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      streak: 0,
    });
  }

  for (const m of state.matches) {
    if (m.scoreA === null || m.scoreB === null || !m.winnerTeamId) continue;
    const a = standingsMap.get(m.teamAId);
    const b = standingsMap.get(m.teamBId);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;
    a.pointsFor += m.scoreA;
    a.pointsAgainst += m.scoreB;
    b.pointsFor += m.scoreB;
    b.pointsAgainst += m.scoreA;

    if (m.winnerTeamId === m.teamAId) {
      a.wins += 1;
      b.losses += 1;
      a.streak = a.streak >= 0 ? a.streak + 1 : 1;
      b.streak = b.streak <= 0 ? b.streak - 1 : -1;
    } else {
      b.wins += 1;
      a.losses += 1;
      b.streak = b.streak >= 0 ? b.streak + 1 : 1;
      a.streak = a.streak <= 0 ? a.streak - 1 : -1;
    }

    a.diff = a.pointsFor - a.pointsAgainst;
    b.diff = b.pointsFor - b.pointsAgainst;
  }

  return [...standingsMap.values()].sort(
    (x, y) =>
      y.wins - x.wins ||
      y.diff - x.diff ||
      y.pointsFor - x.pointsFor,
  );
}

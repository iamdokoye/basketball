import type { Game, CareerLine } from "./queries";
import { pairStats, relationsFor, type Mate } from "./chemistry";
import type { ClutchLine } from "./clutch";
import { fmtAvg, fmtPct } from "./stats";

export type MatchupInsight = {
  mate: Mate;
  winPct: number;
  label: string;
  badge: string;
  color: "loss" | "win" | "court" | "neutral";
  description: string;
};

export type PlayerTendency = {
  id: string;
  title: string;
  stat: string;
  emoji: string;
  detail: string;
};

export type ScoutingReport = {
  playerId: number;
  playerName: string;
  nemesis: MatchupInsight | null;
  bunny: MatchupInsight | null;
  bestCoStar: MatchupInsight | null;
  worstCoStar: MatchupInsight | null;
  topRival: MatchupInsight | null;
  tendencies: PlayerTendency[];
  summary: string;
};

export function generateScoutingReport({
  playerId,
  playerName,
  career,
  games,
  clutch,
}: {
  playerId: number;
  playerName: string;
  career: CareerLine;
  games: Game[];
  clutch?: ClutchLine | null;
}): ScoutingReport {
  const pairs = pairStats(games);
  const relations = relationsFor(playerId, pairs);

  // 1. NEMESIS (The opponent who defeats this player the most)
  // Needs at least 2 games against
  const qualifiedOpponents = relations.opponents.filter((m) => m.gp >= 2);
  
  let nemesis: MatchupInsight | null = null;
  const losingOpponents = [...qualifiedOpponents]
    .filter((m) => m.losses > m.wins)
    .sort((a, b) => a.wins / a.gp - b.wins / b.gp || b.losses - a.losses);

  if (losingOpponents.length > 0) {
    const opp = losingOpponents[0];
    const pct = Math.round((opp.wins / opp.gp) * 100);
    nemesis = {
      mate: opp,
      winPct: pct,
      label: "Nemesis",
      badge: "Tough Matchup",
      color: "loss",
      description: `Only ${opp.wins}W – ${opp.losses}L (${pct}% win rate) against ${opp.name}.`,
    };
  }

  // 2. FAVORITE TARGET ("Bunny" / Who this player cooks the most)
  let bunny: MatchupInsight | null = null;
  const winningOpponents = [...qualifiedOpponents]
    .filter((m) => m.wins > m.losses)
    .sort((a, b) => b.wins / b.gp - a.wins / a.gp || b.wins - a.wins);

  if (winningOpponents.length > 0) {
    const opp = winningOpponents[0];
    const pct = Math.round((opp.wins / opp.gp) * 100);
    bunny = {
      mate: opp,
      winPct: pct,
      label: "Favorite Target",
      badge: "Dominant",
      color: "win",
      description: `Commands a ${opp.wins}W – ${opp.losses}L record (${pct}% win rate) facing ${opp.name}.`,
    };
  }

  // 3. TOP RIVAL (Most games played against)
  let topRival: MatchupInsight | null = null;
  if (relations.opponents.length > 0) {
    const opp = [...relations.opponents].sort((a, b) => b.gp - a.gp)[0];
    if (opp && opp.gp >= 3 && opp.playerId !== nemesis?.mate.playerId && opp.playerId !== bunny?.mate.playerId) {
      topRival = {
        mate: opp,
        winPct: Math.round((opp.wins / opp.gp) * 100),
        label: "Frequent Foe",
        badge: "Rivalry",
        color: "court",
        description: `Met across the court in ${opp.gp} games (${opp.wins}W – ${opp.losses}L).`,
      };
    }
  }

  // 4. BEST CO-STAR (Highest win % together, min 2 games)
  const qualifiedTeammates = relations.teammates.filter((m) => m.gp >= 2);
  let bestCoStar: MatchupInsight | null = null;
  const winningTeammates = [...qualifiedTeammates]
    .filter((m) => m.wins > m.losses)
    .sort((a, b) => b.wins / b.gp - a.wins / a.gp || b.wins - a.wins);

  if (winningTeammates.length > 0) {
    const mate = winningTeammates[0];
    const pct = Math.round((mate.wins / mate.gp) * 100);
    bestCoStar = {
      mate,
      winPct: pct,
      label: "Ideal Co-Star",
      badge: "High Chemistry",
      color: "win",
      description: `Dominant ${mate.wins}W – ${mate.losses}L synergy (${pct}% win rate) sharing the floor.`,
    };
  }

  // 5. TOUGH SYNERGY (Lowest win % together, min 2 games)
  let worstCoStar: MatchupInsight | null = null;
  const strugglingTeammates = [...qualifiedTeammates]
    .filter((m) => m.losses > m.wins && m.playerId !== bestCoStar?.mate.playerId)
    .sort((a, b) => a.wins / a.gp - b.wins / b.gp || b.losses - a.losses);

  if (strugglingTeammates.length > 0) {
    const mate = strugglingTeammates[0];
    const pct = Math.round((mate.wins / mate.gp) * 100);
    worstCoStar = {
      mate,
      winPct: pct,
      label: "Cold Synergy",
      badge: "Mismatched",
      color: "loss",
      description: `Struggled to ${mate.wins}W – ${mate.losses}L (${pct}% win rate) when paired on the same team.`,
    };
  }

  // 6. PLAYSTYLE TENDENCIES
  const tendencies: PlayerTendency[] = [];
  const gp = Math.max(1, career.gp);

  // Shot Selection Tendency
  const threeRatio = career.fga > 0 ? career.fg3a / career.fga : 0;
  if (threeRatio >= 0.50 && career.fga >= 6) {
    tendencies.push({
      id: "deep_threat",
      title: "Perimeter Marksman",
      stat: `${Math.round(threeRatio * 100)}% 3PA Ratio`,
      emoji: "🎯",
      detail: `Launches ${Math.round(threeRatio * 100)}% of all field goal attempts from beyond the 3-point arc (${fmtPct(career.fg3m, career.fg3a)} 3P%).`,
    });
  } else if (threeRatio <= 0.20 && career.fga >= 6) {
    tendencies.push({
      id: "paint_beast",
      title: "Inside Slasher",
      stat: `${Math.round((1 - threeRatio) * 100)}% Inside 2s`,
      emoji: "💥",
      detail: `Aggressively attacks the interior (${career.fg2m}/${career.fg2a} 2PM, ${fmtPct(career.fg2m, career.fg2a)}). Rarely settles for long jumpers.`,
    });
  }

  // Rebounding Tendency
  const orebRatio = career.reb > 0 ? career.oreb / career.reb : 0;
  if (orebRatio >= 0.35 && career.reb >= 4) {
    tendencies.push({
      id: "offensive_glass",
      title: "Offensive Glass Crasher",
      stat: `${Math.round(orebRatio * 100)}% O-REB`,
      emoji: "🪟",
      detail: `Generates second-chance points: ${career.oreb} of ${career.reb} total rebounds are grabbed off offensive misses.`,
    });
  } else if (career.reb / gp >= 5.0) {
    tendencies.push({
      id: "board_monster",
      title: "Board Magnet",
      stat: `${fmtAvg(career.reb, gp)} RPG`,
      emoji: "📦",
      detail: `Cleans the glass at an elite clip of ${fmtAvg(career.reb, gp)} rebounds per game.`,
    });
  }

  // Playmaking Tendency
  if (career.tov > 0 && career.ast / career.tov >= 2.0 && career.ast >= 4) {
    tendencies.push({
      id: "careful_passer",
      title: "Secure Playmaker",
      stat: `${(career.ast / career.tov).toFixed(1)} A/TO`,
      emoji: "🎩",
      detail: `Takes care of the rock with an exceptional ${(career.ast / career.tov).toFixed(1)} assist-to-turnover ratio.`,
    });
  } else if (career.ast / gp >= 3.0) {
    tendencies.push({
      id: "floor_general",
      title: "Floor General",
      stat: `${fmtAvg(career.ast, gp)} APG`,
      emoji: "🪄",
      detail: `Consistently orchestrates offenses and creates easy buckets (${fmtAvg(career.ast, gp)} assists per game).`,
    });
  }

  // Defensive Disruptor Tendency
  const hustlePerGame = (career.stl + career.defl + career.blk) / gp;
  if (hustlePerGame >= 2.0) {
    tendencies.push({
      id: "disruptor",
      title: "Active Disruptor",
      stat: `${hustlePerGame.toFixed(1)} Stocks/G`,
      emoji: "🔒",
      detail: `Blows up passing lanes with ${career.stl} steals, ${career.blk} blocks, and ${career.defl} deflections recorded.`,
    });
  }

  // Clutch Tendency
  if (clutch && clutch.gameWinners > 0) {
    tendencies.push({
      id: "clutch_killer",
      title: "Walk-Off Closer",
      stat: `${clutch.gameWinners} Game-Winners`,
      emoji: "🧊",
      detail: `Delivers in the clutch with ${clutch.gameWinners} game-winning buzzer-beater baskets sunk.`,
    });
  }

  // 7. SUMMARY NARRATIVE
  const parts: string[] = [];
  if (bestCoStar) {
    parts.push(`Plays best alongside ${bestCoStar.mate.name} (${bestCoStar.winPct}% win rate together)`);
  }
  if (nemesis) {
    parts.push(`faces tough resistance against ${nemesis.mate.name} (${nemesis.winPct}% win rate)`);
  }
  if (tendencies[0]) {
    parts.push(`operates as a ${tendencies[0].title.toLowerCase()}`);
  }

  const summary = parts.length > 0
    ? `${playerName} ${parts.join(", and ")}.`
    : `${playerName} is establishing their presence in the league with ${career.gp} games played.`;

  return {
    playerId,
    playerName,
    nemesis,
    bunny,
    bestCoStar,
    worstCoStar,
    topRival,
    tendencies,
    summary,
  };
}

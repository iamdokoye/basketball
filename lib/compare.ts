import type { CareerLine, Game, Player } from "./queries";
import { played } from "./rating";
import { clutchTotals } from "./clutch";
import { trophyShelf } from "./trophies";
import { fmtSigned, type StatLine } from "./stats";
import { averageRating } from "./rating";
import type { VotedAward } from "./queries";

export type HeadToHeadGame = {
  id: number;
  playedAt: string;
  p1Team: "A" | "B";
  p2Team: "A" | "B";
  p1Score: number;
  p2Score: number;
  winnerId: number;
  p1Line: StatLine;
  p2Line: StatLine;
};

export type MatchupMetric = {
  key: string;
  label: string;
  category: "scoring" | "impact" | "defense" | "shooting";
  p1Value: number;
  p2Value: number;
  p1Display: string;
  p2Display: string;
  advantage: "p1" | "p2" | "tie";
};

export type TrophyBattle = {
  label: string;
  emoji: string;
  p1Count: number;
  p2Count: number;
  advantage: "p1" | "p2" | "tie";
};

export type HeadToHeadSummary = {
  player1: Player;
  player2: Player;
  career1: CareerLine;
  career2: CareerLine;
  against: {
    gp: number;
    p1Wins: number;
    p2Wins: number;
    p1Pts: number;
    p2Pts: number;
    p1Ppg: number;
    p2Ppg: number;
    matchups: HeadToHeadGame[];
  };
  together: {
    gp: number;
    wins: number;
    losses: number;
    winPct: number;
  };
  metrics: MatchupMetric[];
  trophies: TrophyBattle[];
  p1Dominance: number; // 0 to 100 percentage
  banter: string;
};

const pct = (w: number, gp: number) => (gp > 0 ? (w / gp) * 100 : 0);

export function comparePlayers(
  p1Id: number,
  p2Id: number,
  players: Player[],
  games: Game[],
  career: CareerLine[],
  votedAwards: VotedAward[] = [],
): HeadToHeadSummary | null {
  const p1 = players.find((p) => p.id === p1Id);
  const p2 = players.find((p) => p.id === p2Id);
  if (!p1 || !p2) return null;

  const c1 = career.find((c) => c.playerId === p1Id);
  const c2 = career.find((c) => c.playerId === p2Id);
  if (!c1 || !c2) return null;

  const finalGames = games.filter((g) => g.status === "final" && g.score.A !== g.score.B);

  // 1. Direct head-to-head games
  const matchups: HeadToHeadGame[] = [];
  let p1Wins = 0;
  let p2Wins = 0;
  let p1Pts = 0;
  let p2Pts = 0;

  // 2. Games played together
  let togetherGp = 0;
  let togetherWins = 0;
  let togetherLosses = 0;

  for (const g of finalGames) {
    const l1 = g.lines.find((l) => l.playerId === p1Id && played(l));
    const l2 = g.lines.find((l) => l.playerId === p2Id && played(l));
    if (!l1 || !l2) continue;

    const winnerTeam = g.score.A > g.score.B ? "A" : "B";

    if (l1.team === l2.team) {
      togetherGp++;
      if (l1.team === winnerTeam) togetherWins++;
      else togetherLosses++;
    } else {
      // Opponents
      const p1Won = l1.team === winnerTeam;
      if (p1Won) p1Wins++;
      else p2Wins++;

      p1Pts += l1.pts;
      p2Pts += l2.pts;

      matchups.push({
        id: g.id,
        playedAt: g.playedAt,
        p1Team: l1.team,
        p2Team: l2.team,
        p1Score: g.score[l1.team],
        p2Score: g.score[l2.team],
        winnerId: p1Won ? p1Id : p2Id,
        p1Line: l1,
        p2Line: l2,
      });
    }
  }

  const againstGp = matchups.length;
  const p1Ppg = againstGp ? p1Pts / againstGp : 0;
  const p2Ppg = againstGp ? p2Pts / againstGp : 0;

  // 3. Overall metrics
  const c1Rating = averageRating(c1.ratingSum, c1.ratingW);
  const c2Rating = averageRating(c2.ratingSum, c2.ratingW);

  const c1Ppg = c1.gp ? c1.pts / c1.gp : 0;
  const c2Ppg = c2.gp ? c2.pts / c2.gp : 0;

  const c1Rpg = c1.gp ? c1.reb / c1.gp : 0;
  const c2Rpg = c2.gp ? c2.reb / c2.gp : 0;

  const c1Apg = c1.gp ? c1.ast / c1.gp : 0;
  const c2Apg = c2.gp ? c2.ast / c2.gp : 0;

  const c1Spg = c1.gp ? c1.stl / c1.gp : 0;
  const c2Spg = c2.gp ? c2.stl / c2.gp : 0;

  const c1Bpg = c1.gp ? c1.blk / c1.gp : 0;
  const c2Bpg = c2.gp ? c2.blk / c2.gp : 0;

  const c1WinPct = pct(c1.wins, c1.wins + c1.losses);
  const c2WinPct = pct(c2.wins, c2.wins + c2.losses);

  const c1FgPct = c1.fga ? (c1.fgm / c1.fga) * 100 : 0;
  const c2FgPct = c2.fga ? (c2.fgm / c2.fga) * 100 : 0;

  const c1ThreePct = c1.fg3a ? (c1.fg3m / c1.fg3a) * 100 : 0;
  const c2ThreePct = c2.fg3a ? (c2.fg3m / c2.fg3a) * 100 : 0;

  const c1Ts = c1.fga || c1.fta ? ((c1.pts / (2 * (c1.fga + 0.44 * c1.fta))) * 100) : 0;
  const c2Ts = c2.fga || c2.fta ? ((c2.pts / (2 * (c2.fga + 0.44 * c2.fta))) * 100) : 0;

  const c1Pm = c1.gp ? c1.plusMinus / c1.gp : 0;
  const c2Pm = c2.gp ? c2.plusMinus / c2.gp : 0;

  const clutchAll = clutchTotals(games);
  const cl1 = clutchAll.find((c) => c.playerId === p1Id);
  const cl2 = clutchAll.find((c) => c.playerId === p2Id);
  const c1GameWinners = cl1?.gameWinners ?? 0;
  const c2GameWinners = cl2?.gameWinners ?? 0;
  const c1ClutchPts = cl1?.clutchPts ?? 0;
  const c2ClutchPts = cl2?.clutchPts ?? 0;

  const makeMetric = (
    key: string,
    label: string,
    category: MatchupMetric["category"],
    v1: number,
    v2: number,
    d1: string,
    d2: string,
    precision = 0.05,
  ): MatchupMetric => {
    let advantage: "p1" | "p2" | "tie" = "tie";
    if (v1 > v2 + precision) advantage = "p1";
    else if (v2 > v1 + precision) advantage = "p2";
    return {
      key,
      label,
      category,
      p1Value: v1,
      p2Value: v2,
      p1Display: d1,
      p2Display: d2,
      advantage,
    };
  };

  const metrics: MatchupMetric[] = [
    makeMetric("rating", "PER / Rating", "impact", c1Rating, c2Rating, c1Rating.toFixed(1), c2Rating.toFixed(1)),
    makeMetric("winPct", "Win Rate", "impact", c1WinPct, c2WinPct, `${Math.round(c1WinPct)}%`, `${Math.round(c2WinPct)}%`),
    makeMetric("ppg", "Points / Game", "scoring", c1Ppg, c2Ppg, c1Ppg.toFixed(1), c2Ppg.toFixed(1)),
    makeMetric("rpg", "Rebounds / Game", "impact", c1Rpg, c2Rpg, c1Rpg.toFixed(1), c2Rpg.toFixed(1)),
    makeMetric("apg", "Assists / Game", "impact", c1Apg, c2Apg, c1Apg.toFixed(1), c2Apg.toFixed(1)),
    makeMetric("spg", "Steals / Game", "defense", c1Spg, c2Spg, c1Spg.toFixed(1), c2Spg.toFixed(1)),
    makeMetric("bpg", "Blocks / Game", "defense", c1Bpg, c2Bpg, c1Bpg.toFixed(1), c2Bpg.toFixed(1)),
    makeMetric("pm", "+/- Margin", "impact", c1Pm, c2Pm, fmtSigned(c1Pm), fmtSigned(c2Pm)),
    makeMetric("ts", "True Shooting (TS%)", "shooting", c1Ts, c2Ts, `${Math.round(c1Ts)}%`, `${Math.round(c2Ts)}%`),
    makeMetric("fg", "Field Goal %", "shooting", c1FgPct, c2FgPct, `${Math.round(c1FgPct)}%`, `${Math.round(c2FgPct)}%`),
    makeMetric("three", "3-Point %", "shooting", c1ThreePct, c2ThreePct, `${Math.round(c1ThreePct)}%`, `${Math.round(c2ThreePct)}%`),
    makeMetric("clutch", "Clutch Points", "impact", c1ClutchPts, c2ClutchPts, String(c1ClutchPts), String(c2ClutchPts)),
    makeMetric("winners", "Game-Winners", "impact", c1GameWinners, c2GameWinners, String(c1GameWinners), String(c2GameWinners)),
  ];

  // 4. Trophy comparison
  const allShelves = trophyShelf(games, "UTC", 6, Date.now(), votedAwards);
  const shelf1 = allShelves.get(p1Id);
  const shelf2 = allShelves.get(p2Id);

  const totalMvp1 = (shelf1?.weeklyMvp ?? 0) + (shelf1?.monthlyMvp ?? 0) + (shelf1?.quarterlyMvp ?? 0) + (shelf1?.yearlyMvp ?? 0);
  const totalMvp2 = (shelf2?.weeklyMvp ?? 0) + (shelf2?.monthlyMvp ?? 0) + (shelf2?.quarterlyMvp ?? 0) + (shelf2?.yearlyMvp ?? 0);

  const trophyDefinitions: { label: string; emoji: string; count1: number; count2: number }[] = [
    { label: "Total MVPs", emoji: "🏆", count1: totalMvp1, count2: totalMvp2 },
    { label: "Player of the Game", emoji: "⭐", count1: shelf1?.playerOfTheGame ?? 0, count2: shelf2?.playerOfTheGame ?? 0 },
    { label: "All-Star Three", emoji: "🌟", count1: shelf1?.allStarThree ?? 0, count2: shelf2?.allStarThree ?? 0 },
    { label: "Team of Tourney (Best Trio)", emoji: "🛡️", count1: shelf1?.bestTrio ?? 0, count2: shelf2?.bestTrio ?? 0 },
    { label: "DPOY (Defensive)", emoji: "🔒", count1: (shelf1?.dpoyQuarterly ?? 0) + (shelf1?.dpoyYearly ?? 0), count2: (shelf2?.dpoyQuarterly ?? 0) + (shelf2?.dpoyYearly ?? 0) },
    { label: "Clutch Player", emoji: "⏱️", count1: (shelf1?.clutchPlayerOfQuarter ?? 0) + (shelf1?.clutchPlayerOfYear ?? 0), count2: (shelf2?.clutchPlayerOfQuarter ?? 0) + (shelf2?.clutchPlayerOfYear ?? 0) },
    { label: "Sixth Man", emoji: "⚡", count1: (shelf1?.sixthManOfQuarter ?? 0) + (shelf1?.sixthManOfYear ?? 0), count2: (shelf2?.sixthManOfQuarter ?? 0) + (shelf2?.sixthManOfYear ?? 0) },
    { label: "Most Improved", emoji: "📈", count1: (shelf1?.mipQuarterly ?? 0) + (shelf1?.mipYearly ?? 0), count2: (shelf2?.mipQuarterly ?? 0) + (shelf2?.mipYearly ?? 0) },
    { label: "Most Spectacular", emoji: "✨", count1: shelf1?.mostSpectacular ?? 0, count2: shelf2?.mostSpectacular ?? 0 },
  ];

  const trophies: TrophyBattle[] = trophyDefinitions.map(({ label, emoji, count1, count2 }) => {
    let advantage: "p1" | "p2" | "tie" = "tie";
    if (count1 > count2) advantage = "p1";
    else if (count2 > count1) advantage = "p2";
    return { label, emoji, p1Count: count1, p2Count: count2, advantage };
  });

  // Calculate advantage score
  const p1MetricWins = metrics.filter((m) => m.advantage === "p1").length;
  const p2MetricWins = metrics.filter((m) => m.advantage === "p2").length;
  const totalDecided = p1MetricWins + p2MetricWins;
  const p1Dominance = totalDecided > 0 ? Math.round((p1MetricWins / totalDecided) * 100) : 50;

  // Banter string for group chat
  const banter = [
    `🏀 TALE OF THE TAPE: ${p1.name} vs ${p2.name}`,
    `⚔️ Head-to-Head: ${p1.name} ${p1Wins} - ${p2Wins} ${p2.name} (${againstGp} games)`,
    againstGp > 0 ? `📊 Matchup PPG: ${p1.name} (${p1Ppg.toFixed(1)}) vs ${p2.name} (${p2Ppg.toFixed(1)})` : "",
    `⭐ Overall Rating: ${c1Rating.toFixed(1)} vs ${c2Rating.toFixed(1)}`,
    `🏆 Total MVPs: ${totalMvp1} vs ${totalMvp2}`,
    togetherGp > 0 ? `🤝 When on the same team: ${togetherWins}-${togetherLosses} (${Math.round((togetherWins / togetherGp) * 100)}% Win Rate)` : "",
    `🔥 Category Edge: ${p1MetricWins} - ${p2MetricWins} (${p1Dominance}% in favor of ${p1.name})`,
  ].filter(Boolean).join("\n");

  return {
    player1: p1,
    player2: p2,
    career1: c1,
    career2: c2,
    against: {
      gp: againstGp,
      p1Wins,
      p2Wins,
      p1Pts,
      p2Pts,
      p1Ppg,
      p2Ppg,
      matchups,
    },
    together: {
      gp: togetherGp,
      wins: togetherWins,
      losses: togetherLosses,
      winPct: togetherGp > 0 ? (togetherWins / togetherGp) * 100 : 0,
    },
    metrics,
    trophies,
    p1Dominance,
    banter,
  };
}

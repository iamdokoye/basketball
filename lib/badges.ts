import type { CareerLine } from "./queries";
import type { ClutchLine } from "./clutch";

export type BadgeTier = "bronze" | "silver" | "gold" | "hof";

export type Badge = {
  id: string;
  name: string;
  emoji: string;
  tier: BadgeTier;
  tierLabel: string;
  description: string;
  progress: string;
};

export type PlayerArchetype = {
  title: string;
  emoji: string;
  description: string;
  badges: Badge[];
};

const TIER_ORDER: Record<BadgeTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  hof: 4,
};

const TIER_LABELS: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  hof: "Hall of Fame",
};

/**
 * Computes all 2K-style badges and the primary player archetype based on career stats.
 */
export function computePlayerArchetype(
  career: CareerLine,
  clutch?: ClutchLine | null,
  totalLeagueGames?: number,
): PlayerArchetype {
  const gp = Math.max(1, career.gp);
  const ppg = career.pts / gp;
  const rpg = career.reb / gp;
  const apg = career.ast / gp;
  const spg = career.stl / gp;
  const bpg = career.blk / gp;
  const deflPg = career.defl / gp;
  const pmPg = career.plusMinus / gp;
  const fg3Pct = career.fg3a > 0 ? career.fg3m / career.fg3a : 0;
  const astTov = career.tov > 0 ? career.ast / career.tov : career.ast;
  const gw = clutch?.gameWinners ?? 0;
  const clutchPts = clutch?.clutchPts ?? 0;

  const badges: Badge[] = [];

  // 1. Sharpshooter (Deadeye)
  if (career.fg3m >= 3) {
    let tier: BadgeTier = "bronze";
    if (career.fg3m >= 40 && fg3Pct >= 0.35) tier = "hof";
    else if (career.fg3m >= 20 && fg3Pct >= 0.32) tier = "gold";
    else if (career.fg3m >= 8 && fg3Pct >= 0.28) tier = "silver";

    badges.push({
      id: "sharpshooter",
      name: "Deadeye",
      emoji: "🎯",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Deadly accuracy and confidence from beyond the three-point arc.",
      progress: `${career.fg3m} threes (${Math.round(fg3Pct * 100)}% 3PT)`,
    });
  }

  // 2. Walking Bucket
  if (career.pts >= 25 || ppg >= 6.0) {
    let tier: BadgeTier = "bronze";
    if (career.pts >= 250 || ppg >= 13.0) tier = "hof";
    else if (career.pts >= 120 || ppg >= 10.0) tier = "gold";
    else if (career.pts >= 60 || ppg >= 8.0) tier = "silver";

    badges.push({
      id: "bucket",
      name: "Walking Bucket",
      emoji: "🪣",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Scores in bunches and commands defensive attention at all times.",
      progress: `${ppg.toFixed(1)} PPG (${career.pts} total pts)`,
    });
  }

  // 3. Paint Beast / Glass Cleaner
  if (career.reb >= 15 || rpg >= 3.5) {
    let tier: BadgeTier = "bronze";
    if (career.reb >= 150 || rpg >= 9.0) tier = "hof";
    else if (career.reb >= 80 || rpg >= 7.0) tier = "gold";
    else if (career.reb >= 40 || rpg >= 5.0) tier = "silver";

    badges.push({
      id: "paint-beast",
      name: "Glass Titan",
      emoji: "🦏",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Relentless on the boards, grabbing put-backs and securing possessions.",
      progress: `${rpg.toFixed(1)} RPG (${career.reb} reb, ${career.oreb} offensive)`,
    });
  }

  // 4. Floor General
  if (career.ast >= 8 || apg >= 1.5) {
    let tier: BadgeTier = "bronze";
    if (career.ast >= 70 || (apg >= 5.0 && astTov >= 2.0)) tier = "hof";
    else if (career.ast >= 35 || (apg >= 3.5 && astTov >= 1.5)) tier = "gold";
    else if (career.ast >= 18 || apg >= 2.5) tier = "silver";

    badges.push({
      id: "floor-general",
      name: "Floor General",
      emoji: "🪄",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Orchestrates the floor, finds open cutters, and delivers crisp passes.",
      progress: `${apg.toFixed(1)} APG (${career.ast} ast, ${astTov.toFixed(1)} AST/TO)`,
    });
  }

  // 5. Lockdown Defender
  const stocks = career.stl + career.blk + career.defl;
  if (stocks >= 8 || spg + bpg >= 1.2) {
    let tier: BadgeTier = "bronze";
    if (stocks >= 80 || spg + bpg >= 3.5) tier = "hof";
    else if (stocks >= 40 || spg + bpg >= 2.5) tier = "gold";
    else if (stocks >= 20 || spg + bpg >= 1.8) tier = "silver";

    badges.push({
      id: "lockdown",
      name: "Lockdown",
      emoji: "🔒",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Stifles opposing ball handlers with steals, swats, and deflections.",
      progress: `${spg.toFixed(1)} SPG · ${bpg.toFixed(1)} BPG · ${career.defl} deflections`,
    });
  }

  // 6. Clutch Gene
  if (gw >= 1 || clutchPts >= 5) {
    let tier: BadgeTier = "bronze";
    if (gw >= 4 || clutchPts >= 30) tier = "hof";
    else if (gw >= 2 || clutchPts >= 18) tier = "gold";
    else if (gw >= 1 && clutchPts >= 10) tier = "silver";

    badges.push({
      id: "clutch-gene",
      name: "Clutch Gene",
      emoji: "🧊",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Unfazed by game pressure; delivers game-winners and late-game stops.",
      progress: `${gw} game-winner${gw === 1 ? "" : "s"} · ${clutchPts} clutch pts`,
    });
  }

  // 7. Sparkplug / Energizer
  if (career.gp >= 2 && (pmPg >= 1.0 || deflPg >= 1.5)) {
    let tier: BadgeTier = "bronze";
    if (pmPg >= 4.0 && deflPg >= 2.5) tier = "hof";
    else if (pmPg >= 2.5 && deflPg >= 2.0) tier = "gold";
    else if (pmPg >= 1.5 || deflPg >= 1.8) tier = "silver";

    badges.push({
      id: "sparkplug",
      name: "Sparkplug",
      emoji: "⚡",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Injects instant hustle, momentum swings, and high positive point differentials.",
      progress: `${pmPg >= 0 ? "+" : ""}${pmPg.toFixed(1)} plus/minus per game`,
    });
  }

  // 8. Iron Man
  // Dynamically evaluated based on attendance rate (% of total league games).
  const totalGames = Math.max(career.gp, totalLeagueGames ?? 0);
  if (totalGames >= 5 && career.gp >= 3) {
    const attendancePct = career.gp / totalGames;
    let tier: BadgeTier | null = null;

    if (attendancePct >= 0.9) tier = "hof";
    else if (attendancePct >= 0.8) tier = "gold";
    else if (attendancePct >= 0.65) tier = "silver";
    else if (attendancePct >= 0.5) tier = "bronze";

    if (tier) {
      badges.push({
        id: "iron-man",
        name: "Iron Man",
        emoji: "👑",
        tier,
        tierLabel: TIER_LABELS[tier],
        description: "Always answers the bell; unmatched attendance and league consistency.",
        progress: `${Math.round(attendancePct * 100)}% attendance (${career.gp}/${totalGames} games)`,
      });
    }
  }

  // Sort badges by tier (HOF first, then Gold, Silver, Bronze)
  badges.sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier]);

  // Determine Archetype
  let archetypeTitle = "Prospect";
  let archetypeEmoji = "🌱";
  let archetypeDesc = "Developing their game and carving out an identity on the court.";

  if (career.gp < 2) {
    archetypeTitle = "Rookie";
    archetypeEmoji = "🏀";
    archetypeDesc = "Fresh to the league, making their initial mark on the court.";
  } else if (badges.some((b) => b.id === "sharpshooter" && TIER_ORDER[b.tier] >= 2)) {
    if (badges.some((b) => b.id === "lockdown")) {
      archetypeTitle = "3-and-D Specialist";
      archetypeEmoji = "🎯";
      archetypeDesc = "Spreads the floor with elite three-point shooting and hounds ball-handlers.";
    } else {
      archetypeTitle = "Sharpshooter";
      archetypeEmoji = "🎯";
      archetypeDesc = "Lethal shooting threat from anywhere behind the arc.";
    }
  } else if (badges.some((b) => b.id === "floor-general" && TIER_ORDER[b.tier] >= 2)) {
    if (ppg >= 8.0) {
      archetypeTitle = "Point God";
      archetypeEmoji = "🪄";
      archetypeDesc = "Commands the pace of the game while scoring and creating for teammates.";
    } else {
      archetypeTitle = "Floor General";
      archetypeEmoji = "🪄";
      archetypeDesc = "Pure playmaker who elevates everyone around them.";
    }
  } else if (badges.some((b) => b.id === "paint-beast" && TIER_ORDER[b.tier] >= 2)) {
    if (badges.some((b) => b.id === "lockdown")) {
      archetypeTitle = "Defensive Anchor";
      archetypeEmoji = "🏰";
      archetypeDesc = "Controls the paint, dominates the glass, and protects the rim.";
    } else {
      archetypeTitle = "Paint Beast";
      archetypeEmoji = "🦏";
      archetypeDesc = "Physical force on the interior who owns the boards and finishes through contact.";
    }
  } else if (badges.some((b) => b.id === "lockdown" && TIER_ORDER[b.tier] >= 2)) {
    if (ppg >= 7.0) {
      archetypeTitle = "Two-Way Slasher";
      archetypeEmoji = "⚔️";
      archetypeDesc = "Disrupts on defense and attacks the rim with relentless energy.";
    } else {
      archetypeTitle = "Lockdown Specialist";
      archetypeEmoji = "🔒";
      archetypeDesc = "Defensive stopper who takes on the opponent's toughest matchup.";
    }
  } else if (ppg >= 9.0 && rpg >= 5.0 && apg >= 2.0) {
    archetypeTitle = "All-Around Threat";
    archetypeEmoji = "🌟";
    archetypeDesc = "Versatile weapon who contributes across every single statistical category.";
  } else if (ppg >= 9.0) {
    archetypeTitle = "Pure Scorer";
    archetypeEmoji = "🔥";
    archetypeDesc = "Natural scoring instinct capable of heating up in a flash.";
  } else if (rpg >= 5.0) {
    archetypeTitle = "Rebound Dynamo";
    archetypeEmoji = "🦍";
    archetypeDesc = "High-motor rebounder who guarantees extra possessions.";
  } else if (badges.some((b) => b.id === "sparkplug")) {
    archetypeTitle = "Hustle Engine";
    archetypeEmoji = "⚡";
    archetypeDesc = "Brings continuous effort, winning plays, and game-changing momentum.";
  } else {
    archetypeTitle = "Glue Player";
    archetypeEmoji = "🧩";
    archetypeDesc = "Reliable teammate who does the little things that lead to winning.";
  }

  return {
    title: archetypeTitle,
    emoji: archetypeEmoji,
    description: archetypeDesc,
    badges,
  };
}

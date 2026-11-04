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

export type ArchetypeTier = 0 | 1 | 2 | 3;

export type ArchetypeUpgrade = {
  title: string;
  emoji: string;
  tier: ArchetypeTier;
  tierLabel: string;
  progressPct: number;
  requirement: string;
  description: string;
};

export type PlayerArchetype = {
  title: string;
  emoji: string;
  description: string;
  tier: ArchetypeTier;
  tierLabel: string;
  gp: number;
  badges: Badge[];
  nextUpgrades: ArchetypeUpgrade[];
};

export const ARCHETYPE_TIER_META: Record<
  ArchetypeTier,
  { label: string; badgeClass: string; dotClass: string }
> = {
  3: {
    label: "Tier 3 · Pinnacle",
    badgeClass: "bg-purple-600/15 text-purple-700 ring-purple-500/35",
    dotClass: "bg-purple-600",
  },
  2: {
    label: "Tier 2 · Hybrid",
    badgeClass: "bg-amber-400/20 text-amber-700 ring-amber-500/40",
    dotClass: "bg-amber-500",
  },
  1: {
    label: "Tier 1 · Specialist",
    badgeClass: "bg-sky-500/15 text-sky-700 ring-sky-500/35",
    dotClass: "bg-sky-500",
  },
  0: {
    label: "Foundation",
    badgeClass: "bg-slate-300/40 text-slate-700 ring-slate-400/30",
    dotClass: "bg-slate-500",
  },
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
 * Computes all 2K-style badges and the player's playstyle archetype.
 * Uses a tiered priority ladder:
 * - Tier 3 (Pinnacle): All-Around Threat, Two-Way Force
 * - Tier 2 (Hybrid): Point God, 3-and-D Specialist, Defensive Anchor, Two-Way Slasher
 * - Tier 1 (Specialist): Sharpshooter, Floor General, Paint Beast, Lockdown Specialist, Pure Scorer, Clutch Assassin, Rebound Dynamo, Hustle Engine
 * - Tier 0 (Foundation): Rookie (0-1 GP), Prospect (2-4 GP), Glue Player (5+ GP)
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
  const stocks = career.stl + career.blk + career.defl;

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

  // 3. Paint Beast / Glass Titan
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

  // Helpers for checking earned badges
  const hasBadge = (id: string, minTier: BadgeTier = "bronze") =>
    badges.some((b) => b.id === id && TIER_ORDER[b.tier] >= TIER_ORDER[minTier]);

  const hasSilverSharpshooter = hasBadge("sharpshooter", "silver");
  const hasSilverFloorGeneral = hasBadge("floor-general", "silver");
  const hasSilverPaintBeast = hasBadge("paint-beast", "silver");
  const hasSilverLockdown = hasBadge("lockdown", "silver");
  const hasLockdown = hasBadge("lockdown", "bronze");
  const hasSilverClutch = hasBadge("clutch-gene", "silver");
  const hasSparkplug = hasBadge("sparkplug", "bronze");
  const hasGoldBucket = hasBadge("bucket", "gold");

  // Determine Archetype using the Tier Priority Ladder:
  let archetypeTitle = "Prospect";
  let archetypeEmoji = "🌱";
  let archetypeDesc = "Developing their game and carving out an identity on the court.";
  let archetypeTier: ArchetypeTier = 0;

  if (career.gp < 2) {
    archetypeTitle = "Rookie";
    archetypeEmoji = "🏀";
    archetypeDesc = "Fresh to the league, making their initial mark on the court.";
    archetypeTier = 0;
  }
  // -------------------------------------------------------------
  // TIER 3: PINNACLE / MASTERCLASS (Evaluated 1st)
  // Multi-category dominance: rewarded over single-badge specialties
  // -------------------------------------------------------------
  else if (ppg >= 9.0 && rpg >= 5.0 && apg >= 2.0) {
    archetypeTitle = "All-Around Threat";
    archetypeEmoji = "🌟";
    archetypeDesc = "Elite weapon who dominates across scoring, rebounding, and playmaking.";
    archetypeTier = 3;
  } else if (ppg >= 9.0 && hasSilverLockdown) {
    archetypeTitle = "Two-Way Force";
    archetypeEmoji = "👑";
    archetypeDesc = "Unstoppable two-way juggernaut who dominates on both ends of the floor.";
    archetypeTier = 3;
  }
  // -------------------------------------------------------------
  // TIER 2: ELITE HYBRIDS (Evaluated 2nd)
  // Dual-trait combinations
  // -------------------------------------------------------------
  else if (hasSilverFloorGeneral && ppg >= 8.0) {
    archetypeTitle = "Point God";
    archetypeEmoji = "🪄";
    archetypeDesc = "Commands the pace of the game while scoring and creating for teammates.";
    archetypeTier = 2;
  } else if (hasSilverSharpshooter && hasLockdown) {
    archetypeTitle = "3-and-D Specialist";
    archetypeEmoji = "🎯";
    archetypeDesc = "Spreads the floor with elite three-point shooting and hounds ball-handlers.";
    archetypeTier = 2;
  } else if (hasSilverPaintBeast && hasLockdown) {
    archetypeTitle = "Defensive Anchor";
    archetypeEmoji = "🏰";
    archetypeDesc = "Controls the paint, dominates the glass, and protects the rim.";
    archetypeTier = 2;
  } else if (hasSilverLockdown && ppg >= 7.0) {
    archetypeTitle = "Two-Way Slasher";
    archetypeEmoji = "⚔️";
    archetypeDesc = "Disrupts on defense and attacks the rim with relentless energy.";
    archetypeTier = 2;
  }
  // -------------------------------------------------------------
  // TIER 1: SPECIALIZED DISCIPLINES (Evaluated 3rd)
  // -------------------------------------------------------------
  else if (hasSilverSharpshooter) {
    archetypeTitle = "Sharpshooter";
    archetypeEmoji = "🎯";
    archetypeDesc = "Lethal shooting threat from anywhere behind the arc.";
    archetypeTier = 1;
  } else if (hasSilverFloorGeneral) {
    archetypeTitle = "Floor General";
    archetypeEmoji = "🪄";
    archetypeDesc = "Pure playmaker who elevates everyone around them.";
    archetypeTier = 1;
  } else if (hasSilverPaintBeast) {
    archetypeTitle = "Paint Beast";
    archetypeEmoji = "🦏";
    archetypeDesc = "Physical force on the interior who owns the boards and finishes through contact.";
    archetypeTier = 1;
  } else if (hasSilverLockdown) {
    archetypeTitle = "Lockdown Specialist";
    archetypeEmoji = "🔒";
    archetypeDesc = "Defensive stopper who takes on the opponent's toughest matchup.";
    archetypeTier = 1;
  } else if (ppg >= 9.0 || hasGoldBucket) {
    archetypeTitle = "Pure Scorer";
    archetypeEmoji = "🔥";
    archetypeDesc = "Natural scoring instinct capable of heating up in a flash.";
    archetypeTier = 1;
  } else if (hasSilverClutch) {
    archetypeTitle = "Clutch Assassin";
    archetypeEmoji = "🧊";
    archetypeDesc = "Ice in their veins; delivers game-winners and decisive late-game plays.";
    archetypeTier = 1;
  } else if (rpg >= 5.0) {
    archetypeTitle = "Rebound Dynamo";
    archetypeEmoji = "🦍";
    archetypeDesc = "High-motor rebounder who guarantees extra possessions.";
    archetypeTier = 1;
  } else if (hasSparkplug) {
    archetypeTitle = "Hustle Engine";
    archetypeEmoji = "⚡";
    archetypeDesc = "Brings continuous effort, winning plays, and game-changing momentum.";
    archetypeTier = 1;
  }
  // -------------------------------------------------------------
  // TIER 0: FOUNDATIONS (Evaluated Last)
  // -------------------------------------------------------------
  else if (career.gp < 5) {
    archetypeTitle = "Prospect";
    archetypeEmoji = "🌱";
    archetypeDesc = "Developing their game and carving out an identity on the court.";
    archetypeTier = 0;
  } else {
    archetypeTitle = "Glue Player";
    archetypeEmoji = "🧩";
    archetypeDesc = "Reliable teammate who does the little things that lead to winning.";
    archetypeTier = 0;
  }

  // Compute next archetype evolution targets
  const nextUpgrades = computeArchetypeUpgrades({
    currentTier: archetypeTier,
    currentTitle: archetypeTitle,
    career,
    badges,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    deflPg,
    pmPg,
    fg3Pct,
    stocks,
    gw,
    clutchPts,
    hasSilverSharpshooter,
    hasSilverFloorGeneral,
    hasSilverPaintBeast,
    hasSilverLockdown,
    hasLockdown,
  });

  return {
    title: archetypeTitle,
    emoji: archetypeEmoji,
    description: archetypeDesc,
    tier: archetypeTier,
    tierLabel: ARCHETYPE_TIER_META[archetypeTier].label,
    gp: career.gp,
    badges,
    nextUpgrades,
  };
}

type UpgradeContext = {
  currentTier: ArchetypeTier;
  currentTitle: string;
  career: CareerLine;
  badges: Badge[];
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  deflPg: number;
  pmPg: number;
  fg3Pct: number;
  stocks: number;
  gw: number;
  clutchPts: number;
  hasSilverSharpshooter: boolean;
  hasSilverFloorGeneral: boolean;
  hasSilverPaintBeast: boolean;
  hasSilverLockdown: boolean;
  hasLockdown: boolean;
};

/**
 * Calculates the player's percentage progress and stat requirement deltas
 * toward higher-tier archetypes. Returns the top closest options.
 */
function computeArchetypeUpgrades(ctx: UpgradeContext): ArchetypeUpgrade[] {
  // If player reached Tier 3 (Pinnacle), no higher tier exists
  if (ctx.currentTier === 3) return [];

  const candidates: ArchetypeUpgrade[] = [];

  // 1. Pure Scorer (Tier 1)
  if (ctx.currentTier === 0) {
    const pct = Math.min(99, Math.round((ctx.ppg / 9.0) * 100));
    candidates.push({
      title: "Pure Scorer",
      emoji: "🔥",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement:
        ctx.ppg < 9.0
          ? `Needs +${(9.0 - ctx.ppg).toFixed(1)} PPG (Currently ${ctx.ppg.toFixed(1)} / 9.0 PPG)`
          : "Score 120 total points",
      description: "Natural scoring instinct capable of heating up in a flash.",
    });
  }

  // 2. Sharpshooter (Tier 1)
  if (ctx.currentTier === 0 && !ctx.hasSilverSharpshooter) {
    const countPct = Math.min(1, ctx.career.fg3m / 8);
    const accuracyPct = Math.min(1, ctx.fg3Pct / 0.28);
    const pct = Math.min(99, Math.round((countPct * 0.7 + accuracyPct * 0.3) * 100));
    candidates.push({
      title: "Sharpshooter",
      emoji: "🎯",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement:
        ctx.career.fg3m < 8
          ? `Needs ${8 - ctx.career.fg3m} more 3PM (${ctx.career.fg3m}/8 at ${Math.round(ctx.fg3Pct * 100)}% 3PT)`
          : `Needs ≥28% 3PT accuracy (${Math.round(ctx.fg3Pct * 100)}% currently)`,
      description: "Lethal shooting threat from anywhere behind the arc.",
    });
  }

  // 3. Floor General (Tier 1)
  if (ctx.currentTier === 0 && !ctx.hasSilverFloorGeneral) {
    const pct = Math.min(
      99,
      Math.round(Math.max(ctx.career.ast / 18, ctx.apg / 2.5) * 100),
    );
    candidates.push({
      title: "Floor General",
      emoji: "🪄",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement: `Needs ${Math.max(1, 18 - ctx.career.ast)} more assists or +${Math.max(0.1, 2.5 - ctx.apg).toFixed(1)} APG (${ctx.apg.toFixed(1)} APG currently)`,
      description: "Pure playmaker who elevates everyone around them.",
    });
  }

  // 4. Paint Beast (Tier 1)
  if (ctx.currentTier === 0 && !ctx.hasSilverPaintBeast) {
    const pct = Math.min(
      99,
      Math.round(Math.max(ctx.career.reb / 40, ctx.rpg / 5.0) * 100),
    );
    candidates.push({
      title: "Paint Beast",
      emoji: "🦏",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement: `Needs ${Math.max(1, 40 - ctx.career.reb)} more rebounds or +${Math.max(0.1, 5.0 - ctx.rpg).toFixed(1)} RPG (${ctx.rpg.toFixed(1)} RPG currently)`,
      description: "Physical force on the interior who owns the boards and finishes through contact.",
    });
  }

  // 5. Lockdown Specialist (Tier 1)
  if (ctx.currentTier === 0 && !ctx.hasSilverLockdown) {
    const pct = Math.min(
      99,
      Math.round(Math.max(ctx.stocks / 20, (ctx.spg + ctx.bpg) / 1.8) * 100),
    );
    candidates.push({
      title: "Lockdown Specialist",
      emoji: "🔒",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement: `Needs ${Math.max(1, 20 - ctx.stocks)} more defensive stocks (${ctx.stocks}/20 currently)`,
      description: "Defensive stopper who takes on the opponent's toughest matchup.",
    });
  }

  // 6. Hustle Engine (Tier 1)
  if (ctx.currentTier === 0 && ctx.currentTitle !== "Hustle Engine") {
    const pct = Math.min(
      99,
      Math.round(Math.max((ctx.pmPg + 1.0) / 2.0, ctx.deflPg / 1.5) * 100),
    );
    candidates.push({
      title: "Hustle Engine",
      emoji: "⚡",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: pct,
      requirement:
        ctx.pmPg < 1.0
          ? `Needs +${(1.0 - ctx.pmPg).toFixed(1)} +/- per game (Currently ${ctx.pmPg >= 0 ? "+" : ""}${ctx.pmPg.toFixed(1)})`
          : `Needs ${(1.5 - ctx.deflPg).toFixed(1)} more deflections/game`,
      description: "Brings continuous effort, winning plays, and game-changing momentum.",
    });
  }

  // 7. 3-and-D Specialist (Tier 2)
  if (ctx.currentTier < 2 && ctx.currentTitle !== "3-and-D Specialist") {
    const shootProgress = ctx.hasSilverSharpshooter
      ? 1
      : Math.min(1, ctx.career.fg3m / 8);
    const defProgress = ctx.hasLockdown
      ? 1
      : Math.min(1, Math.max(ctx.stocks / 8, (ctx.spg + ctx.bpg) / 1.2));
    const pct = Math.min(99, Math.round((shootProgress * 0.5 + defProgress * 0.5) * 100));

    candidates.push({
      title: "3-and-D Specialist",
      emoji: "🎯",
      tier: 2,
      tierLabel: ARCHETYPE_TIER_META[2].label,
      progressPct: pct,
      requirement: ctx.hasSilverSharpshooter
        ? `Needs ${Math.max(1, 8 - ctx.stocks)} more stocks for Lockdown badge (Silver Deadeye active)`
        : `Needs Silver Deadeye + Lockdown badge (${ctx.career.fg3m}/8 3PM, ${ctx.stocks}/8 stocks)`,
      description: "Spreads the floor with elite three-point shooting and hounds ball-handlers.",
    });
  }

  // 8. Point God (Tier 2)
  if (ctx.currentTier < 2 && ctx.currentTitle !== "Point God") {
    const astProgress = ctx.hasSilverFloorGeneral
      ? 1
      : Math.min(1, Math.max(ctx.career.ast / 18, ctx.apg / 2.5));
    const ptsProgress = Math.min(1, ctx.ppg / 8.0);
    const pct = Math.min(99, Math.round((astProgress * 0.5 + ptsProgress * 0.5) * 100));

    candidates.push({
      title: "Point God",
      emoji: "🪄",
      tier: 2,
      tierLabel: ARCHETYPE_TIER_META[2].label,
      progressPct: pct,
      requirement: ctx.hasSilverFloorGeneral
        ? `Needs +${Math.max(0.1, 8.0 - ctx.ppg).toFixed(1)} PPG to reach 8.0 PPG (Silver Floor General active)`
        : `Needs Silver Floor General + 8.0 PPG (${ctx.apg.toFixed(1)} APG, ${ctx.ppg.toFixed(1)} PPG)`,
      description: "Commands the pace of the game while scoring and creating for teammates.",
    });
  }

  // 9. Defensive Anchor (Tier 2)
  if (ctx.currentTier < 2 && ctx.currentTitle !== "Defensive Anchor") {
    const rebProgress = ctx.hasSilverPaintBeast
      ? 1
      : Math.min(1, Math.max(ctx.career.reb / 40, ctx.rpg / 5.0));
    const defProgress = ctx.hasLockdown
      ? 1
      : Math.min(1, Math.max(ctx.stocks / 8, (ctx.spg + ctx.bpg) / 1.2));
    const pct = Math.min(99, Math.round((rebProgress * 0.5 + defProgress * 0.5) * 100));

    candidates.push({
      title: "Defensive Anchor",
      emoji: "🏰",
      tier: 2,
      tierLabel: ARCHETYPE_TIER_META[2].label,
      progressPct: pct,
      requirement: ctx.hasSilverPaintBeast
        ? `Needs ${Math.max(1, 8 - ctx.stocks)} more stocks for Lockdown badge (Glass Titan active)`
        : `Needs Silver Glass Titan + Lockdown badge (${ctx.rpg.toFixed(1)} RPG, ${ctx.stocks}/8 stocks)`,
      description: "Controls the paint, dominates the glass, and protects the rim.",
    });
  }

  // 10. Two-Way Slasher (Tier 2)
  if (ctx.currentTier < 2 && ctx.currentTitle !== "Two-Way Slasher") {
    const defProgress = ctx.hasSilverLockdown
      ? 1
      : Math.min(1, Math.max(ctx.stocks / 20, (ctx.spg + ctx.bpg) / 1.8));
    const ptsProgress = Math.min(1, ctx.ppg / 7.0);
    const pct = Math.min(99, Math.round((defProgress * 0.5 + ptsProgress * 0.5) * 100));

    candidates.push({
      title: "Two-Way Slasher",
      emoji: "⚔️",
      tier: 2,
      tierLabel: ARCHETYPE_TIER_META[2].label,
      progressPct: pct,
      requirement: ctx.hasSilverLockdown
        ? `Needs +${Math.max(0.1, 7.0 - ctx.ppg).toFixed(1)} PPG to reach 7.0 PPG (Silver Lockdown active)`
        : `Needs Silver Lockdown + 7.0 PPG (${ctx.stocks}/20 stocks, ${ctx.ppg.toFixed(1)} PPG)`,
      description: "Disrupts on defense and attacks the rim with relentless energy.",
    });
  }

  // 11. All-Around Threat (Tier 3)
  if (ctx.currentTier < 3 && ctx.currentTitle !== "All-Around Threat") {
    const pProgress = Math.min(1, ctx.ppg / 9.0);
    const rProgress = Math.min(1, ctx.rpg / 5.0);
    const aProgress = Math.min(1, ctx.apg / 2.0);
    const pct = Math.min(99, Math.round(((pProgress + rProgress + aProgress) / 3) * 100));

    const needs: string[] = [];
    if (ctx.ppg < 9.0) needs.push(`+${(9.0 - ctx.ppg).toFixed(1)} PPG`);
    if (ctx.rpg < 5.0) needs.push(`+${(5.0 - ctx.rpg).toFixed(1)} RPG`);
    if (ctx.apg < 2.0) needs.push(`+${(2.0 - ctx.apg).toFixed(1)} APG`);

    candidates.push({
      title: "All-Around Threat",
      emoji: "🌟",
      tier: 3,
      tierLabel: ARCHETYPE_TIER_META[3].label,
      progressPct: pct,
      requirement: `Needs: ${needs.join(", ") || "Maintain current stats"}`,
      description: "Elite weapon who dominates across scoring, rebounding, and playmaking.",
    });
  }

  // 12. Two-Way Force (Tier 3)
  if (ctx.currentTier < 3 && ctx.currentTitle !== "Two-Way Force") {
    const pProgress = Math.min(1, ctx.ppg / 9.0);
    const defProgress = ctx.hasSilverLockdown
      ? 1
      : Math.min(1, Math.max(ctx.stocks / 20, (ctx.spg + ctx.bpg) / 1.8));
    const pct = Math.min(99, Math.round((pProgress * 0.5 + defProgress * 0.5) * 100));

    candidates.push({
      title: "Two-Way Force",
      emoji: "👑",
      tier: 3,
      tierLabel: ARCHETYPE_TIER_META[3].label,
      progressPct: pct,
      requirement:
        ctx.ppg < 9.0 && !ctx.hasSilverLockdown
          ? `Needs +${(9.0 - ctx.ppg).toFixed(1)} PPG and Silver Lockdown`
          : ctx.ppg < 9.0
            ? `Needs +${(9.0 - ctx.ppg).toFixed(1)} PPG (Silver Lockdown active)`
            : `Needs Silver Lockdown (${ctx.stocks}/20 stocks)`,
      description: "Unstoppable two-way juggernaut who dominates on both ends of the floor.",
    });
  }

  // Filter candidates: must be >= current tier and not the current title
  return candidates
    .filter((c) => c.tier >= ctx.currentTier && c.title !== ctx.currentTitle && c.progressPct < 100)
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 3);
}

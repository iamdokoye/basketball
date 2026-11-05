import type { CareerLine } from "./queries";
import type { ClutchLine } from "./clutch";

export type BadgeTier = "bronze" | "silver" | "gold" | "hof";

export type BadgeNextTier = {
  tier: BadgeTier;
  tierLabel: string;
  requirement: string;
  progressPct: number;
};

export type Badge = {
  id: string;
  name: string;
  emoji: string;
  tier: BadgeTier;
  tierLabel: string;
  description: string;
  progress: string;
  nextTier?: BadgeNextTier | null;
};

export type ArchetypeTier = 0 | 1 | 2 | 3 | 4;

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
  4: {
    label: "Tier 4 · All-Around Threat",
    badgeClass: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/40 shadow-xs font-black",
    dotClass: "bg-emerald-600",
  },
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
 * Uses a strict tiered progression:
 * - Tier 4 (Supreme Apex): The All-Around Threat (Combines ALL 3 Pillars: Shoot + Assist + Defense)
 * - Tier 3 (Pinnacle Dual-Pillars):
 *     1. Playmaking Shot Creator (Shoot + Assist at Silver+)
 *     2. 3-and-D Specialist (Shoot + Defense at Silver+)
 *     3. Two-Way Floor General (Assist + Defense at Silver+)
 * - Tier 2 (Hybrid): 1 Primary Pillar at Silver+ AND Secondary Skill at Bronze+
 *     1. Combo Guard (Shoot + Secondary Assist)
 *     2. Two-Way Shooter (Shoot + Secondary Defense)
 *     3. Two-Way Playmaker (Assist + Secondary Defense)
 *     4. Two-Way Slasher (Defense + Secondary Scoring)
 *     5. Defensive Anchor (Paint Dominance + Secondary Defense)
 *     6. Two-Way Force (Scoring + Rebounding)
 * - Tier 1 (Specialist): Single Discipline at Silver+
 *     Sharpshooter, Floor General, Paint Beast, Lockdown Specialist, Pure Scorer, Clutch Assassin, Rebound Dynamo, Hustle Engine
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

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededThrees = Math.max(1, 8 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.28);
      const countPct = Math.min(1, career.fg3m / 8);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/8) and ≥28% 3PT (${Math.round(fg3Pct * 100)}% curr)`,
        progressPct: Math.min(99, Math.round((countPct * 0.7 + accPct * 0.3) * 100)),
      };
    } else if (tier === "silver") {
      const neededThrees = Math.max(1, 20 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.32);
      const countPct = Math.min(1, career.fg3m / 20);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/20) and ≥32% 3PT (${Math.round(fg3Pct * 100)}% curr)`,
        progressPct: Math.min(99, Math.round((countPct * 0.7 + accPct * 0.3) * 100)),
      };
    } else if (tier === "gold") {
      const neededThrees = Math.max(1, 40 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.35);
      const countPct = Math.min(1, career.fg3m / 40);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/40) and ≥35% 3PT (${Math.round(fg3Pct * 100)}% curr)`,
        progressPct: Math.min(99, Math.round((countPct * 0.7 + accPct * 0.3) * 100)),
      };
    }

    badges.push({
      id: "sharpshooter",
      name: "Deadeye",
      emoji: "🎯",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Deadly accuracy and confidence from beyond the three-point arc.",
      progress: `${career.fg3m} threes (${Math.round(fg3Pct * 100)}% 3PT)`,
      nextTier,
    });
  }

  // 2. Walking Bucket
  if (career.pts >= 25 || ppg >= 6.0) {
    let tier: BadgeTier = "bronze";
    if (career.pts >= 250 || ppg >= 13.0) tier = "hof";
    else if (career.pts >= 120 || ppg >= 10.0) tier = "gold";
    else if (career.pts >= 60 || ppg >= 8.0) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededPts = Math.max(1, 60 - career.pts);
      const neededPpg = Math.max(0.1, 8.0 - ppg);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededPts} more pts (${career.pts}/60) or +${neededPpg.toFixed(1)} PPG (${ppg.toFixed(1)}/8.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.pts / 60, ppg / 8.0) * 100)),
      };
    } else if (tier === "silver") {
      const neededPts = Math.max(1, 120 - career.pts);
      const neededPpg = Math.max(0.1, 10.0 - ppg);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededPts} more pts (${career.pts}/120) or +${neededPpg.toFixed(1)} PPG (${ppg.toFixed(1)}/10.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.pts / 120, ppg / 10.0) * 100)),
      };
    } else if (tier === "gold") {
      const neededPts = Math.max(1, 250 - career.pts);
      const neededPpg = Math.max(0.1, 13.0 - ppg);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededPts} more pts (${career.pts}/250) or +${neededPpg.toFixed(1)} PPG (${ppg.toFixed(1)}/13.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.pts / 250, ppg / 13.0) * 100)),
      };
    }

    badges.push({
      id: "bucket",
      name: "Walking Bucket",
      emoji: "🪣",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Scores in bunches and commands defensive attention at all times.",
      progress: `${ppg.toFixed(1)} PPG (${career.pts} total pts)`,
      nextTier,
    });
  }

  // 3. Paint Beast / Glass Titan
  if (career.reb >= 15 || rpg >= 3.5) {
    let tier: BadgeTier = "bronze";
    if (career.reb >= 150 || rpg >= 9.0) tier = "hof";
    else if (career.reb >= 80 || rpg >= 7.0) tier = "gold";
    else if (career.reb >= 40 || rpg >= 5.0) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededReb = Math.max(1, 40 - career.reb);
      const neededRpg = Math.max(0.1, 5.0 - rpg);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededReb} more reb (${career.reb}/40) or +${neededRpg.toFixed(1)} RPG (${rpg.toFixed(1)}/5.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.reb / 40, rpg / 5.0) * 100)),
      };
    } else if (tier === "silver") {
      const neededReb = Math.max(1, 80 - career.reb);
      const neededRpg = Math.max(0.1, 7.0 - rpg);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededReb} more reb (${career.reb}/80) or +${neededRpg.toFixed(1)} RPG (${rpg.toFixed(1)}/7.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.reb / 80, rpg / 7.0) * 100)),
      };
    } else if (tier === "gold") {
      const neededReb = Math.max(1, 150 - career.reb);
      const neededRpg = Math.max(0.1, 9.0 - rpg);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededReb} more reb (${career.reb}/150) or +${neededRpg.toFixed(1)} RPG (${rpg.toFixed(1)}/9.0)`,
        progressPct: Math.min(99, Math.round(Math.max(career.reb / 150, rpg / 9.0) * 100)),
      };
    }

    badges.push({
      id: "paint-beast",
      name: "Glass Titan",
      emoji: "🦏",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Relentless on the boards, grabbing put-backs and securing possessions.",
      progress: `${rpg.toFixed(1)} RPG (${career.reb} reb, ${career.oreb} offensive)`,
      nextTier,
    });
  }

  // 4. Floor General
  if (career.ast >= 8 || apg >= 1.5) {
    let tier: BadgeTier = "bronze";
    if (career.ast >= 70 || (apg >= 5.0 && astTov >= 2.0)) tier = "hof";
    else if (career.ast >= 35 || (apg >= 3.5 && astTov >= 1.5)) tier = "gold";
    else if (career.ast >= 18 || apg >= 2.5) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededAst = Math.max(1, 18 - career.ast);
      const neededApg = Math.max(0.1, 2.5 - apg);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededAst} more ast (${career.ast}/18) or +${neededApg.toFixed(1)} APG (${apg.toFixed(1)}/2.5)`,
        progressPct: Math.min(99, Math.round(Math.max(career.ast / 18, apg / 2.5) * 100)),
      };
    } else if (tier === "silver") {
      const neededAst = Math.max(1, 35 - career.ast);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededAst} more ast (${career.ast}/35) or 3.5+ APG & 1.5+ AST/TO`,
        progressPct: Math.min(99, Math.round(Math.max(career.ast / 35, apg / 3.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededAst = Math.max(1, 70 - career.ast);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededAst} more ast (${career.ast}/70) or 5.0+ APG & 2.0+ AST/TO`,
        progressPct: Math.min(99, Math.round(Math.max(career.ast / 70, apg / 5.0) * 100)),
      };
    }

    badges.push({
      id: "floor-general",
      name: "Floor General",
      emoji: "🪄",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Orchestrates the floor, finds open cutters, and delivers crisp passes.",
      progress: `${apg.toFixed(1)} APG (${career.ast} ast, ${astTov.toFixed(1)} AST/TO)`,
      nextTier,
    });
  }

  // 5. Lockdown Defender
  if (stocks >= 8 || spg + bpg >= 1.2) {
    let tier: BadgeTier = "bronze";
    if (stocks >= 80 || spg + bpg >= 3.5) tier = "hof";
    else if (stocks >= 40 || spg + bpg >= 2.5) tier = "gold";
    else if (stocks >= 20 || spg + bpg >= 1.8) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededStocks = Math.max(1, 20 - stocks);
      const neededRate = Math.max(0.1, 1.8 - (spg + bpg));
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededStocks} more stocks (${stocks}/20) or +${neededRate.toFixed(1)} stocks/game`,
        progressPct: Math.min(99, Math.round(Math.max(stocks / 20, (spg + bpg) / 1.8) * 100)),
      };
    } else if (tier === "silver") {
      const neededStocks = Math.max(1, 40 - stocks);
      const neededRate = Math.max(0.1, 2.5 - (spg + bpg));
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededStocks} more stocks (${stocks}/40) or +${neededRate.toFixed(1)} stocks/game`,
        progressPct: Math.min(99, Math.round(Math.max(stocks / 40, (spg + bpg) / 2.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededStocks = Math.max(1, 80 - stocks);
      const neededRate = Math.max(0.1, 3.5 - (spg + bpg));
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededStocks} more stocks (${stocks}/80) or +${neededRate.toFixed(1)} stocks/game`,
        progressPct: Math.min(99, Math.round(Math.max(stocks / 80, (spg + bpg) / 3.5) * 100)),
      };
    }

    badges.push({
      id: "lockdown",
      name: "Lockdown",
      emoji: "🔒",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Stifles opposing ball handlers with steals, swats, and deflections.",
      progress: `${spg.toFixed(1)} SPG · ${bpg.toFixed(1)} BPG · ${career.defl} deflections`,
      nextTier,
    });
  }

  // 6. Clutch Gene
  if (gw >= 1 || clutchPts >= 5) {
    let tier: BadgeTier = "bronze";
    if (gw >= 4 || clutchPts >= 30) tier = "hof";
    else if (gw >= 2 || clutchPts >= 18) tier = "gold";
    else if (gw >= 1 && clutchPts >= 10) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const ptsNeed = Math.max(1, 10 - clutchPts);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${gw < 1 ? "1 game-winner & " : ""}${ptsNeed} more clutch pts (${clutchPts}/10)`,
        progressPct: Math.min(99, Math.round((Math.min(gw / 1, 1) * 0.5 + Math.min(clutchPts / 10, 1) * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const ptsNeed = Math.max(1, 18 - clutchPts);
      const gwNeed = Math.max(1, 2 - gw);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${gwNeed} more game-winners (${gw}/2) or ${ptsNeed} clutch pts (${clutchPts}/18)`,
        progressPct: Math.min(99, Math.round(Math.max(gw / 2, clutchPts / 18) * 100)),
      };
    } else if (tier === "gold") {
      const ptsNeed = Math.max(1, 30 - clutchPts);
      const gwNeed = Math.max(1, 4 - gw);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${gwNeed} more game-winners (${gw}/4) or ${ptsNeed} clutch pts (${clutchPts}/30)`,
        progressPct: Math.min(99, Math.round(Math.max(gw / 4, clutchPts / 30) * 100)),
      };
    }

    badges.push({
      id: "clutch-gene",
      name: "Clutch Gene",
      emoji: "🧊",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Unfazed by game pressure; delivers game-winners and late-game stops.",
      progress: `${gw} game-winner${gw === 1 ? "" : "s"} · ${clutchPts} clutch pts`,
      nextTier,
    });
  }

  // 7. Sparkplug / Energizer
  if (career.gp >= 2 && (pmPg >= 1.0 || deflPg >= 1.5)) {
    let tier: BadgeTier = "bronze";
    if (pmPg >= 4.0 && deflPg >= 2.5) tier = "hof";
    else if (pmPg >= 2.5 && deflPg >= 2.0) tier = "gold";
    else if (pmPg >= 1.5 || deflPg >= 1.8) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const pmNeed = Math.max(0.1, 1.5 - pmPg);
      const deflNeed = Math.max(0.1, 1.8 - deflPg);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `+${pmNeed.toFixed(1)} +/- per game or +${deflNeed.toFixed(1)} defl/gm`,
        progressPct: Math.min(99, Math.round(Math.max((pmPg + 1) / 2.5, deflPg / 1.8) * 100)),
      };
    } else if (tier === "silver") {
      const pmNeed = Math.max(0.1, 2.5 - pmPg);
      const deflNeed = Math.max(0.1, 2.0 - deflPg);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `+${pmNeed.toFixed(1)} +/- per game and +${deflNeed.toFixed(1)} defl/gm`,
        progressPct: Math.min(99, Math.round(((Math.min(Math.max(pmPg, 0) / 2.5, 1) + Math.min(deflPg / 2.0, 1)) / 2) * 100)),
      };
    } else if (tier === "gold") {
      const pmNeed = Math.max(0.1, 4.0 - pmPg);
      const deflNeed = Math.max(0.1, 2.5 - deflPg);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `+${pmNeed.toFixed(1)} +/- per game and +${deflNeed.toFixed(1)} defl/gm`,
        progressPct: Math.min(99, Math.round(((Math.min(Math.max(pmPg, 0) / 4.0, 1) + Math.min(deflPg / 2.5, 1)) / 2) * 100)),
      };
    }

    badges.push({
      id: "sparkplug",
      name: "Sparkplug",
      emoji: "⚡",
      tier,
      tierLabel: TIER_LABELS[tier],
      description: "Injects instant hustle, momentum swings, and high positive point differentials.",
      progress: `${pmPg >= 0 ? "+" : ""}${pmPg.toFixed(1)} plus/minus per game`,
      nextTier,
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
      let nextTier: BadgeNextTier | null = null;
      if (tier === "bronze") {
        nextTier = {
          tier: "silver",
          tierLabel: "Silver",
          requirement: `≥65% attendance (Currently ${Math.round(attendancePct * 100)}%)`,
          progressPct: Math.min(99, Math.round((attendancePct / 0.65) * 100)),
        };
      } else if (tier === "silver") {
        nextTier = {
          tier: "gold",
          tierLabel: "Gold",
          requirement: `≥80% attendance (Currently ${Math.round(attendancePct * 100)}%)`,
          progressPct: Math.min(99, Math.round((attendancePct / 0.8) * 100)),
        };
      } else if (tier === "gold") {
        nextTier = {
          tier: "hof",
          tierLabel: "Hall of Fame",
          requirement: `≥90% attendance (Currently ${Math.round(attendancePct * 100)}%)`,
          progressPct: Math.min(99, Math.round((attendancePct / 0.9) * 100)),
        };
      }

      badges.push({
        id: "iron-man",
        name: "Iron Man",
        emoji: "👑",
        tier,
        tierLabel: TIER_LABELS[tier],
        description: "Always answers the bell; unmatched attendance and league consistency.",
        progress: `${Math.round(attendancePct * 100)}% attendance (${career.gp}/${totalGames} games)`,
        nextTier,
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

  // The 3 Core Pillars of Court Dominance (Full Mastery = Silver+):
  const hasShootPillar = hasSilverSharpshooter || ppg >= 9.0 || hasGoldBucket;
  const hasAssistPillar = hasSilverFloorGeneral;
  const hasDefensePillar = hasSilverLockdown;
  const hasPaintPillar = hasSilverPaintBeast || rpg >= 5.0;

  // Secondary Skills (Developing at Bronze+ / Per-game threshold):
  const hasSecondaryAssist =
    hasBadge("floor-general", "bronze") || career.ast >= 8 || apg >= 1.5;
  const hasSecondaryDefense =
    hasBadge("lockdown", "bronze") || stocks >= 8 || spg + bpg >= 1.0;
  const hasSecondaryShoot =
    hasBadge("sharpshooter", "bronze") || career.fg3m >= 3 || ppg >= 6.5;

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
  // TIER 4: THE ALL-AROUND THREAT (Combines ALL 3 Pillars: Shoot + Assist + Defense)
  // Evaluated 1st: The absolute best player on the court
  // -------------------------------------------------------------
  else if (career.gp >= 3 && hasShootPillar && hasAssistPillar && hasDefensePillar) {
    archetypeTitle = "The All-Around Threat";
    archetypeEmoji = "🌟";
    archetypeDesc =
      "The undisputed master on the court. Complete statistical dominance across all three core pillars: elite scoring/shooting, playmaking, and lockdown defense.";
    archetypeTier = 4;
  }
  // -------------------------------------------------------------
  // TIER 3: PINNACLE DUAL-PILLARS (Combines 2 of the 3 Pillars at Silver+)
  // Evaluated 2nd
  // -------------------------------------------------------------
  // 1. Shoot + Assist (both Silver+)
  else if (hasShootPillar && hasAssistPillar) {
    archetypeTitle = "Playmaking Shot Creator";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Deadly perimeter scoring threat who also slices defenses open with elite playmaking and floor vision.";
    archetypeTier = 3;
  }
  // 2. Shoot + Defense (both Silver+)
  else if (hasShootPillar && hasDefensePillar) {
    archetypeTitle = "3-and-D Specialist";
    archetypeEmoji = "🎯";
    archetypeDesc =
      "Spreads the floor with elite perimeter shooting while locking down opposing ball-handlers on defense.";
    archetypeTier = 3;
  }
  // 3. Assist + Defense (both Silver+)
  else if (hasAssistPillar && hasDefensePillar) {
    archetypeTitle = "Two-Way Floor General";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Commands the offense with crisp distribution while anchoring the perimeter with tenacious lockdown defense.";
    archetypeTier = 3;
  }
  // -------------------------------------------------------------
  // TIER 2: HYBRID ROLES (1 Primary Pillar at Silver+ AND Secondary Skill at Bronze+)
  // Evaluated 3rd: The bridge between specialist and dual-pillar master
  // -------------------------------------------------------------
  // If Shooter has both secondary assist & defense, pick the higher progress
  else if (hasShootPillar && hasSecondaryAssist && hasSecondaryDefense) {
    const astRate = Math.max(career.ast / 18, apg / 2.5);
    const defRate = Math.max(stocks / 20, (spg + bpg) / 1.8);
    if (astRate >= defRate) {
      archetypeTitle = "Combo Guard";
      archetypeEmoji = "🪄";
      archetypeDesc =
        "Dynamic perimeter threat who scores from outside while creating scoring opportunities for teammates.";
      archetypeTier = 2;
    } else {
      archetypeTitle = "Two-Way Shooter";
      archetypeEmoji = "🎯";
      archetypeDesc =
        "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.";
      archetypeTier = 2;
    }
  } else if (hasShootPillar && hasSecondaryAssist) {
    archetypeTitle = "Combo Guard";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Dynamic perimeter threat who scores from outside while creating scoring opportunities for teammates.";
    archetypeTier = 2;
  } else if (hasShootPillar && hasSecondaryDefense) {
    archetypeTitle = "Two-Way Shooter";
    archetypeEmoji = "🎯";
    archetypeDesc =
      "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.";
    archetypeTier = 2;
  }
  // Primary Assist with secondary skills:
  else if (hasAssistPillar && hasSecondaryShoot && hasSecondaryDefense) {
    const shootRate = Math.max(career.fg3m / 8, ppg / 9.0);
    const defRate = Math.max(stocks / 20, (spg + bpg) / 1.8);
    if (shootRate >= defRate) {
      archetypeTitle = "Combo Guard";
      archetypeEmoji = "🪄";
      archetypeDesc =
        "Floor general who commands the pace while keeping defenses honest with scoring threat.";
      archetypeTier = 2;
    } else {
      archetypeTitle = "Two-Way Playmaker";
      archetypeEmoji = "🛡️";
      archetypeDesc =
        "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.";
      archetypeTier = 2;
    }
  } else if (hasAssistPillar && hasSecondaryShoot) {
    archetypeTitle = "Combo Guard";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Floor general who commands the pace while keeping defenses honest with scoring threat.";
    archetypeTier = 2;
  } else if (hasAssistPillar && hasSecondaryDefense) {
    archetypeTitle = "Two-Way Playmaker";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.";
    archetypeTier = 2;
  }
  // Primary Defense with secondary skills:
  else if (hasDefensePillar && hasSecondaryShoot && hasSecondaryAssist) {
    const shootRate = Math.max(career.fg3m / 8, ppg / 6.5);
    const astRate = Math.max(career.ast / 18, apg / 2.5);
    if (astRate >= shootRate) {
      archetypeTitle = "Two-Way Playmaker";
      archetypeEmoji = "🛡️";
      archetypeDesc =
        "Defensive stopper who facilitates offense and creates transition opportunities.";
      archetypeTier = 2;
    } else {
      archetypeTitle = "Two-Way Slasher";
      archetypeEmoji = "⚔️";
      archetypeDesc =
        "Disruptive lockdown defender who pushes the pace and scores in transition.";
      archetypeTier = 2;
    }
  } else if (hasDefensePillar && hasSecondaryShoot) {
    archetypeTitle = "Two-Way Slasher";
    archetypeEmoji = "⚔️";
    archetypeDesc =
      "Disruptive lockdown defender who pushes the pace and scores in transition.";
    archetypeTier = 2;
  } else if (hasDefensePillar && hasSecondaryAssist) {
    archetypeTitle = "Two-Way Playmaker";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Defensive stopper who facilitates offense and creates transition opportunities.";
    archetypeTier = 2;
  } else if (
    (hasSilverPaintBeast && (hasBadge("lockdown", "bronze") || stocks >= 8 || spg + bpg >= 1.0)) ||
    (hasDefensePillar && (hasBadge("paint-beast", "bronze") || rpg >= 3.5))
  ) {
    archetypeTitle = "Defensive Anchor";
    archetypeEmoji = "🏰";
    archetypeDesc = "Controls the paint, dominates the glass, and protects the rim.";
    archetypeTier = 2;
  } else if (ppg >= 9.0 && rpg >= 5.0) {
    archetypeTitle = "Two-Way Force";
    archetypeEmoji = "👑";
    archetypeDesc = "Powerful scoring and rebounding presence on the interior.";
    archetypeTier = 2;
  }
  // -------------------------------------------------------------
  // TIER 1: SPECIALIZED DISCIPLINES (Single Discipline at Silver+)
  // Evaluated 4th
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
  // TIER 0: FOUNDATIONS
  // Evaluated Last
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

  // Compute next archetype evolution targets (strictly for currentTier + 1)
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
    hasShootPillar,
    hasAssistPillar,
    hasDefensePillar,
    hasPaintPillar,
    hasSecondaryAssist,
    hasSecondaryDefense,
    hasSecondaryShoot,
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
  hasShootPillar: boolean;
  hasAssistPillar: boolean;
  hasDefensePillar: boolean;
  hasPaintPillar: boolean;
  hasSecondaryAssist: boolean;
  hasSecondaryDefense: boolean;
  hasSecondaryShoot: boolean;
};

/**
 * Calculates the player's percentage progress and stat requirement deltas.
 * Strictly generates upgrades for the immediate next tier (currentTier + 1).
 */
function computeArchetypeUpgrades(ctx: UpgradeContext): ArchetypeUpgrade[] {
  // If player reached Tier 4 (The All-Around Threat), no higher tier exists
  if (ctx.currentTier === 4) return [];

  const candidates: ArchetypeUpgrade[] = [];
  const targetTier = (ctx.currentTier + 1) as ArchetypeTier;

  // Pillar completion metrics
  const shootProgress = ctx.hasShootPillar
    ? 1
    : Math.min(1, Math.max(ctx.career.fg3m / 8, ctx.ppg / 9.0));
  const assistProgress = ctx.hasAssistPillar
    ? 1
    : Math.min(1, Math.max(ctx.career.ast / 18, ctx.apg / 2.5));
  const defProgress = ctx.hasDefensePillar
    ? 1
    : Math.min(1, Math.max(ctx.stocks / 20, (ctx.spg + ctx.bpg) / 1.8));

  // -------------------------------------------------------------
  // TARGET TIER 4: The All-Around Threat (Only shown to Tier 3 players)
  // -------------------------------------------------------------
  if (targetTier === 4) {
    const allAroundPct = Math.min(
      99,
      Math.round(((shootProgress + assistProgress + defProgress) / 3) * 100),
    );

    let allAroundReq = "";
    if (!ctx.hasDefensePillar) {
      allAroundReq = `Final Pillar (Defense): Needs ${Math.max(1, 20 - ctx.stocks)} more stocks (${ctx.stocks}/20) for Silver Lockdown`;
    } else if (!ctx.hasAssistPillar) {
      allAroundReq = `Final Pillar (Assist): Needs ${Math.max(1, 18 - ctx.career.ast)} more ast (${ctx.career.ast}/18) for Silver Floor General`;
    } else if (!ctx.hasShootPillar) {
      allAroundReq = `Final Pillar (Shoot): Needs ${Math.max(1, 8 - ctx.career.fg3m)} more 3PM (${ctx.career.fg3m}/8) or +${Math.max(0.1, 9.0 - ctx.ppg).toFixed(1)} PPG`;
    }

    candidates.push({
      title: "The All-Around Threat",
      emoji: "🌟",
      tier: 4,
      tierLabel: ARCHETYPE_TIER_META[4].label,
      progressPct: allAroundPct,
      requirement: allAroundReq,
      description:
        "The undisputed master on the court. Complete statistical dominance across all three core pillars: elite scoring/shooting, playmaking, and lockdown defense.",
    });
  }

  // -------------------------------------------------------------
  // TARGET TIER 3: The 3 Dual-Pillars (Only shown to Tier 2 players)
  // -------------------------------------------------------------
  if (targetTier === 3) {
    // 1. Playmaking Shot Creator (Shoot + Assist)
    if (ctx.currentTitle !== "Playmaking Shot Creator") {
      const pct = Math.min(
        99,
        Math.round(((shootProgress + assistProgress) / 2) * 100),
      );
      const req = ctx.hasShootPillar
        ? `Needs Assist pillar: ${Math.max(1, 18 - ctx.career.ast)} more ast (${ctx.career.ast}/18) for Silver Floor General`
        : ctx.hasAssistPillar
          ? `Needs Shoot pillar: ${Math.max(1, 8 - ctx.career.fg3m)} more 3PM (${ctx.career.fg3m}/8) or +${Math.max(0.1, 9.0 - ctx.ppg).toFixed(1)} PPG`
          : `Needs Shoot + Assist pillars`;

      candidates.push({
        title: "Playmaking Shot Creator",
        emoji: "🪄",
        tier: 3,
        tierLabel: ARCHETYPE_TIER_META[3].label,
        progressPct: pct,
        requirement: req,
        description:
          "Deadly perimeter scoring threat who also slices defenses open with elite playmaking and floor vision.",
      });
    }

    // 2. 3-and-D Specialist (Shoot + Defense)
    if (ctx.currentTitle !== "3-and-D Specialist") {
      const pct = Math.min(
        99,
        Math.round(((shootProgress + defProgress) / 2) * 100),
      );
      const req = ctx.hasShootPillar
        ? `Needs Defense pillar: ${Math.max(1, 20 - ctx.stocks)} more stocks (${ctx.stocks}/20) for Silver Lockdown`
        : ctx.hasDefensePillar
          ? `Needs Shoot pillar: ${Math.max(1, 8 - ctx.career.fg3m)} more 3PM (${ctx.career.fg3m}/8) or +${Math.max(0.1, 9.0 - ctx.ppg).toFixed(1)} PPG`
          : `Needs Shoot + Defense pillars`;

      candidates.push({
        title: "3-and-D Specialist",
        emoji: "🎯",
        tier: 3,
        tierLabel: ARCHETYPE_TIER_META[3].label,
        progressPct: pct,
        requirement: req,
        description:
          "Spreads the floor with elite perimeter shooting while locking down opposing ball-handlers on defense.",
      });
    }

    // 3. Two-Way Floor General (Assist + Defense)
    if (ctx.currentTitle !== "Two-Way Floor General") {
      const pct = Math.min(
        99,
        Math.round(((assistProgress + defProgress) / 2) * 100),
      );
      const req = ctx.hasAssistPillar
        ? `Needs Defense pillar: ${Math.max(1, 20 - ctx.stocks)} more stocks (${ctx.stocks}/20) for Silver Lockdown`
        : ctx.hasDefensePillar
          ? `Needs Assist pillar: ${Math.max(1, 18 - ctx.career.ast)} more ast (${ctx.career.ast}/18) for Silver Floor General`
          : `Needs Assist + Defense pillars`;

      candidates.push({
        title: "Two-Way Floor General",
        emoji: "🛡️",
        tier: 3,
        tierLabel: ARCHETYPE_TIER_META[3].label,
        progressPct: pct,
        requirement: req,
        description:
          "Commands the offense with crisp distribution while anchoring the perimeter with tenacious lockdown defense.",
      });
    }
  }

  // -------------------------------------------------------------
  // TARGET TIER 2: Hybrids (Only shown to Tier 1 players)
  // -------------------------------------------------------------
  if (targetTier === 2) {
    const secAstProg = Math.min(1, Math.max(ctx.career.ast / 8, ctx.apg / 1.5));
    const secDefProg = Math.min(1, Math.max(ctx.stocks / 8, (ctx.spg + ctx.bpg) / 1.0));
    const secShootProg = Math.min(1, Math.max(ctx.career.fg3m / 3, ctx.ppg / 6.5));

    if (ctx.hasShootPillar) {
      // 1. Combo Guard (Shoot + Secondary Assist)
      const comboPct = Math.min(
        99,
        Math.round(((shootProgress + secAstProg) / 2) * 100),
      );
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: comboPct,
        requirement: `Develop secondary playmaking: ${Math.max(1, 8 - ctx.career.ast)} more ast (${ctx.career.ast}/8) or +${Math.max(0.1, 1.5 - ctx.apg).toFixed(1)} APG`,
        description:
          "Dynamic backcourt threat who balances scoring instincts with playmaking for teammates.",
      });

      // 2. Two-Way Shooter (Shoot + Secondary Defense)
      const twoWayShootPct = Math.min(
        99,
        Math.round(((shootProgress + secDefProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Shooter",
        emoji: "🎯",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayShootPct,
        requirement: `Develop secondary defense: ${Math.max(1, 8 - ctx.stocks)} more stocks (${ctx.stocks}/8) or +${Math.max(0.1, 1.0 - (ctx.spg + ctx.bpg)).toFixed(1)} stocks/gm`,
        description:
          "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.",
      });
    } else if (ctx.hasAssistPillar) {
      // 1. Combo Guard (Assist + Secondary Scoring)
      const comboPct = Math.min(
        99,
        Math.round(((assistProgress + secShootProg) / 2) * 100),
      );
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: comboPct,
        requirement: `Develop secondary scoring: ${Math.max(1, 3 - ctx.career.fg3m)} more 3PM (${ctx.career.fg3m}/3) or +${Math.max(0.1, 6.5 - ctx.ppg).toFixed(1)} PPG`,
        description:
          "Floor general who commands the pace while keeping defenses honest with scoring threat.",
      });

      // 2. Two-Way Playmaker (Assist + Secondary Defense)
      const twoWayPlayPct = Math.min(
        99,
        Math.round(((assistProgress + secDefProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Playmaker",
        emoji: "🛡️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayPlayPct,
        requirement: `Develop secondary defense: ${Math.max(1, 8 - ctx.stocks)} more stocks (${ctx.stocks}/8) or +${Math.max(0.1, 1.0 - (ctx.spg + ctx.bpg)).toFixed(1)} stocks/gm`,
        description:
          "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.",
      });
    } else if (ctx.hasDefensePillar) {
      // 1. Two-Way Shooter / Slasher (Defense + Secondary Scoring)
      const twoWayShootPct = Math.min(
        99,
        Math.round(((defProgress + secShootProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Slasher",
        emoji: "⚔️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayShootPct,
        requirement: `Develop secondary scoring: +${Math.max(0.1, 6.5 - ctx.ppg).toFixed(1)} PPG (${ctx.ppg.toFixed(1)}/6.5 PPG)`,
        description:
          "Disruptive lockdown defender who pushes the pace and scores in transition.",
      });

      // 2. Two-Way Playmaker (Defense + Secondary Assist)
      const twoWayPlayPct = Math.min(
        99,
        Math.round(((defProgress + secAstProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Playmaker",
        emoji: "🛡️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayPlayPct,
        requirement: `Develop secondary playmaking: ${Math.max(1, 8 - ctx.career.ast)} more ast (${ctx.career.ast}/8) or +${Math.max(0.1, 1.5 - ctx.apg).toFixed(1)} APG`,
        description:
          "Defensive stopper who facilitates offense and creates transition opportunities.",
      });

      // 3. Defensive Anchor (Defense + Secondary Rebounding)
      const secRebProg = Math.min(1, Math.max(ctx.career.reb / 15, ctx.rpg / 3.5));
      const anchorPct = Math.min(
        99,
        Math.round(((defProgress + secRebProg) / 2) * 100),
      );
      candidates.push({
        title: "Defensive Anchor",
        emoji: "🏰",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: anchorPct,
        requirement: `Develop interior presence: ${Math.max(1, 15 - ctx.career.reb)} more reb (${ctx.career.reb}/15) or +${Math.max(0.1, 3.5 - ctx.rpg).toFixed(1)} RPG`,
        description: "Controls the paint, dominates the glass, and protects the rim.",
      });
    } else if (ctx.hasPaintPillar) {
      // Interior Specialist
      const rebProg = ctx.hasSilverPaintBeast
        ? 1
        : Math.min(1, Math.max(ctx.career.reb / 40, ctx.rpg / 5.0));
      candidates.push({
        title: "Defensive Anchor",
        emoji: "🏰",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((rebProg + secDefProg) / 2) * 100)),
        requirement: `Develop secondary defense: ${Math.max(1, 8 - ctx.stocks)} more stocks (${ctx.stocks}/8)`,
        description: "Controls the paint, dominates the glass, and protects the rim.",
      });
      candidates.push({
        title: "Two-Way Force",
        emoji: "👑",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((rebProg + Math.min(1, ctx.ppg / 9.0)) / 2) * 100)),
        requirement: `Needs +${Math.max(0.1, 9.0 - ctx.ppg).toFixed(1)} PPG to reach 9.0 PPG`,
        description: "Powerful scoring and rebounding presence on the interior.",
      });
    } else {
      // Clutch Assassin, Hustle Engine, etc.
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((shootProgress + secAstProg) / 2) * 100)),
        requirement: `Develop secondary playmaking: ${Math.max(1, 8 - ctx.career.ast)} more ast (${ctx.career.ast}/8)`,
        description:
          "Dynamic backcourt threat who balances scoring instincts with playmaking for teammates.",
      });
      candidates.push({
        title: "Two-Way Shooter",
        emoji: "🎯",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((shootProgress + secDefProg) / 2) * 100)),
        requirement: `Develop secondary defense: ${Math.max(1, 8 - ctx.stocks)} more stocks (${ctx.stocks}/8)`,
        description:
          "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.",
      });
    }
  }

  // -------------------------------------------------------------
  // TARGET TIER 1: Single-Discipline Specialists (Only shown to Tier 0 players)
  // -------------------------------------------------------------
  if (targetTier === 1) {
    // Pure Scorer
    const scorerPct = Math.min(99, Math.round((ctx.ppg / 9.0) * 100));
    candidates.push({
      title: "Pure Scorer",
      emoji: "🔥",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: scorerPct,
      requirement:
        ctx.ppg < 9.0
          ? `Needs +${(9.0 - ctx.ppg).toFixed(1)} PPG (${ctx.ppg.toFixed(1)} / 9.0 PPG)`
          : "Score 120 total points",
      description: "Natural scoring instinct capable of heating up in a flash.",
    });

    // Sharpshooter
    const countPct = Math.min(1, ctx.career.fg3m / 8);
    const accuracyPct = Math.min(1, ctx.fg3Pct / 0.28);
    const sharpPct = Math.min(99, Math.round((countPct * 0.7 + accuracyPct * 0.3) * 100));
    candidates.push({
      title: "Sharpshooter",
      emoji: "🎯",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: sharpPct,
      requirement:
        ctx.career.fg3m < 8
          ? `Needs ${8 - ctx.career.fg3m} more 3PM (${ctx.career.fg3m}/8) and ≥28% 3PT`
          : `Needs ≥28% 3PT (${Math.round(ctx.fg3Pct * 100)}% curr)`,
      description: "Lethal shooting threat from anywhere behind the arc.",
    });

    // Floor General
    const astPct = Math.min(
      99,
      Math.round(Math.max(ctx.career.ast / 18, ctx.apg / 2.5) * 100),
    );
    candidates.push({
      title: "Floor General",
      emoji: "🪄",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: astPct,
      requirement: `Needs ${Math.max(1, 18 - ctx.career.ast)} more ast or +${Math.max(0.1, 2.5 - ctx.apg).toFixed(1)} APG (${ctx.apg.toFixed(1)} APG)`,
      description: "Pure playmaker who elevates everyone around them.",
    });

    // Paint Beast
    const rebPct = Math.min(
      99,
      Math.round(Math.max(ctx.career.reb / 40, ctx.rpg / 5.0) * 100),
    );
    candidates.push({
      title: "Paint Beast",
      emoji: "🦏",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: rebPct,
      requirement: `Needs ${Math.max(1, 40 - ctx.career.reb)} more reb or +${Math.max(0.1, 5.0 - ctx.rpg).toFixed(1)} RPG (${ctx.rpg.toFixed(1)} RPG)`,
      description: "Physical force on the interior who owns the boards and finishes through contact.",
    });

    // Lockdown Specialist
    const lockPct = Math.min(
      99,
      Math.round(Math.max(ctx.stocks / 20, (ctx.spg + ctx.bpg) / 1.8) * 100),
    );
    candidates.push({
      title: "Lockdown Specialist",
      emoji: "🔒",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: lockPct,
      requirement: `Needs ${Math.max(1, 20 - ctx.stocks)} more defensive stocks (${ctx.stocks}/20)`,
      description: "Defensive stopper who takes on the opponent's toughest matchup.",
    });
  }

  // Filter candidates: strictly match targetTier and progressPct < 100
  return candidates
    .filter((c) => c.tier === targetTier && c.title !== ctx.currentTitle && c.progressPct < 100)
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 3);
}

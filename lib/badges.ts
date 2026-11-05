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
 * Calibrated for a 1-year season (3-6 games weekly, ~150-250 games total)
 * playing games to 20 points.
 *
 * PROGRESSION TIMELINE:
 * - Months 1-2 (Games 1-25): Bronze badges & establishing Tier 1 Specialist / Tier 2 Hybrid identity.
 * - Months 3-4 (Games 25-50): Silver badges & solidified Tier 2 Hybrids.
 * - Months 5-8 (Games 50-100): Gold badges & Tier 3 Pinnacle Dual-Pillar status.
 * - Months 9-12 (Games 100-200+): Hall of Fame badges & Tier 4 All-Around Threat apex.
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
  const stockPg = stocks / gp;

  const badges: Badge[] = [];

  // -------------------------------------------------------------
  // 1. Deadeye (3PT Shooting)
  // 1-Year Season targets: Bronze (5 3PM), Silver (22 3PM), Gold (60 3PM), HOF (130 3PM)
  // -------------------------------------------------------------
  if (career.fg3m >= 5) {
    let tier: BadgeTier = "bronze";
    if (career.fg3m >= 130 && fg3Pct >= 0.34 && gp >= 70) tier = "hof";
    else if (career.fg3m >= 60 && fg3Pct >= 0.32 && gp >= 35) tier = "gold";
    else if (career.fg3m >= 22 && fg3Pct >= 0.28 && gp >= 12) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededThrees = Math.max(1, 22 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.28);
      const countPct = Math.min(1, career.fg3m / 22);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/22) & ≥28% 3PT (${Math.round(fg3Pct * 100)}% curr, min 12 GP)`,
        progressPct: Math.min(99, Math.round((countPct * 0.65 + accPct * 0.35) * 100)),
      };
    } else if (tier === "silver") {
      const neededThrees = Math.max(1, 60 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.32);
      const countPct = Math.min(1, career.fg3m / 60);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/60) & ≥32% 3PT (${Math.round(fg3Pct * 100)}% curr, min 35 GP)`,
        progressPct: Math.min(99, Math.round((countPct * 0.65 + accPct * 0.35) * 100)),
      };
    } else if (tier === "gold") {
      const neededThrees = Math.max(1, 130 - career.fg3m);
      const accPct = Math.min(1, fg3Pct / 0.34);
      const countPct = Math.min(1, career.fg3m / 130);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${neededThrees} more 3PM (${career.fg3m}/130) & ≥34% 3PT (${Math.round(fg3Pct * 100)}% curr, min 70 GP)`,
        progressPct: Math.min(99, Math.round((countPct * 0.65 + accPct * 0.35) * 100)),
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

  // -------------------------------------------------------------
  // 2. Walking Bucket (Scoring in 20-point games)
  // 1-Year Season targets: Bronze (35 pts), Silver (160 pts), Gold (420 pts), HOF (850 pts)
  // -------------------------------------------------------------
  if (career.pts >= 35 || (gp >= 4 && ppg >= 4.5)) {
    let tier: BadgeTier = "bronze";
    if (career.pts >= 850 && ppg >= 8.0 && gp >= 70) tier = "hof";
    else if (career.pts >= 420 && ppg >= 7.0 && gp >= 35) tier = "gold";
    else if (career.pts >= 160 && ppg >= 5.5 && gp >= 12) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededPts = Math.max(1, 160 - career.pts);
      const ptsPct = Math.min(1, career.pts / 160);
      const ppgPct = Math.min(1, ppg / 5.5);
      const reqParts: string[] = [];
      if (career.pts < 160) reqParts.push(`${neededPts} more pts (${career.pts}/160)`);
      if (ppg < 5.5) reqParts.push(`≥5.5 PPG (${ppg.toFixed(1)} curr)`);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: reqParts.join(" & ") + " (min 12 GP)",
        progressPct: Math.min(99, Math.round((ptsPct * 0.5 + ppgPct * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const neededPts = Math.max(1, 420 - career.pts);
      const ptsPct = Math.min(1, career.pts / 420);
      const ppgPct = Math.min(1, ppg / 7.0);
      const reqParts: string[] = [];
      if (career.pts < 420) reqParts.push(`${neededPts} more pts (${career.pts}/420)`);
      if (ppg < 7.0) reqParts.push(`≥7.0 PPG (${ppg.toFixed(1)} curr)`);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: reqParts.join(" & ") + " (min 35 GP)",
        progressPct: Math.min(99, Math.round((ptsPct * 0.5 + ppgPct * 0.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededPts = Math.max(1, 850 - career.pts);
      const ptsPct = Math.min(1, career.pts / 850);
      const ppgPct = Math.min(1, ppg / 8.0);
      const reqParts: string[] = [];
      if (career.pts < 850) reqParts.push(`${neededPts} more pts (${career.pts}/850)`);
      if (ppg < 8.0) reqParts.push(`≥8.0 PPG (${ppg.toFixed(1)} curr)`);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: reqParts.join(" & ") + " (min 70 GP)",
        progressPct: Math.min(99, Math.round((ptsPct * 0.5 + ppgPct * 0.5) * 100)),
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

  // -------------------------------------------------------------
  // 3. Paint Beast / Glass Titan (Rebounding in 20-point games)
  // 1-Year Season targets: Bronze (20 reb), Silver (100 reb), Gold (250 reb), HOF (480 reb)
  // -------------------------------------------------------------
  if (career.reb >= 20 || (gp >= 4 && rpg >= 2.5)) {
    let tier: BadgeTier = "bronze";
    if (career.reb >= 480 && rpg >= 5.2 && gp >= 70) tier = "hof";
    else if (career.reb >= 250 && rpg >= 4.4 && gp >= 35) tier = "gold";
    else if (career.reb >= 100 && rpg >= 3.4 && gp >= 12) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededReb = Math.max(1, 100 - career.reb);
      const rebPct = Math.min(1, career.reb / 100);
      const rpgPct = Math.min(1, rpg / 3.4);
      const reqParts: string[] = [];
      if (career.reb < 100) reqParts.push(`${neededReb} more reb (${career.reb}/100)`);
      if (rpg < 3.4) reqParts.push(`≥3.4 RPG (${rpg.toFixed(1)} curr)`);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: reqParts.join(" & ") + " (min 12 GP)",
        progressPct: Math.min(99, Math.round((rebPct * 0.5 + rpgPct * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const neededReb = Math.max(1, 250 - career.reb);
      const rebPct = Math.min(1, career.reb / 250);
      const rpgPct = Math.min(1, rpg / 4.4);
      const reqParts: string[] = [];
      if (career.reb < 250) reqParts.push(`${neededReb} more reb (${career.reb}/250)`);
      if (rpg < 4.4) reqParts.push(`≥4.4 RPG (${rpg.toFixed(1)} curr)`);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: reqParts.join(" & ") + " (min 35 GP)",
        progressPct: Math.min(99, Math.round((rebPct * 0.5 + rpgPct * 0.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededReb = Math.max(1, 480 - career.reb);
      const rebPct = Math.min(1, career.reb / 480);
      const rpgPct = Math.min(1, rpg / 5.2);
      const reqParts: string[] = [];
      if (career.reb < 480) reqParts.push(`${neededReb} more reb (${career.reb}/480)`);
      if (rpg < 5.2) reqParts.push(`≥5.2 RPG (${rpg.toFixed(1)} curr)`);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: reqParts.join(" & ") + " (min 70 GP)",
        progressPct: Math.min(99, Math.round((rebPct * 0.5 + rpgPct * 0.5) * 100)),
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

  // -------------------------------------------------------------
  // 4. Floor General (Playmaking in 20-point games)
  // 1-Year Season targets: Bronze (10 ast), Silver (40 ast), Gold (110 ast), HOF (220 ast)
  // -------------------------------------------------------------
  if (career.ast >= 10 || (gp >= 4 && apg >= 1.0)) {
    let tier: BadgeTier = "bronze";
    if (career.ast >= 220 && apg >= 2.2 && gp >= 70) tier = "hof";
    else if (career.ast >= 110 && apg >= 1.8 && gp >= 35) tier = "gold";
    else if (career.ast >= 40 && apg >= 1.4 && gp >= 12) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededAst = Math.max(1, 40 - career.ast);
      const astPct = Math.min(1, career.ast / 40);
      const apgPct = Math.min(1, apg / 1.4);
      const reqParts: string[] = [];
      if (career.ast < 40) reqParts.push(`${neededAst} more ast (${career.ast}/40)`);
      if (apg < 1.4) reqParts.push(`≥1.4 APG (${apg.toFixed(1)} curr)`);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: reqParts.join(" & ") + " (min 12 GP)",
        progressPct: Math.min(99, Math.round((astPct * 0.5 + apgPct * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const neededAst = Math.max(1, 110 - career.ast);
      const astPct = Math.min(1, career.ast / 110);
      const apgPct = Math.min(1, apg / 1.8);
      const reqParts: string[] = [];
      if (career.ast < 110) reqParts.push(`${neededAst} more ast (${career.ast}/110)`);
      if (apg < 1.8) reqParts.push(`≥1.8 APG (${apg.toFixed(1)} curr)`);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: reqParts.join(" & ") + " (min 35 GP)",
        progressPct: Math.min(99, Math.round((astPct * 0.5 + apgPct * 0.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededAst = Math.max(1, 220 - career.ast);
      const astPct = Math.min(1, career.ast / 220);
      const apgPct = Math.min(1, apg / 2.2);
      const reqParts: string[] = [];
      if (career.ast < 220) reqParts.push(`${neededAst} more ast (${career.ast}/220)`);
      if (apg < 2.2) reqParts.push(`≥2.2 APG (${apg.toFixed(1)} curr)`);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: reqParts.join(" & ") + " (min 70 GP)",
        progressPct: Math.min(99, Math.round((astPct * 0.5 + apgPct * 0.5) * 100)),
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

  // -------------------------------------------------------------
  // 5. Lockdown Defender (Defense: Steals + Blocks + Deflections)
  // 1-Year Season targets: Bronze (12 stocks), Silver (45 stocks), Gold (120 stocks), HOF (240 stocks)
  // -------------------------------------------------------------
  if (stocks >= 12 || (gp >= 4 && stockPg >= 1.0)) {
    let tier: BadgeTier = "bronze";
    if (stocks >= 240 && stockPg >= 2.1 && gp >= 70) tier = "hof";
    else if (stocks >= 120 && stockPg >= 1.7 && gp >= 35) tier = "gold";
    else if (stocks >= 45 && stockPg >= 1.3 && gp >= 12) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const neededStocks = Math.max(1, 45 - stocks);
      const stkPct = Math.min(1, stocks / 45);
      const ratePct = Math.min(1, stockPg / 1.3);
      const reqParts: string[] = [];
      if (stocks < 45) reqParts.push(`${neededStocks} more stocks (${stocks}/45)`);
      if (stockPg < 1.3) reqParts.push(`≥1.3 stocks/gm (${stockPg.toFixed(1)} curr)`);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: reqParts.join(" & ") + " (min 12 GP)",
        progressPct: Math.min(99, Math.round((stkPct * 0.5 + ratePct * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const neededStocks = Math.max(1, 120 - stocks);
      const stkPct = Math.min(1, stocks / 120);
      const ratePct = Math.min(1, stockPg / 1.7);
      const reqParts: string[] = [];
      if (stocks < 120) reqParts.push(`${neededStocks} more stocks (${stocks}/120)`);
      if (stockPg < 1.7) reqParts.push(`≥1.7 stocks/gm (${stockPg.toFixed(1)} curr)`);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: reqParts.join(" & ") + " (min 35 GP)",
        progressPct: Math.min(99, Math.round((stkPct * 0.5 + ratePct * 0.5) * 100)),
      };
    } else if (tier === "gold") {
      const neededStocks = Math.max(1, 240 - stocks);
      const stkPct = Math.min(1, stocks / 240);
      const ratePct = Math.min(1, stockPg / 2.1);
      const reqParts: string[] = [];
      if (stocks < 240) reqParts.push(`${neededStocks} more stocks (${stocks}/240)`);
      if (stockPg < 2.1) reqParts.push(`≥2.1 stocks/gm (${stockPg.toFixed(1)} curr)`);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: reqParts.join(" & ") + " (min 70 GP)",
        progressPct: Math.min(99, Math.round((stkPct * 0.5 + ratePct * 0.5) * 100)),
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

  // -------------------------------------------------------------
  // 6. Clutch Gene
  // 1-Year Season targets: Bronze (1 GW), Silver (3 GW & 15 clutch pts), Gold (7 GW & 35 pts), HOF (14 GW & 60 pts)
  // -------------------------------------------------------------
  if (gw >= 1 || clutchPts >= 5) {
    let tier: BadgeTier = "bronze";
    if (gw >= 14 && clutchPts >= 60) tier = "hof";
    else if (gw >= 7 && clutchPts >= 35) tier = "gold";
    else if (gw >= 3 && clutchPts >= 15) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const ptsNeed = Math.max(1, 15 - clutchPts);
      const gwNeed = Math.max(1, 3 - gw);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `${gwNeed} more game-winner (${gw}/3) & ${ptsNeed} clutch pts (${clutchPts}/15)`,
        progressPct: Math.min(99, Math.round((Math.min(gw / 3, 1) * 0.5 + Math.min(clutchPts / 15, 1) * 0.5) * 100)),
      };
    } else if (tier === "silver") {
      const ptsNeed = Math.max(1, 35 - clutchPts);
      const gwNeed = Math.max(1, 7 - gw);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `${gwNeed} more game-winners (${gw}/7) & ${ptsNeed} clutch pts (${clutchPts}/35)`,
        progressPct: Math.min(99, Math.round((Math.min(gw / 7, 1) * 0.5 + Math.min(clutchPts / 35, 1) * 0.5) * 100)),
      };
    } else if (tier === "gold") {
      const ptsNeed = Math.max(1, 60 - clutchPts);
      const gwNeed = Math.max(1, 14 - gw);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `${gwNeed} more game-winners (${gw}/14) & ${ptsNeed} clutch pts (${clutchPts}/60)`,
        progressPct: Math.min(99, Math.round((Math.min(gw / 14, 1) * 0.5 + Math.min(clutchPts / 60, 1) * 0.5) * 100)),
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

  // -------------------------------------------------------------
  // 7. Sparkplug / Energizer
  // -------------------------------------------------------------
  if (gp >= 4 && (pmPg >= 1.0 || deflPg >= 1.2)) {
    let tier: BadgeTier = "bronze";
    if (gp >= 70 && pmPg >= 3.2 && deflPg >= 1.8) tier = "hof";
    else if (gp >= 35 && pmPg >= 2.4 && deflPg >= 1.5) tier = "gold";
    else if (gp >= 12 && pmPg >= 1.6 && deflPg >= 1.2) tier = "silver";

    let nextTier: BadgeNextTier | null = null;
    if (tier === "bronze") {
      const pmNeed = Math.max(0.1, 1.6 - pmPg);
      const deflNeed = Math.max(0.1, 1.2 - deflPg);
      nextTier = {
        tier: "silver",
        tierLabel: "Silver",
        requirement: `+${pmNeed.toFixed(1)} +/- per game & +${deflNeed.toFixed(1)} defl/gm (min 12 GP)`,
        progressPct: Math.min(99, Math.round(((Math.min(Math.max(pmPg, 0) / 1.6, 1) + Math.min(deflPg / 1.2, 1)) / 2) * 100)),
      };
    } else if (tier === "silver") {
      const pmNeed = Math.max(0.1, 2.4 - pmPg);
      const deflNeed = Math.max(0.1, 1.5 - deflPg);
      nextTier = {
        tier: "gold",
        tierLabel: "Gold",
        requirement: `+${pmNeed.toFixed(1)} +/- per game & +${deflNeed.toFixed(1)} defl/gm (min 35 GP)`,
        progressPct: Math.min(99, Math.round(((Math.min(Math.max(pmPg, 0) / 2.4, 1) + Math.min(deflPg / 1.5, 1)) / 2) * 100)),
      };
    } else if (tier === "gold") {
      const pmNeed = Math.max(0.1, 3.2 - pmPg);
      const deflNeed = Math.max(0.1, 1.8 - deflPg);
      nextTier = {
        tier: "hof",
        tierLabel: "Hall of Fame",
        requirement: `+${pmNeed.toFixed(1)} +/- per game & +${deflNeed.toFixed(1)} defl/gm (min 70 GP)`,
        progressPct: Math.min(99, Math.round(((Math.min(Math.max(pmPg, 0) / 3.2, 1) + Math.min(deflPg / 1.8, 1)) / 2) * 100)),
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

  // -------------------------------------------------------------
  // 8. Iron Man (League Attendance)
  // -------------------------------------------------------------
  const totalGames = Math.max(career.gp, totalLeagueGames ?? 0);
  if (totalGames >= 6 && career.gp >= 4) {
    const attendancePct = career.gp / totalGames;
    let tier: BadgeTier | null = null;

    if (career.gp >= 70 && attendancePct >= 0.90) tier = "hof";
    else if (career.gp >= 35 && attendancePct >= 0.80) tier = "gold";
    else if (career.gp >= 12 && attendancePct >= 0.70) tier = "silver";
    else if (attendancePct >= 0.50) tier = "bronze";

    if (tier) {
      let nextTier: BadgeNextTier | null = null;
      if (tier === "bronze") {
        nextTier = {
          tier: "silver",
          tierLabel: "Silver",
          requirement: `≥70% attendance and min 12 GP (Currently ${Math.round(attendancePct * 100)}%, ${career.gp} GP)`,
          progressPct: Math.min(99, Math.round((attendancePct / 0.7) * 100)),
        };
      } else if (tier === "silver") {
        nextTier = {
          tier: "gold",
          tierLabel: "Gold",
          requirement: `≥80% attendance and min 35 GP (Currently ${Math.round(attendancePct * 100)}%, ${career.gp} GP)`,
          progressPct: Math.min(99, Math.round((attendancePct / 0.8) * 100)),
        };
      } else if (tier === "gold") {
        nextTier = {
          tier: "hof",
          tierLabel: "Hall of Fame",
          requirement: `≥90% attendance and min 70 GP (Currently ${Math.round(attendancePct * 100)}%, ${career.gp} GP)`,
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

  // -------------------------------------------------------------
  // PILLAR MASTERY DEFINITIONS (Shoot, Assist, Defense)
  // Accommodates early-season qualification (Games 1-25) and full-year thresholds
  // -------------------------------------------------------------
  // Shoot Pillar: Silver badge OR Early-season proven scoring (min 8 GP, 50 pts, >= 5.5 PPG or 8 3PM)
  const isEarlyShootProven = gp >= 8 && (ppg >= 5.5 || (career.fg3m >= 8 && fg3Pct >= 0.28));
  const hasSilverShoot = hasBadge("sharpshooter", "silver") || hasBadge("bucket", "silver") || isEarlyShootProven;
  const hasGoldShoot = hasBadge("sharpshooter", "gold") || hasBadge("bucket", "gold");
  const hasHofShoot = hasBadge("sharpshooter", "hof") || hasBadge("bucket", "hof");

  // Assist Pillar: Silver badge OR Early-season proven playmaking (min 8 GP, 14 ast, >= 1.4 APG)
  const isEarlyAssistProven = gp >= 8 && career.ast >= 14 && apg >= 1.4;
  const hasSilverAssist = hasBadge("floor-general", "silver") || isEarlyAssistProven;
  const hasGoldAssist = hasBadge("floor-general", "gold");
  const hasHofAssist = hasBadge("floor-general", "hof");

  // Defense Pillar: Silver badge OR Early-season proven defense (min 8 GP, 12 stocks, >= 1.3 stocks/gm)
  const isEarlyDefenseProven = gp >= 8 && stocks >= 12 && stockPg >= 1.3;
  const hasSilverDefense = hasBadge("lockdown", "silver") || isEarlyDefenseProven;
  const hasGoldDefense = hasBadge("lockdown", "gold");
  const hasHofDefense = hasBadge("lockdown", "hof");

  const hasSilverPaint = hasBadge("paint-beast", "silver") || (gp >= 8 && rpg >= 3.4);
  const hasGoldPaint = hasBadge("paint-beast", "gold");

  // Secondary Skills (Bronze level threshold)
  const hasSecondaryShoot = hasBadge("sharpshooter", "bronze") || hasBadge("bucket", "bronze") || career.fg3m >= 4 || ppg >= 4.0;
  const hasSecondaryAssist = hasBadge("floor-general", "bronze") || career.ast >= 8 || apg >= 1.0;
  const hasSecondaryDefense = hasBadge("lockdown", "bronze") || stocks >= 10 || stockPg >= 1.0;

  // Count Gold+ and Silver+ pillars
  let goldPillars = 0;
  if (hasGoldShoot) goldPillars++;
  if (hasGoldAssist) goldPillars++;
  if (hasGoldDefense) goldPillars++;

  const hasAllThreeSilvers = hasSilverShoot && hasSilverAssist && hasSilverDefense;
  const hasAnyHof = hasHofShoot || hasHofAssist || hasHofDefense;

  // -------------------------------------------------------------
  // ARCHETYPE SELECTION (Strict 4-Tier Ladder)
  // -------------------------------------------------------------
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
  // TIER 4: THE ALL-AROUND THREAT (Supreme Apex)
  // Requires: All 3 Pillars at Silver+ AND at least 2 Gold+ pillars (or 1 HOF + 2 Silvers)
  // -------------------------------------------------------------
  else if (career.gp >= 25 && hasAllThreeSilvers && (goldPillars >= 2 || hasAnyHof)) {
    archetypeTitle = "The All-Around Threat";
    archetypeEmoji = "🌟";
    archetypeDesc =
      "The undisputed master on the court. Complete statistical dominance across all three core pillars: elite scoring/shooting, playmaking, and lockdown defense.";
    archetypeTier = 4;
  }
  // -------------------------------------------------------------
  // TIER 3: PINNACLE DUAL-PILLARS
  // Requires: 1 Gold+ Pillar AND 1 Silver+ Pillar (Shoot, Assist, Defense)
  // -------------------------------------------------------------
  // 1. Shoot + Assist (1 Gold, 1 Silver)
  else if ((hasGoldShoot && hasSilverAssist) || (hasGoldAssist && hasSilverShoot)) {
    archetypeTitle = "Playmaking Shot Creator";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Deadly perimeter scoring threat who also slices defenses open with elite playmaking and floor vision.";
    archetypeTier = 3;
  }
  // 2. Shoot + Defense (1 Gold, 1 Silver)
  else if ((hasGoldShoot && hasSilverDefense) || (hasGoldDefense && hasSilverShoot)) {
    archetypeTitle = "3-and-D Specialist";
    archetypeEmoji = "🎯";
    archetypeDesc =
      "Spreads the floor with elite perimeter shooting while locking down opposing ball-handlers on defense.";
    archetypeTier = 3;
  }
  // 3. Assist + Defense (1 Gold, 1 Silver)
  else if ((hasGoldAssist && hasSilverDefense) || (hasGoldDefense && hasSilverAssist)) {
    archetypeTitle = "Two-Way Floor General";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Commands the offense with crisp distribution while anchoring the perimeter with tenacious lockdown defense.";
    archetypeTier = 3;
  }
  // -------------------------------------------------------------
  // TIER 2: HYBRID ROLES
  // Requires: 1 Primary Silver+ Pillar AND 1 Secondary Bronze+ Skill (or 2 Silvers)
  // -------------------------------------------------------------
  // Shoot primary + secondary skills:
  else if (hasSilverShoot && hasSecondaryAssist && hasSecondaryDefense) {
    const astRate = Math.min(career.ast / 40, apg / 1.4);
    const defRate = Math.min(stocks / 45, stockPg / 1.3);
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
  } else if (hasSilverShoot && hasSecondaryAssist) {
    archetypeTitle = "Combo Guard";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Dynamic perimeter threat who scores from outside while creating scoring opportunities for teammates.";
    archetypeTier = 2;
  } else if (hasSilverShoot && hasSecondaryDefense) {
    archetypeTitle = "Two-Way Shooter";
    archetypeEmoji = "🎯";
    archetypeDesc =
      "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.";
    archetypeTier = 2;
  }
  // Assist primary + secondary skills:
  else if (hasSilverAssist && hasSecondaryShoot && hasSecondaryDefense) {
    const shootRate = Math.min(career.fg3m / 22, ppg / 5.5);
    const defRate = Math.min(stocks / 45, stockPg / 1.3);
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
  } else if (hasSilverAssist && hasSecondaryShoot) {
    archetypeTitle = "Combo Guard";
    archetypeEmoji = "🪄";
    archetypeDesc =
      "Floor general who commands the pace while keeping defenses honest with scoring threat.";
    archetypeTier = 2;
  } else if (hasSilverAssist && hasSecondaryDefense) {
    archetypeTitle = "Two-Way Playmaker";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.";
    archetypeTier = 2;
  }
  // Defense primary + secondary skills:
  else if (hasSilverDefense && hasSecondaryShoot && hasSecondaryAssist) {
    const shootRate = Math.min(career.fg3m / 22, ppg / 5.5);
    const astRate = Math.min(career.ast / 40, apg / 1.4);
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
  } else if (hasSilverDefense && hasSecondaryShoot) {
    archetypeTitle = "Two-Way Slasher";
    archetypeEmoji = "⚔️";
    archetypeDesc =
      "Disruptive lockdown defender who pushes the pace and scores in transition.";
    archetypeTier = 2;
  } else if (hasSilverDefense && hasSecondaryAssist) {
    archetypeTitle = "Two-Way Playmaker";
    archetypeEmoji = "🛡️";
    archetypeDesc =
      "Defensive stopper who facilitates offense and creates transition opportunities.";
    archetypeTier = 2;
  } else if (
    (hasSilverPaint && (hasSecondaryDefense || stocks >= 12 || stockPg >= 1.0)) ||
    (hasSilverDefense && (hasBadge("paint-beast", "bronze") || rpg >= 2.5))
  ) {
    archetypeTitle = "Defensive Anchor";
    archetypeEmoji = "🏰";
    archetypeDesc = "Controls the paint, dominates the glass, and protects the rim.";
    archetypeTier = 2;
  } else if ((hasBadge("bucket", "silver") || ppg >= 5.5) && (hasSilverPaint || rpg >= 3.4)) {
    archetypeTitle = "Two-Way Force";
    archetypeEmoji = "👑";
    archetypeDesc = "Powerful scoring and rebounding presence on the interior.";
    archetypeTier = 2;
  }
  // -------------------------------------------------------------
  // TIER 1: SPECIALIZED DISCIPLINES (Single Discipline at Silver+)
  // -------------------------------------------------------------
  else if (hasBadge("sharpshooter", "silver") || (gp >= 8 && career.fg3m >= 8 && fg3Pct >= 0.28)) {
    archetypeTitle = "Sharpshooter";
    archetypeEmoji = "🎯";
    archetypeDesc = "Lethal shooting threat from anywhere behind the arc.";
    archetypeTier = 1;
  } else if (hasSilverAssist) {
    archetypeTitle = "Floor General";
    archetypeEmoji = "🪄";
    archetypeDesc = "Pure playmaker who elevates everyone around them.";
    archetypeTier = 1;
  } else if (hasSilverDefense) {
    archetypeTitle = "Lockdown Specialist";
    archetypeEmoji = "🔒";
    archetypeDesc = "Defensive stopper who takes on the opponent's toughest matchup.";
    archetypeTier = 1;
  } else if (hasBadge("bucket", "silver") || (gp >= 8 && ppg >= 5.5)) {
    archetypeTitle = "Pure Scorer";
    archetypeEmoji = "🔥";
    archetypeDesc = "Natural scoring instinct capable of heating up in a flash.";
    archetypeTier = 1;
  } else if (hasSilverPaint) {
    archetypeTitle = "Paint Beast";
    archetypeEmoji = "🦏";
    archetypeDesc = "Physical force on the interior who owns the boards and finishes through contact.";
    archetypeTier = 1;
  } else if (hasBadge("clutch-gene", "silver")) {
    archetypeTitle = "Clutch Assassin";
    archetypeEmoji = "🧊";
    archetypeDesc = "Ice in their veins; delivers game-winners and decisive late-game plays.";
    archetypeTier = 1;
  } else if (rpg >= 3.4 && career.reb >= 30) {
    archetypeTitle = "Rebound Dynamo";
    archetypeEmoji = "🦍";
    archetypeDesc = "High-motor rebounder who guarantees extra possessions.";
    archetypeTier = 1;
  } else if (hasBadge("sparkplug", "silver")) {
    archetypeTitle = "Hustle Engine";
    archetypeEmoji = "⚡";
    archetypeDesc = "Brings continuous effort, winning plays, and game-changing momentum.";
    archetypeTier = 1;
  }
  // -------------------------------------------------------------
  // TIER 0: FOUNDATIONS
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
    stockPg,
    gw,
    clutchPts,
    hasSilverShoot,
    hasGoldShoot,
    hasHofShoot,
    hasSilverAssist,
    hasGoldAssist,
    hasHofAssist,
    hasSilverDefense,
    hasGoldDefense,
    hasHofDefense,
    hasSilverPaint,
    hasGoldPaint,
    hasSecondaryShoot,
    hasSecondaryAssist,
    hasSecondaryDefense,
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
  stockPg: number;
  gw: number;
  clutchPts: number;
  hasSilverShoot: boolean;
  hasGoldShoot: boolean;
  hasHofShoot: boolean;
  hasSilverAssist: boolean;
  hasGoldAssist: boolean;
  hasHofAssist: boolean;
  hasSilverDefense: boolean;
  hasGoldDefense: boolean;
  hasHofDefense: boolean;
  hasSilverPaint: boolean;
  hasGoldPaint: boolean;
  hasSecondaryShoot: boolean;
  hasSecondaryAssist: boolean;
  hasSecondaryDefense: boolean;
};

/**
 * Calculates the player's percentage progress and stat requirement deltas.
 * Strictly generates upgrades for the immediate next tier (currentTier + 1).
 */
function computeArchetypeUpgrades(ctx: UpgradeContext): ArchetypeUpgrade[] {
  // If player reached Tier 4 (The All-Around Threat), apex achieved
  if (ctx.currentTier === 4) return [];

  const candidates: ArchetypeUpgrade[] = [];
  const targetTier = (ctx.currentTier + 1) as ArchetypeTier;

  // Pillar progress meters towards Gold (scale 0 to 1):
  // Shoot towards Gold: (Gold Deadeye = 60 3PM or Gold Bucket = 420 pts & 7.0 PPG)
  const shootGoldProg = ctx.hasGoldShoot
    ? 1
    : ctx.hasSilverShoot
      ? 0.65 + 0.35 * Math.min(1, Math.max(ctx.career.fg3m / 60, ctx.career.pts / 420))
      : 0.65 * Math.min(1, Math.max(ctx.career.fg3m / 22, ctx.career.pts / 160));

  // Assist towards Gold: (Gold Floor General = 110 AST & 1.8 APG)
  const astGoldProg = ctx.hasGoldAssist
    ? 1
    : ctx.hasSilverAssist
      ? 0.65 + 0.35 * Math.min(1, Math.min(ctx.career.ast / 110, ctx.apg / 1.8))
      : 0.65 * Math.min(1, Math.min(ctx.career.ast / 40, ctx.apg / 1.4));

  // Defense towards Gold: (Gold Lockdown = 120 stocks & 1.7 stocks/gm)
  const defGoldProg = ctx.hasGoldDefense
    ? 1
    : ctx.hasSilverDefense
      ? 0.65 + 0.35 * Math.min(1, Math.min(ctx.stocks / 120, ctx.stockPg / 1.7))
      : 0.65 * Math.min(1, Math.min(ctx.stocks / 45, ctx.stockPg / 1.3));

  // -------------------------------------------------------------
  // TARGET TIER 4: The All-Around Threat (Only shown to Tier 3 players)
  // Requires: All 3 pillars at Silver+ AND 2+ Gold pillars (or 1 HOF)
  // -------------------------------------------------------------
  if (targetTier === 4) {
    const allAroundPct = Math.min(
      99,
      Math.round(((shootGoldProg + astGoldProg + defGoldProg) / 3) * 100),
    );

    let allAroundReq = "";
    if (!ctx.hasSilverDefense) {
      allAroundReq = `Unlock 3rd pillar (Defense): ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm for Silver Lockdown`;
    } else if (!ctx.hasSilverAssist) {
      allAroundReq = `Unlock 3rd pillar (Assist): ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG for Silver Floor General`;
    } else if (!ctx.hasSilverShoot) {
      allAroundReq = `Unlock 3rd pillar (Shoot): ${Math.max(1, 22 - ctx.career.fg3m)} 3PM or ${Math.max(1, 160 - ctx.career.pts)} pts & ≥5.5 PPG for Silver Bucket`;
    } else {
      // Has all 3 Silvers, needs 2nd Gold pillar!
      allAroundReq = `Elevate 2nd pillar to Gold (e.g. 110 AST, 120 stocks, or 420 pts)`;
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
  // Requires: 1 Gold+ Pillar AND 1 Silver+ Pillar
  // -------------------------------------------------------------
  if (targetTier === 3) {
    // 1. Playmaking Shot Creator (Shoot + Assist: 1 Gold, 1 Silver)
    if (ctx.currentTitle !== "Playmaking Shot Creator") {
      const pct = Math.min(
        99,
        Math.round(((shootGoldProg + astGoldProg) / 2) * 100),
      );

      let req = "";
      if (ctx.hasGoldShoot && !ctx.hasSilverAssist) {
        req = `Needs Silver Assist: ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG`;
      } else if (ctx.hasGoldAssist && !ctx.hasSilverShoot) {
        req = `Needs Silver Shoot: ${Math.max(1, 22 - ctx.career.fg3m)} 3PM or ${Math.max(1, 160 - ctx.career.pts)} pts & ≥5.5 PPG`;
      } else if (ctx.hasSilverShoot && ctx.hasSilverAssist) {
        req = `Elevate to Gold: ${Math.max(1, 110 - ctx.career.ast)} ast (Gold Assist) or 60 3PM / 420 pts (Gold Shoot)`;
      } else if (ctx.hasSilverShoot) {
        req = `Needs Silver Assist: ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG`;
      } else if (ctx.hasSilverAssist) {
        req = `Needs Silver Shoot: ${Math.max(1, 22 - ctx.career.fg3m)} 3PM or ${Math.max(1, 160 - ctx.career.pts)} pts & ≥5.5 PPG`;
      } else {
        req = `Needs Shoot & Assist mastery at Gold + Silver`;
      }

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

    // 2. 3-and-D Specialist (Shoot + Defense: 1 Gold, 1 Silver)
    if (ctx.currentTitle !== "3-and-D Specialist") {
      const pct = Math.min(
        99,
        Math.round(((shootGoldProg + defGoldProg) / 2) * 100),
      );

      let req = "";
      if (ctx.hasGoldShoot && !ctx.hasSilverDefense) {
        req = `Needs Silver Defense: ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm`;
      } else if (ctx.hasGoldDefense && !ctx.hasSilverShoot) {
        req = `Needs Silver Shoot: ${Math.max(1, 22 - ctx.career.fg3m)} 3PM or ${Math.max(1, 160 - ctx.career.pts)} pts & ≥5.5 PPG`;
      } else if (ctx.hasSilverShoot && ctx.hasSilverDefense) {
        req = `Elevate to Gold: ${Math.max(1, 120 - ctx.stocks)} stocks (Gold Defense) or 60 3PM / 420 pts (Gold Shoot)`;
      } else if (ctx.hasSilverShoot) {
        req = `Needs Silver Defense: ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm`;
      } else if (ctx.hasSilverDefense) {
        req = `Needs Silver Shoot: ${Math.max(1, 22 - ctx.career.fg3m)} 3PM or ${Math.max(1, 160 - ctx.career.pts)} pts & ≥5.5 PPG`;
      } else {
        req = `Needs Shoot & Defense mastery at Gold + Silver`;
      }

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

    // 3. Two-Way Floor General (Assist + Defense: 1 Gold, 1 Silver)
    if (ctx.currentTitle !== "Two-Way Floor General") {
      const pct = Math.min(
        99,
        Math.round(((astGoldProg + defGoldProg) / 2) * 100),
      );

      let req = "";
      if (ctx.hasGoldAssist && !ctx.hasSilverDefense) {
        req = `Needs Silver Defense: ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm`;
      } else if (ctx.hasGoldDefense && !ctx.hasSilverAssist) {
        req = `Needs Silver Assist: ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG`;
      } else if (ctx.hasSilverAssist && ctx.hasSilverDefense) {
        req = `Elevate to Gold: ${Math.max(1, 110 - ctx.career.ast)} ast (Gold Assist) or 120 stocks (Gold Defense)`;
      } else if (ctx.hasSilverAssist) {
        req = `Needs Silver Defense: ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm`;
      } else if (ctx.hasSilverDefense) {
        req = `Needs Silver Assist: ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG`;
      } else {
        req = `Needs Assist & Defense mastery at Gold + Silver`;
      }

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
  // Requires: 1 Primary Silver+ Pillar AND 1 Secondary Bronze+ Skill
  // -------------------------------------------------------------
  if (targetTier === 2) {
    const secAstProg = Math.min(1, Math.max(ctx.career.ast / 10, ctx.apg / 1.0));
    const secDefProg = Math.min(1, Math.max(ctx.stocks / 12, ctx.stockPg / 1.0));
    const secShootProg = Math.min(1, Math.max(ctx.career.fg3m / 5, ctx.ppg / 4.0));

    if (ctx.hasSilverShoot) {
      // 1. Combo Guard (Shoot + Secondary Assist)
      const comboPct = Math.min(
        99,
        Math.round(((1.0 + secAstProg) / 2) * 100),
      );
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: comboPct,
        requirement: `Develop secondary playmaking: ${Math.max(1, 10 - ctx.career.ast)} more ast (${ctx.career.ast}/10) or ≥1.0 APG`,
        description:
          "Dynamic backcourt threat who balances scoring instincts with playmaking for teammates.",
      });

      // 2. Two-Way Shooter (Shoot + Secondary Defense)
      const twoWayShootPct = Math.min(
        99,
        Math.round(((1.0 + secDefProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Shooter",
        emoji: "🎯",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayShootPct,
        requirement: `Develop secondary defense: ${Math.max(1, 12 - ctx.stocks)} more stocks (${ctx.stocks}/12) or ≥1.0 stocks/gm`,
        description:
          "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.",
      });
    } else if (ctx.hasSilverAssist) {
      // 1. Combo Guard (Assist + Secondary Scoring)
      const comboPct = Math.min(
        99,
        Math.round(((1.0 + secShootProg) / 2) * 100),
      );
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: comboPct,
        requirement: `Develop secondary scoring: ${Math.max(1, 5 - ctx.career.fg3m)} more 3PM (${ctx.career.fg3m}/5) or ≥4.0 PPG`,
        description:
          "Floor general who commands the pace while keeping defenses honest with scoring threat.",
      });

      // 2. Two-Way Playmaker (Assist + Secondary Defense)
      const twoWayPlayPct = Math.min(
        99,
        Math.round(((1.0 + secDefProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Playmaker",
        emoji: "🛡️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayPlayPct,
        requirement: `Develop secondary defense: ${Math.max(1, 12 - ctx.stocks)} more stocks (${ctx.stocks}/12) or ≥1.0 stocks/gm`,
        description:
          "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.",
      });
    } else if (ctx.hasSilverDefense) {
      // 1. Two-Way Slasher (Defense + Secondary Scoring)
      const twoWayShootPct = Math.min(
        99,
        Math.round(((1.0 + secShootProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Slasher",
        emoji: "⚔️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayShootPct,
        requirement: `Develop secondary scoring: ${Math.max(1, 5 - ctx.career.fg3m)} more 3PM or ≥4.0 PPG (${ctx.ppg.toFixed(1)} curr)`,
        description:
          "Disruptive lockdown defender who pushes the pace and scores in transition.",
      });

      // 2. Two-Way Playmaker (Defense + Secondary Assist)
      const twoWayPlayPct = Math.min(
        99,
        Math.round(((1.0 + secAstProg) / 2) * 100),
      );
      candidates.push({
        title: "Two-Way Playmaker",
        emoji: "🛡️",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: twoWayPlayPct,
        requirement: `Develop secondary playmaking: ${Math.max(1, 10 - ctx.career.ast)} more ast (${ctx.career.ast}/10) or ≥1.0 APG`,
        description:
          "Defensive stopper who facilitates offense and creates transition opportunities.",
      });

      // 3. Defensive Anchor (Defense + Secondary Rebounding)
      const secRebProg = Math.min(1, Math.max(ctx.career.reb / 20, ctx.rpg / 2.5));
      const anchorPct = Math.min(
        99,
        Math.round(((1.0 + secRebProg) / 2) * 100),
      );
      candidates.push({
        title: "Defensive Anchor",
        emoji: "🏰",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: anchorPct,
        requirement: `Develop glass presence: ${Math.max(1, 20 - ctx.career.reb)} more reb (${ctx.career.reb}/20) or ≥2.5 RPG`,
        description: "Controls the paint, dominates the glass, and protects the rim.",
      });
    } else if (ctx.hasSilverPaint) {
      candidates.push({
        title: "Defensive Anchor",
        emoji: "🏰",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((1.0 + secDefProg) / 2) * 100)),
        requirement: `Develop secondary defense: ${Math.max(1, 12 - ctx.stocks)} more stocks (${ctx.stocks}/12)`,
        description: "Controls the paint, dominates the glass, and protects the rim.",
      });
      candidates.push({
        title: "Two-Way Force",
        emoji: "👑",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((1.0 + Math.min(1, ctx.ppg / 5.5)) / 2) * 100)),
        requirement: `Needs ≥5.5 PPG (${ctx.ppg.toFixed(1)} curr) & 160 pts`,
        description: "Powerful scoring and rebounding presence on the interior.",
      });
    } else {
      candidates.push({
        title: "Combo Guard",
        emoji: "🪄",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((secShootProg + secAstProg) / 2) * 100)),
        requirement: `Develop secondary playmaking: ${Math.max(1, 10 - ctx.career.ast)} more ast (${ctx.career.ast}/10)`,
        description:
          "Dynamic backcourt threat who balances scoring instincts with playmaking for teammates.",
      });
      candidates.push({
        title: "Two-Way Shooter",
        emoji: "🎯",
        tier: 2,
        tierLabel: ARCHETYPE_TIER_META[2].label,
        progressPct: Math.min(99, Math.round(((secShootProg + secDefProg) / 2) * 100)),
        requirement: `Develop secondary defense: ${Math.max(1, 12 - ctx.stocks)} more stocks (${ctx.stocks}/12)`,
        description:
          "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.",
      });
    }
  }

  // -------------------------------------------------------------
  // TARGET TIER 1: Single-Discipline Specialists (Only shown to Tier 0 players)
  // Requires: 1 Silver+ Badge in any discipline
  // -------------------------------------------------------------
  if (targetTier === 1) {
    // Pure Scorer
    const scorerPct = Math.min(
      99,
      Math.round(((Math.min(1, ctx.career.pts / 160) + Math.min(1, ctx.ppg / 5.5)) / 2) * 100),
    );
    candidates.push({
      title: "Pure Scorer",
      emoji: "🔥",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: scorerPct,
      requirement: `Needs ${Math.max(1, 160 - ctx.career.pts)} more pts (${ctx.career.pts}/160) & ≥5.5 PPG (${ctx.ppg.toFixed(1)} curr, min 12 GP)`,
      description: "Natural scoring instinct capable of heating up in a flash.",
    });

    // Sharpshooter
    const countPct = Math.min(1, ctx.career.fg3m / 22);
    const accuracyPct = Math.min(1, ctx.fg3Pct / 0.28);
    const sharpPct = Math.min(99, Math.round((countPct * 0.65 + accuracyPct * 0.35) * 100));
    candidates.push({
      title: "Sharpshooter",
      emoji: "🎯",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: sharpPct,
      requirement:
        ctx.career.fg3m < 22
          ? `Needs ${22 - ctx.career.fg3m} more 3PM (${ctx.career.fg3m}/22) & ≥28% 3PT (min 12 GP)`
          : `Needs ≥28% 3PT (${Math.round(ctx.fg3Pct * 100)}% curr)`,
      description: "Lethal shooting threat from anywhere behind the arc.",
    });

    // Floor General
    const astPct = Math.min(
      99,
      Math.round(((Math.min(1, ctx.career.ast / 40) + Math.min(1, ctx.apg / 1.4)) / 2) * 100),
    );
    candidates.push({
      title: "Floor General",
      emoji: "🪄",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: astPct,
      requirement: `Needs ${Math.max(1, 40 - ctx.career.ast)} more ast (${ctx.career.ast}/40) & ≥1.4 APG (${ctx.apg.toFixed(1)} curr, min 12 GP)`,
      description: "Pure playmaker who elevates everyone around them.",
    });

    // Paint Beast
    const rebPct = Math.min(
      99,
      Math.round(((Math.min(1, ctx.career.reb / 100) + Math.min(1, ctx.rpg / 3.4)) / 2) * 100),
    );
    candidates.push({
      title: "Paint Beast",
      emoji: "🦏",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: rebPct,
      requirement: `Needs ${Math.max(1, 100 - ctx.career.reb)} more reb (${ctx.career.reb}/100) & ≥3.4 RPG (${ctx.rpg.toFixed(1)} curr, min 12 GP)`,
      description: "Physical force on the interior who owns the boards and finishes through contact.",
    });

    // Lockdown Specialist
    const lockPct = Math.min(
      99,
      Math.round(((Math.min(1, ctx.stocks / 45) + Math.min(1, ctx.stockPg / 1.3)) / 2) * 100),
    );
    candidates.push({
      title: "Lockdown Specialist",
      emoji: "🔒",
      tier: 1,
      tierLabel: ARCHETYPE_TIER_META[1].label,
      progressPct: lockPct,
      requirement: `Needs ${Math.max(1, 45 - ctx.stocks)} more stocks (${ctx.stocks}/45) & ≥1.3 stocks/gm (min 12 GP)`,
      description: "Defensive stopper who takes on the opponent's toughest matchup.",
    });
  }

  // Filter candidates: strictly match targetTier and progressPct < 100
  return candidates
    .filter((c) => c.tier === targetTier && c.title !== ctx.currentTitle && c.progressPct < 100)
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 3);
}

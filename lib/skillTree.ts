import {
  type ArchetypeTier,
  type PlayerArchetype,
  type ArchetypeUpgrade,
  computePlayerArchetype,
  ARCHETYPE_TIER_META,
} from "./badges";
import type { CareerLine, Player } from "./queries";
import type { ClutchLine } from "./clutch";

export type ArchetypeNodeId =
  | "all-around-threat"
  | "playmaking-shot-creator"
  | "3-and-d-specialist"
  | "floor-commander"
  | "two-way-combo"
  | "two-way-shooter"
  | "two-way-playmaker"
  | "two-way-scorer"
  | "defensive-anchor"
  | "two-way-force"
  | "pure-scorer"
  | "sharpshooter"
  | "floor-general"
  | "lockdown-specialist"
  | "paint-beast"
  | "clutch-assassin"
  | "hustle-engine"
  | "rookie"
  | "prospect"
  | "glue-player";

export type PillarCategory =
  | "apex"
  | "shooting"
  | "playmaking"
  | "defense"
  | "paint"
  | "hybrid"
  | "foundation";

export type ArchetypeNodeMeta = {
  id: ArchetypeNodeId;
  title: string;
  emoji: string;
  tier: ArchetypeTier;
  pillar: PillarCategory;
  pillarLabel: string;
  summary: string;
  requirements: string[];
  parents: ArchetypeNodeId[];
  children: ArchetypeNodeId[];
};

export type TierMeta = {
  tier: ArchetypeTier;
  label: string;
  title: string;
  tagline: string;
  requirementSummary: string;
  badgeClass: string;
  dotClass: string;
  glowColor: string;
  borderColor: string;
  accentBg: string;
  nodeIds: ArchetypeNodeId[];
};

export const SKILL_TREE_TIERS: TierMeta[] = [
  {
    tier: 4,
    label: "Tier 4",
    title: "Supreme Apex",
    tagline: "The Mount Rushmore of Basketball Mastery",
    requirementSummary: "50+ GP, All 3 Core Pillars at Silver+, and 2+ Gold (or Hall of Fame) Pillars",
    badgeClass: ARCHETYPE_TIER_META[4].badgeClass,
    dotClass: ARCHETYPE_TIER_META[4].dotClass,
    glowColor: "rgba(16, 185, 129, 0.25)",
    borderColor: "border-emerald-500/40",
    accentBg: "bg-emerald-500/10",
    nodeIds: ["all-around-threat"],
  },
  {
    tier: 3,
    label: "Tier 3",
    title: "Pinnacle Dual-Pillars",
    tagline: "Elite Mastery of Two Core Pillars",
    requirementSummary: "35+ GP, 1 Gold+ Pillar AND 1 Silver+ Pillar (Shoot, Assist, or Defense)",
    badgeClass: ARCHETYPE_TIER_META[3].badgeClass,
    dotClass: ARCHETYPE_TIER_META[3].dotClass,
    glowColor: "rgba(168, 85, 247, 0.22)",
    borderColor: "border-purple-500/35",
    accentBg: "bg-purple-500/10",
    nodeIds: ["playmaking-shot-creator", "3-and-d-specialist", "floor-commander"],
  },
  {
    tier: 2,
    label: "Tier 2",
    title: "Hybrid Roles",
    tagline: "Expanded Skillsets & Two-Way Weapons",
    requirementSummary: "1 Primary Silver+ Pillar AND 1 Secondary Skill (~60% of Silver, or a 2nd Silver)",
    badgeClass: ARCHETYPE_TIER_META[2].badgeClass,
    dotClass: ARCHETYPE_TIER_META[2].dotClass,
    glowColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "border-amber-500/35",
    accentBg: "bg-amber-500/10",
    nodeIds: [
      "two-way-combo",
      "two-way-shooter",
      "two-way-playmaker",
      "two-way-scorer",
      "defensive-anchor",
      "two-way-force",
    ],
  },
  {
    tier: 1,
    label: "Tier 1",
    title: "Specialized Disciplines",
    tagline: "Unlocking a Signature Primary Weapon",
    requirementSummary: "12+ GP and at least 1 Silver+ Badge in any core discipline",
    badgeClass: ARCHETYPE_TIER_META[1].badgeClass,
    dotClass: ARCHETYPE_TIER_META[1].dotClass,
    glowColor: "rgba(14, 165, 233, 0.2)",
    borderColor: "border-sky-500/35",
    accentBg: "bg-sky-500/10",
    nodeIds: [
      "pure-scorer",
      "sharpshooter",
      "floor-general",
      "lockdown-specialist",
      "paint-beast",
      "clutch-assassin",
      "hustle-engine",
    ],
  },
  {
    tier: 0,
    label: "Tier 0",
    title: "Foundations",
    tagline: "The Roots: Experience, Hustle & Team Glue",
    requirementSummary: "Starting out in the league, carving identity, and building toward Silver badges",
    badgeClass: ARCHETYPE_TIER_META[0].badgeClass,
    dotClass: ARCHETYPE_TIER_META[0].dotClass,
    glowColor: "rgba(148, 163, 184, 0.15)",
    borderColor: "border-slate-400/30",
    accentBg: "bg-slate-200/50",
    nodeIds: ["rookie", "prospect", "glue-player"],
  },
];

export type NodeCoord = { x: number; y: number };

export const SKILL_TREE_COORDS: Record<ArchetypeNodeId, NodeCoord> = {
  // Tier 4 · Apex (Y = 88)
  "all-around-threat": { x: 500, y: 88 },

  // Tier 3 · Pinnacle (Y = 248)
  "playmaking-shot-creator": { x: 250, y: 248 },
  "3-and-d-specialist": { x: 500, y: 248 },
  "floor-commander": { x: 750, y: 248 },

  // Tier 2 · Hybrid (Y = 418)
  "two-way-combo": { x: 75, y: 418 },
  "two-way-force": { x: 245, y: 418 },
  "two-way-shooter": { x: 415, y: 418 },
  "two-way-scorer": { x: 585, y: 418 },
  "two-way-playmaker": { x: 755, y: 418 },
  "defensive-anchor": { x: 925, y: 418 },

  // Tier 1 · Specialist (Y = 600)
  "pure-scorer": { x: 80, y: 600 },
  "sharpshooter": { x: 220, y: 600 },
  "clutch-assassin": { x: 360, y: 600 },
  "floor-general": { x: 500, y: 600 },
  "hustle-engine": { x: 640, y: 600 },
  "lockdown-specialist": { x: 780, y: 600 },
  "paint-beast": { x: 920, y: 600 },

  // Tier 0 · Foundation (Y = 785)
  "rookie": { x: 280, y: 785 },
  "prospect": { x: 500, y: 785 },
  "glue-player": { x: 720, y: 785 },
};

export type TreeBranch = {
  id: string;
  source: ArchetypeNodeId;
  target: ArchetypeNodeId;
  pillar: PillarCategory;
};

export const SKILL_TREE_BRANCHES: TreeBranch[] = [
  // Tier 0 -> Tier 1
  { id: "rookie-scorer", source: "rookie", target: "pure-scorer", pillar: "shooting" },
  { id: "rookie-sharp", source: "rookie", target: "sharpshooter", pillar: "shooting" },
  { id: "rookie-floor", source: "rookie", target: "floor-general", pillar: "playmaking" },
  { id: "prospect-clutch", source: "prospect", target: "clutch-assassin", pillar: "shooting" },
  { id: "prospect-floor", source: "prospect", target: "floor-general", pillar: "playmaking" },
  { id: "prospect-hustle", source: "prospect", target: "hustle-engine", pillar: "defense" },
  { id: "prospect-lock", source: "prospect", target: "lockdown-specialist", pillar: "defense" },
  { id: "glue-lock", source: "glue-player", target: "lockdown-specialist", pillar: "defense" },
  { id: "glue-paint", source: "glue-player", target: "paint-beast", pillar: "paint" },

  // Tier 1 -> Tier 2
  { id: "scorer-combo", source: "pure-scorer", target: "two-way-combo", pillar: "hybrid" },
  { id: "scorer-force", source: "pure-scorer", target: "two-way-force", pillar: "hybrid" },
  { id: "sharp-combo", source: "sharpshooter", target: "two-way-combo", pillar: "hybrid" },
  { id: "sharp-shooter", source: "sharpshooter", target: "two-way-shooter", pillar: "hybrid" },
  { id: "clutch-combo", source: "clutch-assassin", target: "two-way-combo", pillar: "hybrid" },
  { id: "floor-combo", source: "floor-general", target: "two-way-combo", pillar: "hybrid" },
  { id: "floor-playmaker", source: "floor-general", target: "two-way-playmaker", pillar: "hybrid" },
  { id: "hustle-playmaker", source: "hustle-engine", target: "two-way-playmaker", pillar: "hybrid" },
  { id: "lock-shooter", source: "lockdown-specialist", target: "two-way-shooter", pillar: "hybrid" },
  { id: "lock-scorer", source: "lockdown-specialist", target: "two-way-scorer", pillar: "hybrid" },
  { id: "lock-playmaker", source: "lockdown-specialist", target: "two-way-playmaker", pillar: "hybrid" },
  { id: "lock-anchor", source: "lockdown-specialist", target: "defensive-anchor", pillar: "hybrid" },
  { id: "paint-force", source: "paint-beast", target: "two-way-force", pillar: "hybrid" },
  { id: "paint-anchor", source: "paint-beast", target: "defensive-anchor", pillar: "hybrid" },

  // Tier 2 -> Tier 3
  { id: "combo-psc", source: "two-way-combo", target: "playmaking-shot-creator", pillar: "hybrid" },
  { id: "force-psc", source: "two-way-force", target: "playmaking-shot-creator", pillar: "hybrid" },
  { id: "force-3d", source: "two-way-force", target: "3-and-d-specialist", pillar: "hybrid" },
  { id: "shooter-3d", source: "two-way-shooter", target: "3-and-d-specialist", pillar: "hybrid" },
  { id: "scorer-3d", source: "two-way-scorer", target: "3-and-d-specialist", pillar: "hybrid" },
  { id: "playmaker-psc", source: "two-way-playmaker", target: "playmaking-shot-creator", pillar: "hybrid" },
  { id: "playmaker-fc", source: "two-way-playmaker", target: "floor-commander", pillar: "hybrid" },
  { id: "anchor-fc", source: "defensive-anchor", target: "floor-commander", pillar: "hybrid" },

  // Tier 3 -> Tier 4
  { id: "psc-apex", source: "playmaking-shot-creator", target: "all-around-threat", pillar: "apex" },
  { id: "3d-apex", source: "3-and-d-specialist", target: "all-around-threat", pillar: "apex" },
  { id: "fc-apex", source: "floor-commander", target: "all-around-threat", pillar: "apex" },
];

export const SKILL_TREE_NODES: Record<ArchetypeNodeId, ArchetypeNodeMeta> = {
  // Tier 4
  "all-around-threat": {
    id: "all-around-threat",
    title: "The All-Around Threat",
    emoji: "🌟",
    tier: 4,
    pillar: "apex",
    pillarLabel: "Tri-Pillar Supremacy",
    summary:
      "The undisputed master on the court. Complete statistical dominance across all three core pillars: elite scoring/shooting, playmaking, and lockdown defense.",
    requirements: [
      "50+ Games Played",
      "All 3 Core Pillars at Silver+ (Sharpshooter/Bucket, Floor General, Lockdown)",
      "At least 2 Gold+ Pillars (or 1 Hall of Fame)",
    ],
    parents: ["playmaking-shot-creator", "3-and-d-specialist", "floor-commander"],
    children: [],
  },

  // Tier 3
  "playmaking-shot-creator": {
    id: "playmaking-shot-creator",
    title: "Playmaking Shot Creator",
    emoji: "🪄",
    tier: 3,
    pillar: "hybrid",
    pillarLabel: "Shoot 🏹 + Assist 🪄",
    summary:
      "Deadly perimeter scoring threat who also slices defenses open with elite playmaking and floor vision.",
    requirements: [
      "35+ Games Played (Gold badge gate)",
      "Gold Shoot + Silver Assist OR Gold Assist + Silver Shoot",
      "E.g., 60 3PM / 420 pts & 40 AST / 1.4 APG",
    ],
    parents: ["two-way-combo", "two-way-force"],
    children: ["all-around-threat"],
  },
  "3-and-d-specialist": {
    id: "3-and-d-specialist",
    title: "3-and-D Specialist",
    emoji: "🎯",
    tier: 3,
    pillar: "hybrid",
    pillarLabel: "Shoot 🏹 + Defense 🛡️",
    summary:
      "Spreads the floor with elite perimeter shooting while locking down opposing ball-handlers on defense.",
    requirements: [
      "35+ Games Played (Gold badge gate)",
      "Gold Shoot + Silver Defense OR Gold Defense + Silver Shoot",
      "E.g., 60 3PM / 420 pts & 45 stocks / 1.3 stocks/gm",
    ],
    parents: ["two-way-shooter", "two-way-scorer", "two-way-force"],
    children: ["all-around-threat"],
  },
  "floor-commander": {
    id: "floor-commander",
    title: "Floor Commander",
    emoji: "🛡️",
    tier: 3,
    pillar: "hybrid",
    pillarLabel: "Assist 🪄 + Defense 🛡️",
    summary:
      "Commands the offense with crisp distribution while anchoring the perimeter with tenacious lockdown defense.",
    requirements: [
      "35+ Games Played (Gold badge gate)",
      "Gold Assist + Silver Defense OR Gold Defense + Silver Assist",
      "E.g., 110 AST / 1.8 APG & 45 stocks / 1.3 stocks/gm",
    ],
    parents: ["two-way-playmaker", "defensive-anchor"],
    children: ["all-around-threat"],
  },
  // Tier 2
  "two-way-combo": {
    id: "two-way-combo",
    title: "Two-Way Combo",
    emoji: "🪄",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Scoring + Playmaking",
    summary:
      "Dynamic perimeter threat who scores from outside while creating scoring opportunities for teammates.",
    requirements: [
      "Silver Shoot (22 3PM / 160 pts) + Secondary Assist (24 AST & 0.85 APG)",
      "OR Silver Assist (40 AST) + Secondary Scoring (13 3PM, or 96 pts & 3.3 PPG)",
    ],
    parents: ["pure-scorer", "sharpshooter", "floor-general"],
    children: ["playmaking-shot-creator"],
  },
  "two-way-shooter": {
    id: "two-way-shooter",
    title: "Two-Way Shooter",
    emoji: "🎯",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Shooting + Defense",
    summary:
      "Perimeter marksman who also disrupts ball-handlers with active defensive pressure.",
    requirements: [
      "Silver Shoot (22 3PM or 160 pts) + Secondary Defense (27 stocks & 0.8 stocks/gm)",
    ],
    parents: ["sharpshooter", "pure-scorer"],
    children: ["3-and-d-specialist"],
  },
  "two-way-playmaker": {
    id: "two-way-playmaker",
    title: "Two-Way Playmaker",
    emoji: "🛡️",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Playmaking + Defense",
    summary:
      "Floor general who distributes with precision while applying disciplined on-ball defensive pressure.",
    requirements: [
      "Silver Assist (40 AST) + Secondary Defense (27 stocks & 0.8 stocks/gm)",
      "OR Silver Defense (45 stocks) + Secondary Assist (24 AST & 0.85 APG)",
    ],
    parents: ["floor-general", "lockdown-specialist"],
    children: ["floor-commander"],
  },
  "two-way-scorer": {
    id: "two-way-scorer",
    title: "Two-Way Scorer",
    emoji: "⚔️",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Defense + Scoring",
    summary:
      "Lockdown defender who also brings dependable scoring at the other end.",
    requirements: [
      "Silver Defense (45 stocks) + Secondary Scoring (13 3PM, or 96 pts & 3.3 PPG)",
    ],
    parents: ["lockdown-specialist", "pure-scorer"],
    children: ["3-and-d-specialist"],
  },
  "defensive-anchor": {
    id: "defensive-anchor",
    title: "Defensive Anchor",
    emoji: "🏰",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Interior Paint + Rim Protection",
    summary: "Controls the paint, dominates the glass, and protects the rim.",
    requirements: [
      "Silver Paint Beast (100 REB / 3.4 RPG) + Secondary Defense (27 stocks & 0.8 stocks/gm)",
      "OR Silver Defense + Rebounding presence (60 REB & 2.0 RPG)",
      "Both routes need rim protection: 6+ blocks & 0.25+ BPG",
    ],
    parents: ["paint-beast", "lockdown-specialist"],
    children: ["floor-commander"],
  },
  "two-way-force": {
    id: "two-way-force",
    title: "Two-Way Force",
    emoji: "👑",
    tier: 2,
    pillar: "hybrid",
    pillarLabel: "Scoring + Paint Power",
    summary: "Powerful scoring and rebounding presence on the interior.",
    requirements: [
      "Silver Bucket (160 pts & 5.5 PPG) + Silver Paint Beast (or 3.4+ RPG)",
      "Checked before the shooting hybrids so Paint power isn't overshadowed",
    ],
    parents: ["pure-scorer", "paint-beast"],
    children: ["playmaking-shot-creator", "3-and-d-specialist"],
  },

  // Tier 1
  "pure-scorer": {
    id: "pure-scorer",
    title: "Pure Scorer",
    emoji: "🔥",
    tier: 1,
    pillar: "shooting",
    pillarLabel: "Scoring Mastery",
    summary: "Natural scoring instinct capable of heating up in a flash.",
    requirements: [
      "12+ Games Played",
      "160+ Career Points",
      "≥ 5.5 PPG (Silver Bucket badge)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-combo", "two-way-shooter", "two-way-scorer", "two-way-force"],
  },
  sharpshooter: {
    id: "sharpshooter",
    title: "Sharpshooter",
    emoji: "🎯",
    tier: 1,
    pillar: "shooting",
    pillarLabel: "Perimeter Range",
    summary: "Lethal shooting threat from anywhere behind the arc.",
    requirements: [
      "12+ Games Played",
      "22+ 3-Pointers Made (3PM)",
      "≥ 28% 3PT shooting (Silver Sharpshooter badge)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-combo", "two-way-shooter"],
  },
  "floor-general": {
    id: "floor-general",
    title: "Floor General",
    emoji: "🪄",
    tier: 1,
    pillar: "playmaking",
    pillarLabel: "Playmaking & Dimes",
    summary: "Pure playmaker who elevates everyone around them.",
    requirements: [
      "12+ Games Played",
      "40+ Assists",
      "≥ 1.4 APG (Silver Floor General badge)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-combo", "two-way-playmaker"],
  },
  "lockdown-specialist": {
    id: "lockdown-specialist",
    title: "Lockdown Specialist",
    emoji: "🔒",
    tier: 1,
    pillar: "defense",
    pillarLabel: "On-Ball Clamps",
    summary: "Defensive stopper who takes on the opponent's toughest matchup.",
    requirements: [
      "12+ Games Played",
      "45+ Stocks (Steals + Blocks + Deflections)",
      "≥ 1.3 Stocks/gm (Silver Lockdown badge)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-playmaker", "two-way-scorer", "defensive-anchor"],
  },
  "paint-beast": {
    id: "paint-beast",
    title: "Paint Beast",
    emoji: "🦏",
    tier: 1,
    pillar: "paint",
    pillarLabel: "Interior Glass & Paint",
    summary:
      "Physical force on the interior who owns the glass and guarantees extra possessions.",
    requirements: [
      "12+ Games Played",
      "100+ Rebounds",
      "≥ 3.4 RPG (Silver Paint Beast badge)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["defensive-anchor", "two-way-force"],
  },
  "clutch-assassin": {
    id: "clutch-assassin",
    title: "Clutch Assassin",
    emoji: "🧊",
    tier: 1,
    pillar: "shooting",
    pillarLabel: "Late-Game Ice",
    summary: "Ice in their veins; delivers game-winners and decisive late-game plays.",
    requirements: [
      "Silver Clutch Gene Badge",
      "3+ Game-Winning shots and 15+ Clutch points",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-combo"],
  },
  "hustle-engine": {
    id: "hustle-engine",
    title: "Hustle Engine",
    emoji: "⚡",
    tier: 1,
    pillar: "defense",
    pillarLabel: "Energy & Deflections",
    summary: "Brings continuous effort, winning plays, and game-changing momentum.",
    requirements: [
      "12+ Games Played",
      "Silver Sparkplug Badge (≥ 1.6 +/- per game & ≥ 1.2 deflections/gm)",
    ],
    parents: ["rookie", "prospect", "glue-player"],
    children: ["two-way-playmaker"],
  },

  // Tier 0
  rookie: {
    id: "rookie",
    title: "Rookie",
    emoji: "🏀",
    tier: 0,
    pillar: "foundation",
    pillarLabel: "League Newcomer",
    summary:
      "Fresh to the league; finding their rhythm, learning team tendencies, and earning their stripes.",
    requirements: ["0 to 9 Games Played"],
    parents: [],
    children: [
      "pure-scorer",
      "sharpshooter",
      "floor-general",
      "lockdown-specialist",
      "paint-beast",
    ],
  },
  prospect: {
    id: "prospect",
    title: "Prospect",
    emoji: "🌱",
    tier: 0,
    pillar: "foundation",
    pillarLabel: "Developing Talent",
    summary:
      "Flashing high potential and carving out an identity; working toward their first signature weapon.",
    requirements: ["10 to 24 Games Played", "Working toward first Silver skill badge"],
    parents: [],
    children: [
      "pure-scorer",
      "sharpshooter",
      "floor-general",
      "lockdown-specialist",
      "paint-beast",
    ],
  },
  "glue-player": {
    id: "glue-player",
    title: "Glue Player",
    emoji: "🧩",
    tier: 0,
    pillar: "foundation",
    pillarLabel: "Veteran Connector",
    summary:
      "Reliable teammate who does the dirty work—screens, hustle, ball movement, and team chemistry.",
    requirements: [
      "25+ Games Played",
      "Reliable team contributor without a specialized Silver badge",
    ],
    parents: [],
    children: [
      "pure-scorer",
      "sharpshooter",
      "floor-general",
      "lockdown-specialist",
      "paint-beast",
    ],
  },
};

export const TOTAL_ARCHETYPES = Object.keys(SKILL_TREE_NODES).length;

export function archetypeTitleToId(title: string): ArchetypeNodeId {
  const norm = title.trim().toLowerCase();
  switch (norm) {
    case "the all-around threat":
      return "all-around-threat";
    case "playmaking shot creator":
      return "playmaking-shot-creator";
    case "3-and-d specialist":
      return "3-and-d-specialist";
    case "floor commander":
    case "two-way floor general": // legacy title
      return "floor-commander";
    case "combo guard": // legacy title
    case "two-way combo":
      return "two-way-combo";
    case "two-way shooter":
      return "two-way-shooter";
    case "two-way playmaker":
      return "two-way-playmaker";
    case "two-way slasher": // legacy title
    case "two-way scorer":
      return "two-way-scorer";
    case "defensive anchor":
      return "defensive-anchor";
    case "two-way force":
      return "two-way-force";
    case "pure scorer":
      return "pure-scorer";
    case "sharpshooter":
      return "sharpshooter";
    case "floor general":
      return "floor-general";
    case "lockdown specialist":
      return "lockdown-specialist";
    case "paint beast":
    case "rebound dynamo": // legacy title (merged into Paint Beast)
      return "paint-beast";
    case "clutch assassin":
      return "clutch-assassin";
    case "hustle engine":
      return "hustle-engine";
    case "rookie":
      return "rookie";
    case "glue player":
      return "glue-player";
    case "prospect":
    default:
      return "prospect";
  }
}

export type PlayerTreeItem = {
  id: number;
  name: string;
  nicknames: string[];
  injured: boolean;
  archived: boolean;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  stocks: number;
  fg3m: number;
  fg3a: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  stockPg: number;
  fg3Pct: number;
  rating: number;
  archetype: PlayerArchetype;
  nodeId: ArchetypeNodeId;
  activeRoad: ArchetypeUpgrade | null;
  candidateRoads: ArchetypeUpgrade[];
  roadProgressPct: number;
  targetTier: ArchetypeTier;
  targetTitle: string;
  targetEmoji: string;
  deltaSummary: string;
  pillarScores: {
    shoot: { pct: number; silver: boolean; gold: boolean };
    assist: { pct: number; silver: boolean; gold: boolean };
    defense: { pct: number; silver: boolean; gold: boolean };
  };
};

export function transformToTreeItem(
  player: Player,
  career: CareerLine,
  clutch?: ClutchLine | null,
  totalGames: number = 0,
): PlayerTreeItem {
  const gp = Math.max(1, career.gp);
  const ppg = career.pts / gp;
  const rpg = career.reb / gp;
  const apg = career.ast / gp;
  const spg = career.stl / gp;
  const bpg = career.blk / gp;
  const stocks = career.stl + career.blk + career.defl;
  const stockPg = stocks / gp;
  const fg3Pct = career.fg3a > 0 ? career.fg3m / career.fg3a : 0;
  const rating = career.ratingW > 0 ? career.ratingSum / career.ratingW : 0;

  const archetype = computePlayerArchetype(career, clutch, totalGames);
  const nodeId = archetypeTitleToId(archetype.title);

  // Check pillar unlocks from badges
  const hasSharpshooterSilver = archetype.badges.some(
    (b) => (b.id === "sharpshooter" || b.id === "bucket") && (b.tier === "silver" || b.tier === "gold" || b.tier === "hof"),
  );
  const hasSharpshooterGold = archetype.badges.some(
    (b) => (b.id === "sharpshooter" || b.id === "bucket") && (b.tier === "gold" || b.tier === "hof"),
  );

  const hasFloorGeneralSilver = archetype.badges.some(
    (b) => b.id === "floor-general" && (b.tier === "silver" || b.tier === "gold" || b.tier === "hof"),
  );
  const hasFloorGeneralGold = archetype.badges.some(
    (b) => b.id === "floor-general" && (b.tier === "gold" || b.tier === "hof"),
  );

  const hasLockdownSilver = archetype.badges.some(
    (b) => b.id === "lockdown" && (b.tier === "silver" || b.tier === "gold" || b.tier === "hof"),
  );
  const hasLockdownGold = archetype.badges.some(
    (b) => b.id === "lockdown" && (b.tier === "gold" || b.tier === "hof"),
  );

  // Pillar progress meters
  const shootProg = hasSharpshooterGold
    ? 100
    : hasSharpshooterSilver
      ? Math.min(99, Math.round((0.65 + 0.35 * Math.min(1, Math.max(career.fg3m / 60, career.pts / 420))) * 100))
      : Math.min(64, Math.round(Math.min(1, Math.max(career.fg3m / 22, career.pts / 160)) * 65));

  const assistProg = hasFloorGeneralGold
    ? 100
    : hasFloorGeneralSilver
      ? Math.min(99, Math.round((0.65 + 0.35 * Math.min(1, Math.min(career.ast / 110, apg / 1.8))) * 100))
      : Math.min(64, Math.round(Math.min(1, Math.min(career.ast / 40, apg / 1.4)) * 65));

  const defenseProg = hasLockdownGold
    ? 100
    : hasLockdownSilver
      ? Math.min(99, Math.round((0.65 + 0.35 * Math.min(1, Math.min(stocks / 120, stockPg / 1.7))) * 100))
      : Math.min(64, Math.round(Math.min(1, Math.min(stocks / 45, stockPg / 1.3)) * 65));

  const activeRoad = archetype.nextUpgrades[0] ?? null;
  const candidateRoads = archetype.nextUpgrades;

  let targetTier: ArchetypeTier = 4;
  let targetTitle = "Apex Achieved";
  let targetEmoji = "🌟";
  let roadProgressPct = 100;
  let deltaSummary = "Supreme Apex Mastered";

  if (archetype.tier === 4) {
    targetTier = 4;
    targetTitle = "The All-Around Threat";
    targetEmoji = "🌟";
    roadProgressPct = 100;
    deltaSummary = "Supreme Apex Unlocked 👑";
  } else if (activeRoad) {
    targetTier = activeRoad.tier;
    targetTitle = activeRoad.title;
    targetEmoji = activeRoad.emoji;
    roadProgressPct = activeRoad.progressPct;
    deltaSummary = activeRoad.requirement;
  } else {
    targetTier = (archetype.tier + 1) as ArchetypeTier;
    targetTitle = SKILL_TREE_TIERS.find((t) => t.tier === targetTier)?.title ?? "Next Tier";
    targetEmoji = "⚡";
    roadProgressPct = 50;
    deltaSummary = "Advancing to next tier";
  }

  return {
    id: player.id,
    name: player.name,
    nicknames: player.nicknames,
    injured: player.injured,
    archived: player.archived,
    gp: career.gp,
    pts: career.pts,
    reb: career.reb,
    ast: career.ast,
    stl: career.stl,
    blk: career.blk,
    stocks,
    fg3m: career.fg3m,
    fg3a: career.fg3a,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    stockPg,
    fg3Pct,
    rating,
    archetype,
    nodeId,
    activeRoad,
    candidateRoads,
    roadProgressPct,
    targetTier,
    targetTitle,
    targetEmoji,
    deltaSummary,
    pillarScores: {
      shoot: { pct: shootProg, silver: hasSharpshooterSilver, gold: hasSharpshooterGold },
      assist: { pct: assistProg, silver: hasFloorGeneralSilver, gold: hasFloorGeneralGold },
      defense: { pct: defenseProg, silver: hasLockdownSilver, gold: hasLockdownGold },
    },
  };
}

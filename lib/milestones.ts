import type { CareerLine, Game } from "./queries";

export type MilestoneCategory =
  | "pts"
  | "reb"
  | "ast"
  | "fg3m"
  | "stl"
  | "blk"
  | "wins"
  | "gp";

type MilestoneDef = {
  key: MilestoneCategory;
  label: string;
  unit: string;
  emoji: string;
  thresholds: number[];
  alertDistance: number;
};

const MILESTONE_DEFS: MilestoneDef[] = [
  {
    key: "pts",
    label: "Points",
    unit: "pts",
    emoji: "🏀",
    thresholds: [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000],
    alertDistance: 20,
  },
  {
    key: "reb",
    label: "Rebounds",
    unit: "reb",
    emoji: "🦍",
    thresholds: [25, 50, 75, 100, 150, 200, 300, 500],
    alertDistance: 10,
  },
  {
    key: "ast",
    label: "Assists",
    unit: "ast",
    emoji: "🪄",
    thresholds: [15, 25, 50, 75, 100, 150, 200],
    alertDistance: 8,
  },
  {
    key: "fg3m",
    label: "Threes",
    unit: "threes",
    emoji: "🎯",
    thresholds: [10, 25, 50, 75, 100],
    alertDistance: 5,
  },
  {
    key: "stl",
    label: "Steals",
    unit: "stl",
    emoji: "🥷",
    thresholds: [10, 25, 50, 75, 100],
    alertDistance: 5,
  },
  {
    key: "blk",
    label: "Blocks",
    unit: "blk",
    emoji: "🧱",
    thresholds: [10, 25, 50, 75, 100],
    alertDistance: 5,
  },
  {
    key: "wins",
    label: "Wins",
    unit: "wins",
    emoji: "🏆",
    thresholds: [10, 25, 50, 75, 100],
    alertDistance: 3,
  },
  {
    key: "gp",
    label: "Games Played",
    unit: "games",
    emoji: "👟",
    thresholds: [10, 25, 50, 75, 100],
    alertDistance: 3,
  },
];

export type UpcomingMilestone = {
  playerId: number;
  playerName: string;
  category: MilestoneCategory;
  categoryLabel: string;
  emoji: string;
  current: number;
  target: number;
  remaining: number;
  pct: number;
};

export type PlayerMilestoneProgress = {
  category: MilestoneCategory;
  categoryLabel: string;
  emoji: string;
  current: number;
  nextTarget: number;
  remaining: number;
  pct: number;
  achieved: number[];
};

/**
 * Finds players across the league who are approaching their next career milestone.
 */
export function getUpcomingMilestones(career: CareerLine[]): UpcomingMilestone[] {
  const upcoming: UpcomingMilestone[] = [];

  for (const c of career) {
    if (c.gp <= 0) continue;

    for (const def of MILESTONE_DEFS) {
      const current = Number(c[def.key] ?? 0);
      const nextTarget = def.thresholds.find((t) => t > current);
      if (!nextTarget) continue;

      const remaining = nextTarget - current;
      if (remaining <= def.alertDistance) {
        const pct = Math.min(100, Math.max(0, Math.round((current / nextTarget) * 100)));

        upcoming.push({
          playerId: c.playerId,
          playerName: c.name,
          category: def.key,
          categoryLabel: def.label,
          emoji: def.emoji,
          current,
          target: nextTarget,
          remaining,
          pct,
        });
      }
    }
  }

  // Sort by urgency: lowest remaining first
  return upcoming.sort((a, b) => a.remaining - b.remaining || a.playerName.localeCompare(b.playerName));
}

/**
 * Returns full milestone progress and achieved milestones for a specific player.
 */
export function getPlayerMilestones(c: CareerLine): PlayerMilestoneProgress[] {
  return MILESTONE_DEFS.map((def) => {
    const current = Number(c[def.key] ?? 0);
    const achieved = def.thresholds.filter((t) => t <= current);
    const nextTarget = def.thresholds.find((t) => t > current) ?? def.thresholds[def.thresholds.length - 1];
    const remaining = Math.max(0, nextTarget - current);
    // Progress toward the target shown ("150 / 200" = 75%), not just since the previous mark.
    const pct = Math.min(100, Math.max(0, Math.round((current / nextTarget) * 100)));

    return {
      category: def.key,
      categoryLabel: def.label,
      emoji: def.emoji,
      current,
      nextTarget,
      remaining,
      pct,
      achieved,
    };
  });
}

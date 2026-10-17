import type { Game } from "./queries";
import { awardPool, monthAwards, rankPool, type Spec } from "./awards";
import { clutchTotals } from "./clutch";
import { zonedTimeToMs } from "./import";
import { localDate } from "./mvp";

// Title cards. After a game session each stat leader gets a trading card with a name that sounds bigger the
// longer the stretch they led: a week, a month or a whole year. The same stat leader gets a different title
// at each level, e.g. best all-rounder: "The Chosen One" (week), "The Supreme One" (month), "The GOAT" (year).

export type Tier = "week" | "month" | "year";
export const TIERS: Tier[] = ["week", "month", "year"];

export type CatId =
  | "allround"
  | "scorer"
  | "shooter"
  | "rebounder"
  | "playmaker"
  | "stealer"
  | "blocker"
  | "clutch";

type Category = {
  id: CatId;
  /** What the stat leader is called in plain words. */
  label: string;
  emoji: string;
  /** Replaces `emoji` at a level, when a bigger picture fits. */
  tierEmoji?: Partial<Record<Tier, string>>;
  /** Titles, week then month then year: each one a step up from the last. */
  names: Record<Tier, string>;
  /** What they did, finished by "this week" / "this month" / "this year". */
  line: string;
};

export const DECK: Category[] = [
  {
    id: "allround",
    label: "All-rounder",
    emoji: "🌟",
    tierEmoji: { week: "⭐", month: "👑", year: "🐐" },
    names: { week: "The Chosen One", month: "The Supreme One", year: "The GOAT" },
    line: "Best all-round player",
  },
  {
    id: "scorer",
    label: "Scorer",
    emoji: "🔥",
    tierEmoji: { week: "🔥", month: "🌋", year: "☄️" },
    names: { week: "Flamethrower", month: "Inferno", year: "Supernova" },
    line: "Lit up the scoreboard",
  },
  {
    id: "shooter",
    label: "Shooter",
    emoji: "🎯",
    names: { week: "Sharpshooter", month: "Deadeye", year: "The Marksman" },
    line: "Most accurate shooter",
  },
  {
    id: "rebounder",
    label: "Rebounder",
    emoji: "🦍",
    names: { week: "Dominator", month: "Glass Titan", year: "The Colossus" },
    line: "Owned the boards",
  },
  {
    id: "playmaker",
    label: "Assister",
    emoji: "🪄",
    tierEmoji: { year: "🧠" },
    names: { week: "Dime Dropper", month: "Maestro", year: "The Architect" },
    line: "Set everyone up",
  },
  {
    id: "stealer",
    label: "Stealer",
    emoji: "🥷",
    names: { week: "Pickpocket", month: "Phantom Thief", year: "The Heist Master" },
    line: "Took the ball away most",
  },
  {
    id: "blocker",
    label: "Blocker",
    emoji: "🧱",
    tierEmoji: { year: "🏰" },
    names: { week: "Roadblock", month: "Great Wall", year: "The Fortress" },
    line: "Shut the paint",
  },
  {
    id: "clutch",
    label: "Clutch",
    emoji: "🧊",
    tierEmoji: { year: "🥶" },
    names: { week: "Cool Hand", month: "Ice Veins", year: "Absolute Zero" },
    line: "Delivered when it was close",
  },
];

export const TIER_LABEL: Record<Tier, string> = { week: "Week", month: "Month", year: "Year" };
/** "this week" etc, for taglines. */
export const TIER_PHRASE: Record<Tier, string> = {
  week: "this week",
  month: "this month",
  year: "this year",
};

export type AwardCardData = {
  key: string;
  tier: Tier;
  category: CatId;
  categoryLabel: string;
  title: string;
  emoji: string;
  tagline: string;
  playerId: number;
  name: string;
  /** The big number, e.g. "7.0 rpg". */
  value: string;
  /** The line under it, e.g. "14 reb (3 off)". */
  detail: string;
  periodKey: string;
  periodLabel: string;
};

// ---- the three stats the monthly awards don't cover -------------------------------------------------

const per = (n: number, gp: number) => (gp ? n / gp : 0);
const one = (n: number) => n.toFixed(1);
const games = (gp: number) => `${gp} ${gp === 1 ? "game" : "games"}`;

const EXTRA: Record<"stealer" | "blocker", Spec> = {
  stealer: {
    id: "stealer",
    title: "Stealer",
    blurb: "Most steals per game",
    score: (p) => per(p.total.stl, p.gp),
    tie: (p) => p.total.defl,
    value: (p) => `${one(per(p.total.stl, p.gp))} spg`,
    detail: (p) => `${p.total.stl} stl in ${games(p.gp)}`,
  },
  blocker: {
    id: "blocker",
    title: "Blocker",
    blurb: "Most blocks per game",
    score: (p) => per(p.total.blk, p.gp),
    tie: (p) => p.total.dreb,
    value: (p) => `${one(per(p.total.blk, p.gp))} bpg`,
    detail: (p) => `${p.total.blk} blk in ${games(p.gp)}`,
  },
};

/** Which finished-game award feeds each card that the monthly awards already work out. */
const FROM_AWARD: Partial<Record<CatId, string>> = {
  allround: "mvp",
  scorer: "scorer",
  shooter: "shooter",
  rebounder: "boards",
  playmaker: "playmaker",
};

/**
 * The stat leaders for a stretch of games (one week, month or year), as cards, in deck order. A card is
 * left out when nobody earned it (no steals, not enough games or shots, no close finishes).
 */
export function buildCards(
  periodGames: Game[],
  tier: Tier,
  period: { key: string; label: string },
): AwardCardData[] {
  const finals = periodGames.filter((g) => g.status === "final");
  const ap = awardPool(finals);
  if (!ap) return [];

  const awards = new Map(monthAwards(finals).map((a) => [a.id as string, a]));
  const out: AwardCardData[] = [];
  for (const cat of DECK) {
    let w: { playerId: number; name: string; value: string; detail: string } | null = null;
    const awardId = FROM_AWARD[cat.id];
    if (awardId) {
      w = awards.get(awardId)?.winner ?? null;
    } else if (cat.id === "stealer" || cat.id === "blocker") {
      const spec = EXTRA[cat.id];
      const top = rankPool(spec, ap)[0];
      if (top) w = { playerId: top.playerId, name: top.name, value: spec.value(top), detail: spec.detail(top) };
    } else if (cat.id === "clutch") {
      // Game-winners first, then points in clutch time. Only games with a real play order count.
      const top = clutchTotals(finals)
        .filter((c) => c.gameWinners > 0 || c.clutchPts > 0)
        .sort(
          (a, b) =>
            b.gameWinners - a.gameWinners ||
            b.clutchPts - a.clutchPts ||
            a.name.localeCompare(b.name),
        )[0];
      if (top)
        w = {
          playerId: top.playerId,
          name: top.name,
          value:
            top.gameWinners > 0
              ? `${top.gameWinners} game-winner${top.gameWinners === 1 ? "" : "s"}`
              : `${top.clutchPts} clutch pts`,
          detail: `${top.clutchPts} points when it was close`,
        };
    }
    if (!w) continue;
    out.push({
      key: `${tier}-${cat.id}`,
      tier,
      category: cat.id,
      categoryLabel: cat.label,
      title: cat.names[tier],
      emoji: cat.tierEmoji?.[tier] ?? cat.emoji,
      tagline: `${cat.line} ${TIER_PHRASE[tier]}`,
      playerId: w.playerId,
      name: w.name,
      value: w.value,
      detail: w.detail,
      periodKey: period.key,
      periodLabel: period.label,
    });
  }
  return out;
}

/** Text for a group chat, e.g. "🦍 Dominator · Rebounder of the week\nDaniel Okoye: 7.0 rpg (14 reb)". */
export function cardText(c: AwardCardData): string {
  return [
    `${c.emoji} ${c.title.toUpperCase()} · ${c.categoryLabel} of the ${c.tier}`,
    `${c.name}: ${c.value}${c.detail ? ` (${c.detail})` : ""}`,
    `Pickup League · ${c.periodLabel}`,
  ].join("\n");
}

// ---- years ------------------------------------------------------------------------------------------

export type YearPeriod = { kind: "year"; key: string; label: string; games: Game[] };

/** Finished games grouped by calendar year, newest first. */
export function groupByYear(all: Game[], timeZone: string): YearPeriod[] {
  const map = new Map<string, Game[]>();
  for (const g of all) {
    if (g.status !== "final") continue;
    const key = String(localDate(g.startMs, timeZone).y);
    map.set(key, [...(map.get(key) ?? []), g]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => ({ kind: "year", key, label: key, games: list }));
}

export const yearKey = (ms: number, timeZone: string) => String(localDate(ms, timeZone).y);

// ---- when the cards drop ----------------------------------------------------------------------------

/** The hour (league time) the day's cards are revealed. Default 3 PM, after the Saturday window has closed. */
export function cardsHour(): number {
  const n = Number(process.env.LEAGUE_CARDS_HOUR ?? 15);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 15;
}

const dayKey = (ms: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));

/**
 * Cards for the current week, month and year stay hidden on a game day until `hour`, so nobody gets the
 * spoilers while games are still being played. Any other day, and any past period, is open.
 */
export function cardsLock(
  nowMs: number,
  all: Game[],
  timeZone: string,
  hour: number = cardsHour(),
): { locked: boolean; unlockAt: number | null } {
  const today = dayKey(nowMs, timeZone);
  if (!all.some((g) => dayKey(g.startMs, timeZone) === today)) return { locked: false, unlockAt: null };
  const unlockAt = zonedTimeToMs(today, `${String(hour).padStart(2, "0")}:00`, timeZone);
  return unlockAt !== null && nowMs < unlockAt
    ? { locked: true, unlockAt }
    : { locked: false, unlockAt: null };
}

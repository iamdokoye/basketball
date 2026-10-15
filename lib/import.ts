import type { EventType, StatLine, Team } from "./stats";

// Turning per-player totals (a box score from another tracker, or an admin's edit of one) into the
// plays this app is built on. Pure logic, safe for server and client.

/** The stats an admin can type in. Each key is the play type that carries that stat. */
export const STAT_FIELDS = [
  { key: "MAKE2", label: "2PT made" },
  { key: "MISS2", label: "2PT missed" },
  { key: "MAKE3", label: "3PT made" },
  { key: "MISS3", label: "3PT missed" },
  { key: "MAKE_FT", label: "FT made" },
  { key: "MISS_FT", label: "FT missed" },
  { key: "OREB", label: "Off. reb" },
  { key: "DREB", label: "Def. reb" },
  { key: "AST", label: "Assists" },
  { key: "STL", label: "Steals" },
  { key: "BLK", label: "Blocks" },
  { key: "TOV", label: "Turnovers" },
  { key: "FOUL", label: "Fouls" },
  { key: "DEFL", label: "Deflections" },
] as const satisfies readonly { key: EventType; label: string }[];

export type StatKey = (typeof STAT_FIELDS)[number]["key"];
export type Totals = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = STAT_FIELDS.map((f) => f.key);
export const MAX_STAT = 99;

export function emptyTotals(): Totals {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Totals;
}

/** Cleans untrusted input: a whole number from 0 to MAX_STAT per stat, everything else 0. */
export function cleanTotals(raw: unknown): Totals | null {
  if (typeof raw !== "object" || raw === null) return null;
  const out = emptyTotals();
  for (const k of STAT_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > MAX_STAT) return null;
    out[k] = v as number;
  }
  return out;
}

export const pointsOf = (t: Totals) => 2 * t.MAKE2 + 3 * t.MAKE3 + t.MAKE_FT;

/** A player's current totals, as the box score derives them from the plays. */
export function totalsFromLine(l: StatLine): Totals {
  return {
    MAKE2: l.fg2m,
    MISS2: l.fg2a - l.fg2m,
    MAKE3: l.fg3m,
    MISS3: l.fg3a - l.fg3m,
    MAKE_FT: l.ftm,
    MISS_FT: l.fta - l.ftm,
    OREB: l.oreb,
    DREB: l.dreb,
    AST: l.ast,
    STL: l.stl,
    BLK: l.blk,
    TOV: l.tov,
    FOUL: l.pf,
    DEFL: l.defl,
  };
}

export type ImportPlayer = { id: number; team: Team; totals: Totals };
export type PlannedEvent = {
  /** Events with the same play number are one linked action (a make and its assist). */
  play: number;
  /** Seconds from tip-off. */
  offsetSec: number;
  playerId: number;
  type: EventType;
};

type Play = { who: number; team: Team; type: EventType; extra: { who: number; type: EventType }[] };

/**
 * Rebuilds a plausible game from totals. Every total comes out exactly; the order and timing of
 * plays are made up (spread evenly over `durationSec`), and everyone is treated as on court the whole
 * time. Assists ride on a teammate's made shot and rebounds on a missed shot where one is available,
 * so the play log reads like a live game; any that don't fit become plays of their own.
 */
export function buildPlays(
  players: ImportPlayer[],
  durationSec: number,
  rng: () => number = Math.random,
): PlannedEvent[] {
  const shuffle = <T,>(a: T[]): T[] => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const plays: Play[] = [];
  for (const p of players) {
    for (const k of STAT_KEYS) {
      if (k === "AST" || k === "OREB" || k === "DREB") continue;
      for (let i = 0; i < p.totals[k]; i++) plays.push({ who: p.id, team: p.team, type: k, extra: [] });
    }
  }

  const isMake = (t: EventType) => t === "MAKE2" || t === "MAKE3";
  const isMiss = (t: EventType) => t === "MISS2" || t === "MISS3" || t === "MISS_FT";
  const standalone: Play[] = [];

  // Assists: onto a teammate's made shot, else on their own.
  for (const p of players) {
    for (let i = 0; i < p.totals.AST; i++) {
      const target = shuffle(
        plays.filter((x) => isMake(x.type) && x.team === p.team && x.who !== p.id && !x.extra.length),
      )[0];
      if (target) target.extra.push({ who: p.id, type: "AST" });
      else standalone.push({ who: p.id, team: p.team, type: "AST", extra: [] });
    }
  }
  // Rebounds: offensive onto a teammate's miss (any miss, for a lone shooter), defensive onto an opponent's.
  for (const p of players) {
    for (const type of ["OREB", "DREB"] as const) {
      for (let i = 0; i < p.totals[type]; i++) {
        const open = plays.filter((x) => isMiss(x.type) && !x.extra.length);
        const fits =
          type === "OREB"
            ? open.filter((x) => x.team === p.team && x.who !== p.id)
            : open.filter((x) => x.team !== p.team);
        const target = shuffle(fits)[0];
        if (target) target.extra.push({ who: p.id, type });
        else standalone.push({ who: p.id, team: p.team, type, extra: [] });
      }
    }
  }

  const all = shuffle([...plays, ...standalone]);

  // End on the winning team's last basket, so the log finishes the way a real game does.
  const pts = { A: 0, B: 0 };
  for (const p of players) pts[p.team] += pointsOf(p.totals);
  if (pts.A !== pts.B) {
    const winner: Team = pts.A > pts.B ? "A" : "B";
    const last = all.findLastIndex(
      (x) => x.team === winner && (isMake(x.type) || x.type === "MAKE_FT"),
    );
    if (last >= 0) all.push(all.splice(last, 1)[0]);
  }

  const n = all.length;
  const out: PlannedEvent[] = [];
  all.forEach((x, i) => {
    const offsetSec = n > 1 ? Math.round((i * durationSec) / (n - 1)) : 0;
    for (const e of [{ who: x.who, type: x.type }, ...x.extra]) {
      out.push({ play: i + 1, offsetSec, playerId: e.who, type: e.type });
    }
  });
  return out;
}

/** Converts a wall-clock date and time in an IANA zone ("2026-10-10", "08:45", "Africa/Lagos") to epoch ms. */
export function zonedTimeToMs(date: string, time: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  if (Number.isNaN(asUtc)) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const offsetAt = (ms: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, +x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  // The zone's offset depends on the instant, so settle it in two passes (handles daylight saving).
  let guess = asUtc - offsetAt(asUtc);
  guess = asUtc - offsetAt(guess);
  return guess;
}

import type { Game } from "./queries";
import {
  aggregatePlayers,
  computeMvp,
  minGamesFor,
  type PlayerTotals,
} from "./mvp";

// Monthly awards. One player can win several. Every award needs the same minimum
// games as the MVP (half of the busiest player's), and the percentage awards also
// need real shot volume so a lucky 1-for-1 night can't win.

export type AwardId =
  | "mvp"
  | "scorer"
  | "shooter"
  | "finisher"
  | "playmaker"
  | "defender"
  | "boards"
  | "winner"
  | "impact";

export type AwardWinner = {
  playerId: number;
  name: string;
  value: string;
  detail: string;
};
export type Award = {
  id: AwardId;
  title: string;
  /** One line on how it is decided. */
  blurb: string;
  winner: AwardWinner | null;
};

export type Ctx = { minGames: number; maxFga: number; maxFg2a: number };

export type Spec = {
  id: string;
  title: string;
  blurb: string;
  eligible?: (p: PlayerTotals, ctx: Ctx) => boolean;
  /** Higher wins. Must be > 0 to win anything. */
  score: (p: PlayerTotals) => number;
  /** Tie-break, higher wins. */
  tie?: (p: PlayerTotals) => number;
  value: (p: PlayerTotals) => string;
  detail: (p: PlayerTotals) => string;
};

const per = (n: number, gp: number) => (gp ? n / gp : 0);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const one = (n: number) => n.toFixed(1);

const SPECS: Spec[] = [
  {
    id: "scorer",
    title: "Top Scorer",
    blurb: "Most points per game",
    score: (p) => per(p.total.pts, p.gp),
    value: (p) => `${one(per(p.total.pts, p.gp))} ppg`,
    detail: (p) =>
      `${p.total.pts} pts in ${p.gp} ${p.gp === 1 ? "game" : "games"}`,
  },
  {
    id: "shooter",
    title: "Best Shooter",
    blurb: "Best effective FG% (3s count extra), with real volume",
    eligible: (p, c) => p.total.fga >= Math.max(5, c.maxFga * 0.5),
    score: (p) =>
      p.total.fga ? (p.total.fgm + 0.5 * p.total.fg3m) / p.total.fga : 0,
    tie: (p) => p.total.pts,
    value: (p) =>
      `${pct((p.total.fgm + 0.5 * p.total.fg3m) / p.total.fga)} eFG`,
    detail: (p) =>
      `${p.total.fgm}/${p.total.fga} FG · ${p.total.fg3m}/${p.total.fg3a} 3P`,
  },
  {
    id: "finisher",
    title: "Best Finisher",
    blurb: "Best 2-point percentage, with real volume",
    eligible: (p, c) => p.total.fg2a >= Math.max(4, c.maxFg2a * 0.5),
    score: (p) => (p.total.fg2a ? p.total.fg2m / p.total.fg2a : 0),
    tie: (p) => p.total.fg2m,
    value: (p) => `${pct(p.total.fg2m / p.total.fg2a)} on 2s`,
    detail: (p) => `${p.total.fg2m}/${p.total.fg2a} two-pointers`,
  },
  {
    id: "playmaker",
    title: "Best Playmaker",
    blurb: "Most assists per game",
    score: (p) => per(p.total.ast, p.gp),
    tie: (p) => -p.total.tov,
    value: (p) => `${one(per(p.total.ast, p.gp))} apg`,
    detail: (p) => `${p.total.ast} ast · ${p.total.tov} tov`,
  },
  {
    id: "defender",
    title: "Best Defender",
    blurb: "Most steals + blocks + deflections per game",
    score: (p) => per(p.total.stl + p.total.blk + p.total.defl, p.gp),
    tie: (p) => p.total.dreb,
    value: (p) =>
      `${one(per(p.total.stl + p.total.blk + p.total.defl, p.gp))} stops/g`,
    detail: (p) =>
      `${p.total.stl} stl · ${p.total.blk} blk · ${p.total.defl} defl`,
  },
  {
    id: "boards",
    title: "Board Man",
    blurb: "Most rebounds per game",
    score: (p) => per(p.total.reb, p.gp),
    tie: (p) => p.total.oreb,
    value: (p) => `${one(per(p.total.reb, p.gp))} rpg`,
    detail: (p) => `${p.total.reb} reb (${p.total.oreb} off)`,
  },
  {
    id: "winner",
    title: "Winner",
    blurb: "Highest win rate",
    score: (p) => per(p.wins, p.gp),
    tie: (p) => p.wins * 1000 + p.total.pts,
    value: (p) => `${p.wins}-${p.losses}`,
    detail: (p) => `${pct(per(p.wins, p.gp))} of games won`,
  },
  {
    id: "impact",
    title: "Difference Maker",
    blurb: "Best plus/minus per game",
    score: (p) => per(p.total.plusMinus, p.gp),
    tie: (p) => p.total.plusMinus,
    value: (p) => `+${one(per(p.total.plusMinus, p.gp))} per game`,
    detail: (p) =>
      `${p.total.plusMinus > 0 ? "+" : ""}${p.total.plusMinus} total`,
  },
];

/** Display name for each award id. */
export const AWARD_TITLES: Record<AwardId, string> = {
  mvp: "MVP",
  ...(Object.fromEntries(SPECS.map((s) => [s.id, s.title])) as Record<
    Exclude<AwardId, "mvp">,
    string
  >),
};

export type AwardPool = { pool: PlayerTotals[]; ctx: Ctx };

/** Who can win an award from these games (enough games played), plus the shot-volume bars. Null if nobody played. */
export function awardPool(games: Game[]): AwardPool | null {
  const players = aggregatePlayers(games);
  if (players.length === 0) return null;
  const minGames = minGamesFor(players);
  const pool = players.filter((p) => p.gp >= minGames);
  return {
    pool,
    ctx: {
      minGames,
      maxFga: Math.max(0, ...pool.map((p) => p.total.fga)),
      maxFg2a: Math.max(0, ...pool.map((p) => p.total.fg2a)),
    },
  };
}

/** The eligible players for one award, best first. Anyone scoring 0 or less is left out. */
export function rankPool(
  spec: Pick<Spec, "eligible" | "score" | "tie">,
  { pool, ctx }: AwardPool,
): PlayerTotals[] {
  return pool
    .filter((p) => (spec.eligible ? spec.eligible(p, ctx) : true))
    .map((p) => ({ p, s: spec.score(p), t: spec.tie?.(p) ?? 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.t - a.t || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);
}

/** Awards for the finished games given (normally one calendar month). Empty if there are none. */
export function monthAwards(games: Game[]): Award[] {
  const ap = awardPool(games);
  if (!ap) return [];

  const awards: Award[] = [];

  const mvp = computeMvp(games);
  awards.push({
    id: "mvp",
    title: "MVP",
    blurb: "Best average rating across the month",
    winner: mvp
      ? {
          playerId: mvp.winner.playerId,
          name: mvp.winner.name,
          value: `${mvp.winner.rating.toFixed(1)}/10`,
          detail: `${mvp.winner.wins}-${mvp.winner.losses} in ${mvp.winner.gp} ${mvp.winner.gp === 1 ? "game" : "games"}`,
        }
      : null,
  });

  for (const spec of SPECS) {
    const top = rankPool(spec, ap)[0];
    awards.push({
      id: spec.id as Exclude<AwardId, "mvp">,
      title: spec.title,
      blurb: spec.blurb,
      winner: top
        ? {
            playerId: top.playerId,
            name: top.name,
            value: spec.value(top),
            detail: spec.detail(top),
          }
        : null,
    });
  }
  return awards;
}

/** Players with more than one award, most decorated first. */
export function multiWinners(
  awards: Award[],
): { playerId: number; name: string; count: number }[] {
  const tally = new Map<
    number,
    { playerId: number; name: string; count: number }
  >();
  for (const a of awards) {
    if (!a.winner) continue;
    const t = tally.get(a.winner.playerId) ?? {
      playerId: a.winner.playerId,
      name: a.winner.name,
      count: 0,
    };
    t.count++;
    tally.set(a.winner.playerId, t);
  }
  return [...tally.values()]
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

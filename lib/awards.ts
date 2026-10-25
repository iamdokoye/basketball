import type { Game } from "./queries";
import {
  aggregatePlayers,
  computeMvp,
  localDate,
  minGamesFor,
  quarterKey,
  type PlayerTotals,
} from "./mvp";
import { averageRating, played } from "./rating";
import { clutchTotals } from "./clutch";
import { bestTrios, dominantTrios, trioStats } from "./chemistry";

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

export const SPECS: Spec[] = [
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

// ---- Quarterly and Yearly Major Awards -------------------------------------------------------------

export type MajorAwardId =
  | "mvp"
  | "all_star_three"
  | "best_trio"
  | "team_of_year"
  | "spectacular"
  | "rookie"
  | "dpoy"
  | "sixth_man"
  | "mip"
  | "clutch";

export type MajorAward = {
  id: MajorAwardId;
  title: string;
  blurb: string;
  winner: AwardWinner | null;
  /** Present for 3-player team honors (All-Star Three, Best Trio, Team of the Year). */
  team?: { id: number; name: string }[];
  runnersUp?: { playerId: number; name: string; scoreLabel: string }[];
};

export const MAJOR_AWARD_TITLES: Record<
  MajorAwardId,
  { year: string; quarter: string }
> = {
  mvp: {
    year: "Most Valuable Player (MVP)",
    quarter: "Most Valuable Player (MVP)",
  },
  all_star_three: {
    year: "All-Star Three",
    quarter: "All-Star Three (Tournament)",
  },
  best_trio: {
    year: "Best Trio of the Year",
    quarter: "Team of the Tournament (Best Trio)",
  },
  team_of_year: {
    year: "Team of the Year",
    quarter: "Dominant Squad of the Quarter",
  },
  spectacular: {
    year: "Most Spectacular Player",
    quarter: "Most Spectacular Player",
  },
  rookie: {
    year: "Rookie of the Year",
    quarter: "Rookie of the Quarter",
  },
  dpoy: {
    year: "Defensive Player of the Year (DPOY)",
    quarter: "Defensive Player of the Quarter (DPOY)",
  },
  sixth_man: {
    year: "Sixth Man of the Year",
    quarter: "Sixth Man of the Quarter",
  },
  mip: {
    year: "Most Improved Player",
    quarter: "Most Improved Player",
  },
  clutch: {
    year: "Clutch Player of the Year",
    quarter: "Clutch Player of the Quarter",
  },
};

/**
 * Computes major basketball honors for a quarterly or yearly period:
 * MVP (champion priority), All-Star Three, Team of the Tournament/Year (Best Trio),
 * Most Spectacular Player (fan/peer voted), Rookie, DPOY, Sixth Man, MIP, and Clutch.
 */
export function computeMajorAwards(
  periodGames: Game[],
  allGames: Game[],
  periodKind: "quarter" | "year",
  timeZone: string,
  votedAwards?: {
    periodKey: string;
    awardId: string;
    playerId: number;
    notes: string;
  }[],
  playerNames?: Map<number, string>,
): MajorAward[] {
  const finals = periodGames.filter((g) => g.status === "final");
  if (finals.length === 0) return [];

  const totals = aggregatePlayers(finals);
  if (totals.length === 0) return [];

  const minGames = minGamesFor(totals);
  const sampleMs = finals[0].startMs;
  const periodYear = localDate(sampleMs, timeZone).y;
  const periodQuarterKey = quarterKey(sampleMs, timeZone);
  const currentPeriodKey = periodKind === "year" ? String(periodYear) : periodQuarterKey;
  const isYear = periodKind === "year";

  // Player career debuts (earliest game played across all games)
  const debutMap = new Map<number, number>();
  for (const g of allGames) {
    if (g.status !== "final") continue;
    for (const l of g.lines) {
      if (!played(l)) continue;
      const prev = debutMap.get(l.playerId);
      if (prev === undefined || g.startMs < prev) {
        debutMap.set(l.playerId, g.startMs);
      }
    }
  }

  const isRookie = (playerId: number): boolean => {
    const debutMs = debutMap.get(playerId);
    if (debutMs === undefined) return false;
    const debutYear = localDate(debutMs, timeZone).y;
    if (isYear) return debutYear === periodYear;
    const debutQKey = quarterKey(debutMs, timeZone);
    return debutYear === periodYear && debutQKey <= periodQuarterKey;
  };

  const awards: MajorAward[] = [];

  // 1. Most Valuable Player (MVP) - Traditional Tournament Gold-Medal / Champion Priority
  const mvp = computeMvp(finals, { championPriority: true });
  awards.push({
    id: "mvp",
    title: MAJOR_AWARD_TITLES.mvp[periodKind],
    blurb: isYear
      ? "Best average rating across the year (champion priority)"
      : "Single most outstanding player of the tournament (champion priority)",
    winner: mvp
      ? {
          playerId: mvp.winner.playerId,
          name: mvp.winner.name,
          value: `${mvp.winner.rating.toFixed(1)}/10`,
          detail: `${mvp.winner.wins}-${mvp.winner.losses} in ${mvp.winner.gp} ${mvp.winner.gp === 1 ? "game" : "games"} · ${mvp.winner.pts.toFixed(1)} ppg`,
        }
      : null,
    runnersUp: mvp?.runnersUp.map((r) => ({
      playerId: r.playerId,
      name: r.name,
      scoreLabel: `${r.rating.toFixed(1)}/10`,
    })),
  });

  // 2. All-Star Three ("Team of the Tournament" top 3 players)
  const qualifiedCandidates = totals
    .filter((p) => p.gp >= minGames)
    .map((p) => ({
      ...p,
      rating: averageRating(p.ratingSum, p.ratingW),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.wins / b.gp - a.wins / a.gp ||
        b.total.pts / b.gp - a.total.pts / a.gp ||
        a.name.localeCompare(b.name),
    );

  const top3 = qualifiedCandidates.slice(0, 3);
  awards.push({
    id: "all_star_three",
    title: MAJOR_AWARD_TITLES.all_star_three[periodKind],
    blurb: "Honoring the top 3 individual players of the entire event across all teams",
    winner:
      top3.length >= 3
        ? {
            playerId: top3[0].playerId,
            name: top3.map((c) => c.name).join(" · "),
            value: `${top3.map((c) => c.rating.toFixed(1)).join(" / ")} rating`,
            detail: "The All-Star selection honoring the top 3 overall performers",
          }
        : null,
    team: top3.map((c) => ({ id: c.playerId, name: c.name })),
    runnersUp: qualifiedCandidates.slice(3, 5).map((r) => ({
      playerId: r.playerId,
      name: r.name,
      scoreLabel: `${r.rating.toFixed(1)}/10`,
    })),
  });

  // 3. Team of the Tournament / Year (Best Trio Chemistry)
  const trios = trioStats(finals);
  const bestLineups = bestTrios(trios, finals.length >= 4 ? 2 : 1);
  const topTrio = bestLineups[0];
  awards.push({
    id: "best_trio",
    title: MAJOR_AWARD_TITLES.best_trio[periodKind],
    blurb: "Best 3-player lineup with the strongest winning chemistry on the floor",
    winner: topTrio
      ? {
          playerId: topTrio.players[0].id,
          name: topTrio.players.map((p) => p.name).join(" · "),
          value: `${Math.round((topTrio.wins / topTrio.gp) * 100)}% win rate`,
          detail: `${topTrio.wins}-${topTrio.losses} in ${topTrio.gp} games together · ${topTrio.diff >= 0 ? "+" : ""}${topTrio.diff} net pts`,
        }
      : null,
    team: topTrio ? topTrio.players : undefined,
  });

  // 4. Team of the Year (Most dominant run across multi-tournament sessions)
  if (isYear) {
    const dominantLineups = dominantTrios(trios, finals.length >= 4 ? 2 : 1);
    const dominantSquad = dominantLineups[0];
    awards.push({
      id: "team_of_year",
      title: MAJOR_AWARD_TITLES.team_of_year.year,
      blurb: "Squad with the highest point total and most dominant run during the season",
      winner: dominantSquad
        ? {
            playerId: dominantSquad.players[0].id,
            name: dominantSquad.players.map((p) => p.name).join(" · "),
            value: `${dominantSquad.pts} pts · ${dominantSquad.wins} wins`,
            detail: `${dominantSquad.wins}-${dominantSquad.losses} in ${dominantSquad.gp} games · ${dominantSquad.pts} total pts (+${dominantSquad.diff})`,
          }
        : null,
      team: dominantSquad ? dominantSquad.players : undefined,
    });
  }

  // 5. Most Spectacular Player (Peer / Fan Voted highlight mixtape)
  const votedSpectacular = votedAwards?.find(
    (v) => v.periodKey === currentPeriodKey && v.awardId === "spectacular",
  );
  awards.push({
    id: "spectacular",
    title: MAJOR_AWARD_TITLES.spectacular[periodKind],
    blurb: "Fan and peer-voted award decided by highlight mixtapes and public interaction",
    winner: votedSpectacular
      ? {
          playerId: votedSpectacular.playerId,
          name: playerNames?.get(votedSpectacular.playerId) ?? "Peer Vote Winner",
          value: "Peer Vote Winner",
          detail:
            votedSpectacular.notes ||
            "Voted most spectacular highlight mixtape by peers",
        }
      : null,
  });

  // 2. Rookie of the Year / Quarter
  const rookieCandidates = totals.filter((p) => isRookie(p.playerId));
  const maxRookieGp = Math.max(0, ...rookieCandidates.map((r) => r.gp));
  const minRookieGp = Math.max(1, Math.ceil(maxRookieGp / 2));
  const qualifiedRookies = rookieCandidates
    .filter((p) => p.gp >= minRookieGp)
    .map((p) => ({
      ...p,
      rating: averageRating(p.ratingSum, p.ratingW),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.wins / b.gp - a.wins / a.gp ||
        b.total.pts / b.gp - a.total.pts / a.gp ||
        a.name.localeCompare(b.name),
    );

  const topRookie = qualifiedRookies[0];
  awards.push({
    id: "rookie",
    title: MAJOR_AWARD_TITLES.rookie[periodKind],
    blurb: isYear
      ? "Top performing player in their debut season"
      : "Top performing rookie during the quarter",
    winner: topRookie
      ? {
          playerId: topRookie.playerId,
          name: topRookie.name,
          value: `${topRookie.rating.toFixed(1)}/10 rating`,
          detail: `${topRookie.gp} ${topRookie.gp === 1 ? "game" : "games"} · ${(topRookie.total.pts / topRookie.gp).toFixed(1)} ppg · ${(topRookie.total.reb / topRookie.gp).toFixed(1)} rpg`,
        }
      : null,
    runnersUp: qualifiedRookies.slice(1, 3).map((r) => ({
      playerId: r.playerId,
      name: r.name,
      scoreLabel: `${r.rating.toFixed(1)}/10`,
    })),
  });

  // 3. Defensive Player of the Year (DPOY)
  const pool = totals.filter((p) => p.gp >= minGames);
  const dpoyRanked = [...pool]
    .map((p) => {
      const stops = p.total.stl + p.total.blk + p.total.defl;
      const stopsPg = stops / p.gp;
      const drebPg = p.total.dreb / p.gp;
      const score = stopsPg * 2 + drebPg * 0.75;
      return { p, stops, stopsPg, drebPg, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.stopsPg - a.stopsPg ||
        b.p.total.dreb - a.p.total.dreb ||
        a.p.name.localeCompare(b.p.name),
    );

  const topDpoy = dpoyRanked[0];
  awards.push({
    id: "dpoy",
    title: MAJOR_AWARD_TITLES.dpoy[periodKind],
    blurb: "Top defensive impact across steals, blocks, deflections & boards",
    winner: topDpoy
      ? {
          playerId: topDpoy.p.playerId,
          name: topDpoy.p.name,
          value:
            topDpoy.stopsPg > 0
              ? `${topDpoy.stopsPg.toFixed(1)} stops/g`
              : `${topDpoy.drebPg.toFixed(1)} dreb/g`,
          detail: `${topDpoy.p.total.stl} stl · ${topDpoy.p.total.blk} blk · ${topDpoy.p.total.defl} defl · ${topDpoy.p.total.dreb} dreb`,
        }
      : null,
    runnersUp: dpoyRanked.slice(1, 3).map((r) => ({
      playerId: r.p.playerId,
      name: r.p.name,
      scoreLabel:
        r.stopsPg > 0
          ? `${r.stopsPg.toFixed(1)} stops/g`
          : `${r.drebPg.toFixed(1)} dreb/g`,
    })),
  });

  // 4. Sixth Man of the Year / Quarter
  const benchCounts = new Map<number, { bench: number; start: number }>();
  for (const g of finals) {
    for (const l of g.lines) {
      if (!played(l)) continue;
      const rosterEntry = g.roster.find((r) => r.id === l.playerId);
      const isStarter = rosterEntry ? rosterEntry.starter : true;
      const cur = benchCounts.get(l.playerId) ?? { bench: 0, start: 0 };
      if (isStarter) cur.start++;
      else cur.bench++;
      benchCounts.set(l.playerId, cur);
    }
  }

  const sixthMen = totals
    .filter((p) => {
      const counts = benchCounts.get(p.playerId);
      if (!counts || counts.bench === 0) return false;
      const isBenchMajority = counts.bench >= counts.start;
      const hasMinGames = counts.bench >= Math.max(1, Math.floor(minGames / 2));
      return isBenchMajority && hasMinGames;
    })
    .map((p) => ({
      p,
      counts: benchCounts.get(p.playerId)!,
      rating: averageRating(p.ratingSum, p.ratingW),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.p.wins / b.p.gp - a.p.wins / a.p.gp ||
        b.counts.bench - a.counts.bench ||
        a.p.name.localeCompare(b.p.name),
    );

  const top6th = sixthMen[0];
  awards.push({
    id: "sixth_man",
    title: MAJOR_AWARD_TITLES.sixth_man[periodKind],
    blurb: "Best performer predominantly coming off the bench",
    winner: top6th
      ? {
          playerId: top6th.p.playerId,
          name: top6th.p.name,
          value: `${top6th.rating.toFixed(1)}/10 rating`,
          detail: `${top6th.counts.bench} games off bench (${top6th.p.gp} total) · ${(top6th.p.total.pts / top6th.p.gp).toFixed(1)} ppg`,
        }
      : null,
    runnersUp: sixthMen.slice(1, 3).map((r) => ({
      playerId: r.p.playerId,
      name: r.p.name,
      scoreLabel: `${r.rating.toFixed(1)}/10`,
    })),
  });

  // 5. Most Improved Player
  const periodStartMs = Math.min(...finals.map((g) => g.startMs));
  const priorGames = allGames.filter(
    (g) => g.status === "final" && g.startMs < periodStartMs,
  );
  let topMip: {
    player: PlayerTotals;
    priorRating: number;
    currentRating: number;
    ratingGain: number;
    ptsGain: number;
  } | null = null;
  const mipRanked: {
    player: PlayerTotals;
    priorRating: number;
    currentRating: number;
    ratingGain: number;
    ptsGain: number;
  }[] = [];

  if (priorGames.length > 0) {
    const priorTotals = aggregatePlayers(priorGames);
    const priorMap = new Map(priorTotals.map((p) => [p.playerId, p]));

    const candidates = totals
      .filter((p) => p.gp >= Math.max(1, Math.floor(minGames / 2)))
      .filter((p) => !isRookie(p.playerId))
      .flatMap((p) => {
        const prior = priorMap.get(p.playerId);
        if (!prior || prior.gp < 2) return [];
        const priorRating = averageRating(prior.ratingSum, prior.ratingW);
        const currentRating = averageRating(p.ratingSum, p.ratingW);
        const ratingGain = currentRating - priorRating;
        if (ratingGain <= 0.05) return []; // Meaningful improvement
        const priorPpg = prior.total.pts / prior.gp;
        const currentPpg = p.total.pts / p.gp;
        const ptsGain = currentPpg - priorPpg;
        return [
          {
            player: p,
            priorRating,
            currentRating,
            ratingGain,
            ptsGain,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.ratingGain - a.ratingGain ||
          b.ptsGain - a.ptsGain ||
          a.player.name.localeCompare(b.player.name),
      );

    mipRanked.push(...candidates);
    topMip = candidates[0] ?? null;
  }

  awards.push({
    id: "mip",
    title: MAJOR_AWARD_TITLES.mip[periodKind],
    blurb: "Biggest rating leap compared to prior play",
    winner: topMip
      ? {
          playerId: topMip.player.playerId,
          name: topMip.player.name,
          value: `+${topMip.ratingGain.toFixed(1)} rating`,
          detail: `${topMip.priorRating.toFixed(1)} → ${topMip.currentRating.toFixed(1)}/10 (${topMip.ptsGain >= 0 ? "+" : ""}${topMip.ptsGain.toFixed(1)} ppg)`,
        }
      : null,
    runnersUp: mipRanked.slice(1, 3).map((r) => ({
      playerId: r.player.playerId,
      name: r.player.name,
      scoreLabel: `+${r.ratingGain.toFixed(1)} rating`,
    })),
  });

  // 6. Clutch Player of the Year / Quarter
  const clutches = clutchTotals(finals);
  const playerMap = new Map(totals.map((p) => [p.playerId, p]));
  const clutchRanked = clutches
    .filter((c) => c.clutchPts > 0 || c.gameWinners > 0)
    .map((c) => {
      const p = playerMap.get(c.playerId);
      const score = c.gameWinners * 100 + c.clutchPts;
      return { c, p, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.c.gameWinners - a.c.gameWinners ||
        b.c.clutchPts - a.c.clutchPts ||
        (b.p ? averageRating(b.p.ratingSum, b.p.ratingW) : 0) -
          (a.p ? averageRating(a.p.ratingSum, a.p.ratingW) : 0) ||
        a.c.name.localeCompare(b.c.name),
    );

  const topClutch = clutchRanked[0];
  awards.push({
    id: "clutch",
    title: MAJOR_AWARD_TITLES.clutch[periodKind],
    blurb: "Most clutch points and game-winners in close games",
    winner: topClutch
      ? {
          playerId: topClutch.c.playerId,
          name: topClutch.c.name,
          value:
            topClutch.c.clutchPts > 0 && topClutch.c.gameWinners > 0
              ? `${topClutch.c.clutchPts} clutch pts · ${topClutch.c.gameWinners} GW`
              : topClutch.c.clutchPts > 0
                ? `${topClutch.c.clutchPts} clutch pts`
                : `${topClutch.c.gameWinners} game-winner${topClutch.c.gameWinners === 1 ? "" : "s"}`,
          detail: [
            topClutch.c.gameWinners > 0
              ? `${topClutch.c.gameWinners} game-winner${topClutch.c.gameWinners === 1 ? "" : "s"}`
              : "",
            topClutch.c.clutchPts > 0
              ? `${topClutch.c.clutchPts} clutch pts`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : null,
    runnersUp: clutchRanked.slice(1, 3).map((r) => ({
      playerId: r.c.playerId,
      name: r.c.name,
      scoreLabel: `${r.c.clutchPts} pts${r.c.gameWinners > 0 ? ` (${r.c.gameWinners} GW)` : ""}`,
    })),
  });

  return awards;
}

/** Players with more than one major award, most decorated first. */
export function majorMultiWinners(
  awards: MajorAward[],
): { playerId: number; name: string; count: number }[] {
  const tally = new Map<
    number,
    { playerId: number; name: string; count: number }
  >();
  for (const a of awards) {
    if (a.team && a.team.length > 0) {
      for (const p of a.team) {
        const t = tally.get(p.id) ?? {
          playerId: p.id,
          name: p.name,
          count: 0,
        };
        t.count++;
        tally.set(p.id, t);
      }
    } else if (a.winner) {
      const t = tally.get(a.winner.playerId) ?? {
        playerId: a.winner.playerId,
        name: a.winner.name,
        count: 0,
      };
      t.count++;
      tally.set(a.winner.playerId, t);
    }
  }
  return [...tally.values()]
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

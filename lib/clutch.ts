import type { Game } from "./queries";
import { POINTS, type Team } from "./stats";

// Clutch time and game-winners, replayed from the play-by-play.
//
//  - Clutch time: a basket scored when the game was close (within 3) and a team was already
//    within 5 points of the target. In a game to 20 that is 15 or more, with the score within 3.
//  - Game-winner: the last basket of a game decided by 3 or fewer, scored by the winning team.
//
// Games whose play order was made up (imported from totals, or scoring edited afterwards) are
// skipped, because their "last basket" isn't real.

const CLOSE = 3;
const CLUTCH_FROM_TARGET = 5;

export type GameClutch = {
  /** Who hit the game-winner, if the game had one. */
  winnerId: number | null;
  /** Points scored in clutch time, by player. */
  clutchPts: Map<number, number>;
  /** Whether the game ever reached clutch time. */
  clutch: boolean;
};

export function gameClutch(game: Game): GameClutch | null {
  if (game.status !== "final" || game.estimatedOrder) return null;
  const team = new Map<number, Team>(game.roster.map((p) => [p.id, p.team]));
  const score: Record<Team, number> = { A: 0, B: 0 };
  const clutchPts = new Map<number, number>();
  let last: { id: number; team: Team } | null = null;
  const nearTarget = Math.max(1, game.target - CLUTCH_FROM_TARGET);

  // By time, then entry order: a play queued on a phone that lost signal arrives late but happened earlier.
  const events = [...game.events].sort((a, b) => a.at - b.at || (a.id ?? 0) - (b.id ?? 0));
  for (const e of events) {
    const pts = POINTS[e.type];
    const t = team.get(e.playerId);
    if (!pts || !t) continue;
    if (Math.max(score.A, score.B) >= nearTarget && Math.abs(score.A - score.B) <= CLOSE) {
      clutchPts.set(e.playerId, (clutchPts.get(e.playerId) ?? 0) + pts);
    }
    score[t] += pts;
    last = { id: e.playerId, team: t };
  }

  const margin = Math.abs(score.A - score.B);
  const winnerId =
    last && game.winner === last.team && margin > 0 && margin <= CLOSE ? last.id : null;
  return { winnerId, clutchPts, clutch: clutchPts.size > 0 };
}

export type ClutchLine = {
  playerId: number;
  name: string;
  gameWinners: number;
  clutchPts: number;
};

/** Game-winners and clutch points per player across the games given. Players with neither are left out. */
export function clutchTotals(games: Game[]): ClutchLine[] {
  const acc = new Map<number, ClutchLine>();
  const get = (id: number, name: string) => {
    let l = acc.get(id);
    if (!l) acc.set(id, (l = { playerId: id, name, gameWinners: 0, clutchPts: 0 }));
    return l;
  };
  for (const g of games) {
    const c = gameClutch(g);
    if (!c) continue;
    const nameOf = (id: number) => g.roster.find((p) => p.id === id)?.name ?? "";
    if (c.winnerId) get(c.winnerId, nameOf(c.winnerId)).gameWinners++;
    for (const [id, pts] of c.clutchPts) get(id, nameOf(id)).clutchPts += pts;
  }
  return [...acc.values()];
}

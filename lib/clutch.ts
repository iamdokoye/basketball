import type { Game } from "./queries";
import { POINTS, type Team } from "./stats";
import { buildClock } from "./clock";

// Clutch time and game-winners, replayed from the play-by-play.
//
//  - Clutch time in target games: a basket scored when the game was close (within 3) and a team
//    was already within 5 points of the target.
//  - Clutch time in timed games: a basket scored in the final stretch of regulation (the last
//    eighth of it, at most 5 minutes: the whole of Q4 is never clutch) or in any overtime, when the
//    score margin is within 3 points.
//  - Game-winner: in a target game, the last basket of a game decided by 3 or fewer, scored by the
//    winning team. In a timed game, the basket that put the winning team ahead for good, if it came
//    in clutch time (a late insurance basket doesn't count) and the game ended within 3.
//
// Games whose play order was made up (imported from totals, or scoring edited afterwards) are
// skipped, because their "last basket" isn't real.

const CLOSE = 3;
const CLUTCH_FROM_TARGET = 5;
/** Timed games: clutch time is the last eighth of regulation (5 minutes of a 4 x 10 game), at most 5 minutes. */
const CLUTCH_REG_SHARE = 0.125;
const CLUTCH_MAX_MS = 5 * 60 * 1000;

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
  // Timed games: the latest basket that took a team from tied/behind to ahead, in clutch time.
  const goAhead: Record<Team, number | null> = { A: null, B: null };
  const nearTarget = Math.max(1, game.target - CLUTCH_FROM_TARGET);

  const isTimed = game.gameType === "timed";
  const clock = isTimed ? buildClock(game.events, game.startMs, game.roster) : null;
  const regDuration = (game.quarterMinutes || 10) * 60 * 1000;
  const totalReg = (game.quarterCount || 4) * regDuration;
  const clutchTimeStart = Math.max(0, totalReg - Math.min(CLUTCH_MAX_MS, totalReg * CLUTCH_REG_SHARE));

  // By time, then entry order: a play queued on a phone that lost signal arrives late but happened earlier.
  const events = [...game.events].sort((a, b) => a.at - b.at || (a.id ?? 0) - (b.id ?? 0));
  for (const e of events) {
    const pts = POINTS[e.type];
    const t = team.get(e.playerId);
    if (!pts || !t) continue;

    const isClose = Math.abs(score.A - score.B) <= CLOSE;
    let isClutchMoment = false;

    if (isTimed && clock) {
      const elapsed = clock.gameMs(e.at);
      isClutchMoment = elapsed >= clutchTimeStart && isClose;
    } else {
      isClutchMoment = Math.max(score.A, score.B) >= nearTarget && isClose;
    }

    if (isClutchMoment) {
      clutchPts.set(e.playerId, (clutchPts.get(e.playerId) ?? 0) + pts);
    }
    const other: Team = t === "A" ? "B" : "A";
    const wasAhead = score[t] > score[other];
    score[t] += pts;
    if (isTimed && clock) {
      // Taking the lead: remember the scorer if it happened in clutch time. Losing it clears the other side.
      if (!wasAhead && score[t] > score[other]) {
        goAhead[t] = clock.gameMs(e.at) >= clutchTimeStart ? e.playerId : null;
      }
      if (score[other] <= score[t]) goAhead[other] = null;
    }
    last = { id: e.playerId, team: t };
  }

  const margin = Math.abs(score.A - score.B);
  let winnerId: number | null = null;
  if (margin > 0 && margin <= CLOSE) {
    if (isTimed) {
      // goAhead is cleared the moment a team is tied or behind, so what is left is the basket
      // that put the winner ahead for good.
      winnerId = game.winner ? goAhead[game.winner] : null;
    } else if (last && game.winner === last.team) {
      winnerId = last.id;
    }
  }
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

import type { Game } from "./queries";
import { computeMvp, groupByPeriod } from "./mvp";
import { gameScore, type StatLine } from "./stats";

export type RecordItem = {
  id: string;
  label: string;
  value: string;
  /** Holder, when it belongs to one player. */
  player?: { id: number; name: string };
  gameId?: number;
  /** ISO time of the game (or "" when it spans several). */
  when: string;
  detail?: string;
};

const finals = (games: Game[]) => games.filter((g) => g.status === "final");

type Stat = {
  id: string;
  label: string;
  get: (l: StatLine) => number;
  fmt?: (n: number) => string;
};
const STATS: Stat[] = [
  { id: "pts", label: "Most points in a game", get: (l) => l.pts },
  { id: "reb", label: "Most rebounds in a game", get: (l) => l.reb },
  { id: "ast", label: "Most assists in a game", get: (l) => l.ast },
  { id: "stl", label: "Most steals in a game", get: (l) => l.stl },
  { id: "blk", label: "Most blocks in a game", get: (l) => l.blk },
  { id: "fg3m", label: "Most threes in a game", get: (l) => l.fg3m },
  {
    id: "rating",
    label: "Best single-game rating",
    get: (l) => gameScore(l),
    fmt: (n) => n.toFixed(1),
  },
];

/** Individual single-game records. The first person to reach a mark keeps it on a tie. */
export function singleGameRecords(games: Game[]): RecordItem[] {
  const out: RecordItem[] = [];
  const ordered = finals(games).sort(
    (a, b) => a.startMs - b.startMs || a.id - b.id,
  );
  for (const stat of STATS) {
    let best: { v: number; line: StatLine; game: Game } | null = null;
    for (const game of ordered) {
      for (const line of game.lines) {
        const v = stat.get(line);
        if (v > 0 && (!best || v > best.v + 1e-9)) best = { v, line, game };
      }
    }
    if (best) {
      out.push({
        id: stat.id,
        label: stat.label,
        value: (stat.fmt ?? String)(best.v),
        player: { id: best.line.playerId, name: best.line.name },
        gameId: best.game.id,
        when: best.game.playedAt,
      });
    }
  }
  return out;
}

/** Biggest win and highest-scoring game. */
export function teamRecords(games: Game[]): RecordItem[] {
  const fin = finals(games).filter((g) => g.score.A + g.score.B > 0);
  if (fin.length === 0) return [];
  const names = (g: Game, t: "A" | "B") =>
    g.roster
      .filter((p) => p.team === t)
      .map((p) => p.name)
      .join(", ");

  const margin = (g: Game) => Math.abs(g.score.A - g.score.B);
  const big = fin.reduce((a, b) => (margin(b) > margin(a) ? b : a));
  const total = (g: Game) => g.score.A + g.score.B;
  const hot = fin.reduce((a, b) => (total(b) > total(a) ? b : a));
  const winner = (g: Game) => (g.score.A >= g.score.B ? "A" : "B");

  return [
    {
      id: "margin",
      label: "Biggest win",
      value: `${Math.max(big.score.A, big.score.B)}–${Math.min(big.score.A, big.score.B)}`,
      gameId: big.id,
      when: big.playedAt,
      detail: names(big, winner(big)),
    },
    {
      id: "total",
      label: "Highest-scoring game",
      value: `${total(hot)} combined`,
      gameId: hot.id,
      when: hot.playedAt,
      detail: `${hot.score.A}–${hot.score.B}`,
    },
  ];
}

export type Streak = {
  playerId: number;
  name: string;
  current: number;
  longest: number;
  games: number;
};

/** Win streaks per player across finished games they played, oldest to newest. Ties don't count as a win or break nothing (they're skipped). */
export function winStreaks(games: Game[]): Streak[] {
  const ordered = finals(games).sort(
    (a, b) => a.startMs - b.startMs || a.id - b.id,
  );
  const byPlayer = new Map<number, { name: string; results: boolean[] }>();
  for (const g of ordered) {
    for (const line of g.lines) {
      const mine = g.score[line.team];
      const theirs = g.score[line.team === "A" ? "B" : "A"];
      if (mine === theirs) continue;
      const p = byPlayer.get(line.playerId) ?? { name: line.name, results: [] };
      p.results.push(mine > theirs);
      byPlayer.set(line.playerId, p);
    }
  }
  return [...byPlayer.entries()].map(([playerId, p]) => {
    let longest = 0;
    let run = 0;
    for (const won of p.results) {
      run = won ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    return {
      playerId,
      name: p.name,
      current: run,
      longest,
      games: p.results.length,
    };
  });
}

/** Best single month by one player: the highest MVP rating across all months. */
export function bestMonthEver(
  games: Game[],
  timeZone: string,
  weekStartDay: number,
): RecordItem | null {
  let best: RecordItem | null = null;
  let bestRating = -Infinity;
  for (const month of groupByPeriod(games, "month", timeZone, weekStartDay)) {
    const mvp = computeMvp(month.games);
    if (mvp && mvp.winner.rating > bestRating) {
      bestRating = mvp.winner.rating;
      best = {
        id: "bestMonth",
        label: "Best month ever",
        value: `${mvp.winner.rating.toFixed(1)} rating`,
        player: { id: mvp.winner.playerId, name: mvp.winner.name },
        when: "",
        detail: `${month.label} · ${mvp.winner.wins}-${mvp.winner.losses} in ${mvp.winner.gp} ${mvp.winner.gp === 1 ? "game" : "games"}`,
      };
    }
  }
  return best;
}

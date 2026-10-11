import type { Game } from "./queries";

export type Mate = {
  playerId: number;
  name: string;
  gp: number;
  wins: number;
  losses: number;
};
export type Pair = {
  a: { id: number; name: string };
  b: { id: number; name: string };
  /** Games on the same team. */
  together: { gp: number; wins: number; losses: number };
  /** Games on opposite teams; wins/losses are from `a`'s point of view. */
  against: { gp: number; aWins: number; bWins: number };
};

const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

/** Every pair of players who shared a finished game, with how they did together and against each other. */
export function pairStats(games: Game[]): Pair[] {
  const pairs = new Map<string, Pair>();
  for (const g of games) {
    if (g.status !== "final" || g.score.A === g.score.B) continue;
    const winner = g.score.A > g.score.B ? "A" : "B";
    const lines = g.lines;
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        // a is always the smaller id so results have a stable point of view
        const [x, y] =
          lines[i].playerId < lines[j].playerId
            ? [lines[i], lines[j]]
            : [lines[j], lines[i]];
        const k = key(x.playerId, y.playerId);
        let p = pairs.get(k);
        if (!p) {
          p = {
            a: { id: x.playerId, name: x.name },
            b: { id: y.playerId, name: y.name },
            together: { gp: 0, wins: 0, losses: 0 },
            against: { gp: 0, aWins: 0, bWins: 0 },
          };
          pairs.set(k, p);
        }
        if (x.team === y.team) {
          p.together.gp++;
          if (x.team === winner) p.together.wins++;
          else p.together.losses++;
        } else {
          p.against.gp++;
          if (x.team === winner) p.against.aWins++;
          else p.against.bWins++;
        }
      }
    }
  }
  return [...pairs.values()];
}

const pct = (w: number, gp: number) => (gp ? w / gp : 0);

/** Duos ranked by win rate together (needs `minGames` together), then games played. */
export function bestDuos(pairs: Pair[], minGames = 2) {
  return pairs
    .filter((p) => p.together.gp >= minGames)
    .sort(
      (p, q) =>
        pct(q.together.wins, q.together.gp) -
          pct(p.together.wins, p.together.gp) ||
        q.together.gp - p.together.gp ||
        p.a.name.localeCompare(q.a.name),
    );
}

/** Rivalries: most games against each other (needs `minGames`), most one-sided shown with the record. */
export function rivalries(pairs: Pair[], minGames = 2) {
  return pairs
    .filter((p) => p.against.gp >= minGames)
    .sort(
      (p, q) =>
        q.against.gp - p.against.gp ||
        Math.abs(q.against.aWins - q.against.bWins) -
          Math.abs(p.against.aWins - p.against.bWins),
    );
}

/** One player's record with and against everyone else. Most games first. */
export function relationsFor(
  playerId: number,
  pairs: Pair[],
): { teammates: Mate[]; opponents: Mate[] } {
  const teammates: Mate[] = [];
  const opponents: Mate[] = [];
  for (const p of pairs) {
    const me = p.a.id === playerId ? "a" : p.b.id === playerId ? "b" : null;
    if (!me) continue;
    const other = me === "a" ? p.b : p.a;
    if (p.together.gp > 0) {
      teammates.push({
        playerId: other.id,
        name: other.name,
        gp: p.together.gp,
        wins: p.together.wins,
        losses: p.together.losses,
      });
    }
    if (p.against.gp > 0) {
      const wins = me === "a" ? p.against.aWins : p.against.bWins;
      opponents.push({
        playerId: other.id,
        name: other.name,
        gp: p.against.gp,
        wins,
        losses: p.against.gp - wins,
      });
    }
  }
  const sort = (a: Mate, b: Mate) =>
    b.gp - a.gp || b.wins - a.wins || a.name.localeCompare(b.name);
  return { teammates: teammates.sort(sort), opponents: opponents.sort(sort) };
}

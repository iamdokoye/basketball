import { getDb } from "./db";
import {
  boxScore,
  emptyLine,
  teamScores,
  type EventType,
  type GameEvent,
  type RosterEntry,
  type StatLine,
  type Team,
} from "./stats";

export type Player = { id: number; name: string; archived: boolean };

export type Game = {
  id: number;
  playedAt: string;
  status: "live" | "final";
  target: number;
  winBy: number;
  roster: RosterEntry[];
  events: GameEvent[];
  lines: StatLine[];
  score: Record<Team, number>;
  winner: Team | null;
};

export async function listPlayers(): Promise<Player[]> {
  const db = await getDb();
  const rs = await db.execute("SELECT id, name, archived FROM players ORDER BY name COLLATE NOCASE");
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    archived: Number(r.archived) === 1,
  }));
}

/** Loads every game with its roster, events and derived box score. Fine at friend-league scale. */
export async function listGames(): Promise<Game[]> {
  const db = await getDb();
  const [games, roster, events] = await Promise.all([
    db.execute("SELECT id, played_at, status, target, win_by FROM games ORDER BY id DESC"),
    db.execute(
      "SELECT gp.game_id, gp.team, p.id AS player_id, p.name FROM game_players gp JOIN players p ON p.id = gp.player_id ORDER BY gp.team, p.name COLLATE NOCASE",
    ),
    db.execute("SELECT id, game_id, player_id, type, grp FROM events ORDER BY id"),
  ]);

  const rosterByGame = new Map<number, RosterEntry[]>();
  for (const r of roster.rows) {
    const gid = Number(r.game_id);
    const list = rosterByGame.get(gid) ?? [];
    list.push({ id: Number(r.player_id), name: String(r.name), team: r.team as Team });
    rosterByGame.set(gid, list);
  }
  const eventsByGame = new Map<number, GameEvent[]>();
  for (const r of events.rows) {
    const gid = Number(r.game_id);
    const list = eventsByGame.get(gid) ?? [];
    list.push({
      id: Number(r.id),
      playerId: Number(r.player_id),
      type: String(r.type) as EventType,
      grp: String(r.grp),
    });
    eventsByGame.set(gid, list);
  }

  return games.rows.map((g) => {
    const id = Number(g.id);
    const rosterEntries = rosterByGame.get(id) ?? [];
    const evs = eventsByGame.get(id) ?? [];
    const lines = boxScore(rosterEntries, evs);
    const score = teamScores(lines);
    const final = String(g.status) === "final";
    return {
      id,
      playedAt: String(g.played_at),
      status: final ? "final" : "live",
      target: Number(g.target),
      winBy: Number(g.win_by),
      roster: rosterEntries,
      events: evs,
      lines,
      score,
      winner: final && score.A !== score.B ? (score.A > score.B ? "A" : "B") : null,
    } satisfies Game;
  });
}

export async function getGame(id: number): Promise<Game | null> {
  return (await listGames()).find((g) => g.id === id) ?? null;
}

export type CareerLine = StatLine & {
  gp: number;
  wins: number;
  losses: number;
  plusMinus: number;
};

/** Season/career totals per player across finished games. */
export function careerTotals(games: Game[], players: Player[]): CareerLine[] {
  const byId = new Map<number, CareerLine>();
  const get = (id: number, name: string): CareerLine => {
    let l = byId.get(id);
    if (!l) {
      l = { ...emptyLine({ id, name, team: "A" }), gp: 0, wins: 0, losses: 0, plusMinus: 0 };
      byId.set(id, l);
    }
    return l;
  };
  for (const p of players) get(p.id, p.name);

  for (const g of games) {
    if (g.status !== "final") continue;
    for (const line of g.lines) {
      const c = get(line.playerId, line.name);
      c.gp++;
      for (const k of Object.keys(line) as (keyof StatLine)[]) {
        if (typeof line[k] === "number" && k !== "playerId") {
          (c[k] as number) += line[k] as number;
        }
      }
      const mine = g.score[line.team];
      const theirs = g.score[line.team === "A" ? "B" : "A"];
      c.plusMinus += mine - theirs;
      if (mine > theirs) c.wins++;
      else if (mine < theirs) c.losses++;
    }
  }
  return [...byId.values()];
}

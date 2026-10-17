import "server-only";
import { db, fetchAll } from "./supabase";
import { gameContext, played, rateLine } from "./rating";
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

export type Player = {
  id: number;
  name: string;
  archived: boolean;
  nicknames: string[];
};

const toNicknames = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : [];

export type Game = {
  id: number;
  playedAt: string;
  startMs: number;
  status: "live" | "final";
  target: number;
  winBy: number;
  roster: RosterEntry[];
  events: GameEvent[];
  lines: StatLine[];
  score: Record<Team, number>;
  winner: Team | null;
  /** True when the order of plays was made up (imported from totals, or scoring edited later). */
  estimatedOrder: boolean;
};

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await db()
    .from("players")
    // "*" so this keeps working before the nicknames column exists
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      archived: Boolean(p.archived),
      nicknames: toNicknames(p.nicknames),
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

/** The people in one game, for the live screens to refresh when someone joins late. */
export async function getGameRoster(gameId: number): Promise<RosterEntry[]> {
  const { data, error } = await db()
    .from("game_players")
    .select("team, starter, players(*)")
    .eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Pick<RosterRow, "team" | "starter" | "players">[])
    .flatMap((r) =>
      r.players
        ? [
            {
              id: Number(r.players.id),
              name: r.players.name,
              team: r.team,
              starter: r.starter,
              nicknames: toNicknames(r.players.nicknames),
            } satisfies RosterEntry,
          ]
        : [],
    )
    .sort((a, b) => Number(b.starter) - Number(a.starter) || a.name.localeCompare(b.name));
}

type GameRow = {
  id: number;
  played_at: string;
  status: string;
  target: number;
  win_by: number;
  /** Only present once the estimated_order migration has been run. */
  estimated_order?: boolean | null;
};
type RosterRow = {
  game_id: number;
  team: Team;
  starter: boolean;
  players: { id: number; name: string; nicknames?: string[] | null } | null;
};
type EventRow = {
  id: number;
  game_id: number;
  player_id: number | null;
  type: string;
  grp: string;
  at: string;
  team?: string | null;
};

/** Loads games (all, or one) with roster, events and derived box score. */
async function loadGames(gameId?: number): Promise<Game[]> {
  const gamesQ = db()
    .from("games")
    // "*" so this keeps working before the estimated_order migration adds that column
    .select("*")
    .order("id", { ascending: false });
  const rosterQ = (from: number, to: number) => {
    let q = db()
      .from("game_players")
      .select("game_id, team, starter, players(*)", { count: "exact" });
    if (gameId) q = q.eq("game_id", gameId);
    return q.order("game_id").order("player_id").range(from, to);
  };
  const eventsQ = (from: number, to: number) => {
    // "*" so this keeps working before the clock migration adds the team column
    let q = db().from("events").select("*", { count: "exact" });
    if (gameId) q = q.eq("game_id", gameId);
    return q.order("id").range(from, to);
  };

  const [games, roster, events] = await Promise.all([
    gameId ? gamesQ.eq("id", gameId) : gamesQ,
    fetchAll<RosterRow>(rosterQ),
    fetchAll<EventRow>(eventsQ),
  ]);
  if (games.error) throw new Error(games.error.message);

  const rosterByGame = new Map<number, RosterEntry[]>();
  for (const r of roster) {
    if (!r.players) continue;
    const list = rosterByGame.get(Number(r.game_id)) ?? [];
    list.push({
      id: Number(r.players.id),
      name: r.players.name,
      team: r.team,
      starter: r.starter,
      nicknames: toNicknames(r.players.nicknames),
    });
    rosterByGame.set(Number(r.game_id), list);
  }
  for (const list of rosterByGame.values()) {
    list.sort(
      (a, b) =>
        Number(b.starter) - Number(a.starter) || a.name.localeCompare(b.name),
    );
  }

  const eventsByGame = new Map<number, GameEvent[]>();
  for (const r of events) {
    const list = eventsByGame.get(Number(r.game_id)) ?? [];
    list.push({
      id: Number(r.id),
      playerId: Number(r.player_id ?? 0),
      team: r.team === "A" || r.team === "B" ? r.team : undefined,
      type: r.type as EventType,
      grp: r.grp,
      at: new Date(r.at).getTime(),
    });
    eventsByGame.set(Number(r.game_id), list);
  }

  return (games.data as GameRow[]).map((g) => {
    const id = Number(g.id);
    const rosterEntries = rosterByGame.get(id) ?? [];
    const evs = eventsByGame.get(id) ?? [];
    const startMs = new Date(g.played_at).getTime();
    const lines = boxScore(rosterEntries, evs, startMs);
    const score = teamScores(lines);
    const final = g.status === "final";
    return {
      id,
      playedAt: g.played_at,
      startMs,
      status: final ? "final" : "live",
      target: Number(g.target),
      winBy: Number(g.win_by),
      roster: rosterEntries,
      events: evs,
      lines,
      score,
      winner:
        final && score.A !== score.B ? (score.A > score.B ? "A" : "B") : null,
      estimatedOrder: g.estimated_order === true,
    } satisfies Game;
  });
}

export const listGames = () => loadGames();

export async function getGame(id: number): Promise<Game | null> {
  if (!Number.isSafeInteger(id)) return null;
  return (await loadGames(id))[0] ?? null;
}

export type CareerLine = StatLine & {
  /** Games actually played (benched all game doesn't count). */
  gp: number;
  wins: number;
  losses: number;
  /** Sum of (per-game rating x weight) and of the weights; average rating = ratingSum / ratingW. */
  ratingSum: number;
  ratingW: number;
};

const SUMMED: (keyof StatLine)[] = [
  "pts",
  "fgm",
  "fga",
  "fg2m",
  "fg2a",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "oreb",
  "dreb",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "pf",
  "defl",
  "sec",
  "plusMinus",
];

/** Season/career totals per player across finished games. */
export function careerTotals(games: Game[], players: Player[]): CareerLine[] {
  const byId = new Map<number, CareerLine>();
  const get = (id: number, name: string): CareerLine => {
    let l = byId.get(id);
    if (!l) {
      l = {
        ...emptyLine({ id, name, team: "A" }),
        gp: 0,
        wins: 0,
        losses: 0,
        ratingSum: 0,
        ratingW: 0,
      };
      byId.set(id, l);
    }
    return l;
  };
  for (const p of players) get(p.id, p.name);

  for (const g of games) {
    if (g.status !== "final") continue;
    const ctx = gameContext(g.lines);
    for (const line of g.lines) {
      if (!played(line)) continue; // on the roster but never took the court
      const c = get(line.playerId, line.name);
      c.gp++;
      const r = rateLine(line, ctx);
      if (r) {
        c.ratingSum += r.rating * r.weight;
        c.ratingW += r.weight;
      }
      for (const k of SUMMED) (c[k] as number) += line[k] as number;
      const mine = g.score[line.team];
      const theirs = g.score[line.team === "A" ? "B" : "A"];
      if (mine > theirs) c.wins++;
      else if (mine < theirs) c.losses++;
    }
  }
  return [...byId.values()];
}

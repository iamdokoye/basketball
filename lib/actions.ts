"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { EVENT_TYPES, type EventType } from "./stats";

export async function addPlayer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO players (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET archived = 0",
    args: [name],
  });
  revalidatePath("/", "layout");
}

export async function setPlayerArchived(playerId: number, archived: boolean) {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE players SET archived = ? WHERE id = ?",
    args: [archived ? 1 : 0, playerId],
  });
  revalidatePath("/", "layout");
}

export async function createGame(input: {
  teamA: number[];
  teamB: number[];
  target: number;
  winBy: number;
}) {
  const { teamA, teamB } = input;
  const target = Math.max(1, Math.floor(input.target));
  const winBy = Math.max(1, Math.floor(input.winBy));
  if (teamA.length === 0 || teamB.length === 0) throw new Error("Each team needs a player");
  if (new Set([...teamA, ...teamB]).size !== teamA.length + teamB.length) {
    throw new Error("A player can only be on one team");
  }

  const db = await getDb();
  const tx = await db.transaction("write");
  let gameId: number;
  try {
    const rs = await tx.execute({
      sql: "INSERT INTO games (target, win_by) VALUES (?, ?)",
      args: [target, winBy],
    });
    gameId = Number(rs.lastInsertRowid);
    for (const [team, ids] of [["A", teamA], ["B", teamB]] as const) {
      for (const id of ids) {
        await tx.execute({
          sql: "INSERT INTO game_players (game_id, player_id, team) VALUES (?, ?, ?)",
          args: [gameId, id, team],
        });
      }
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
  revalidatePath("/", "layout");
  redirect(`/games/${gameId}`);
}

/** Records one scorekeeper action (one or more linked events) as a group. */
export async function recordGroup(
  gameId: number,
  grp: string,
  events: { playerId: number; type: EventType }[],
) {
  if (events.length === 0) return;
  const db = await getDb();

  const game = await db.execute({ sql: "SELECT status FROM games WHERE id = ?", args: [gameId] });
  if (game.rows.length === 0 || String(game.rows[0].status) !== "live") {
    throw new Error("Game is not live");
  }
  const roster = await db.execute({
    sql: "SELECT player_id FROM game_players WHERE game_id = ?",
    args: [gameId],
  });
  const inGame = new Set(roster.rows.map((r) => Number(r.player_id)));
  for (const e of events) {
    if (!inGame.has(e.playerId)) throw new Error("Player is not in this game");
    if (!EVENT_TYPES.includes(e.type)) throw new Error(`Unknown event type ${e.type}`);
  }

  await db.batch(
    events.map((e) => ({
      sql: "INSERT INTO events (game_id, player_id, type, grp) VALUES (?, ?, ?, ?)",
      args: [gameId, e.playerId, e.type, grp],
    })),
    "write",
  );
}

export async function undoGroup(gameId: number, grp: string) {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM events WHERE game_id = ? AND grp = ?",
    args: [gameId, grp],
  });
}

export async function finishGame(gameId: number) {
  const db = await getDb();
  await db.execute({ sql: "UPDATE games SET status = 'final' WHERE id = ?", args: [gameId] });
  revalidatePath("/", "layout");
}

export async function reopenGame(gameId: number) {
  const db = await getDb();
  await db.execute({ sql: "UPDATE games SET status = 'live' WHERE id = ?", args: [gameId] });
  revalidatePath("/", "layout");
}

export async function deleteGame(gameId: number) {
  const db = await getDb();
  await db.batch(
    [
      { sql: "DELETE FROM events WHERE game_id = ?", args: [gameId] },
      { sql: "DELETE FROM game_players WHERE game_id = ?", args: [gameId] },
      { sql: "DELETE FROM games WHERE id = ?", args: [gameId] },
    ],
    "write",
  );
  revalidatePath("/", "layout");
  redirect("/games");
}

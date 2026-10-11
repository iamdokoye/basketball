"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { EVENT_TYPES, type EventType } from "./stats";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function addPlayer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) return;
  const { error } = await db().from("players").insert({ name });
  if (error) {
    // Unique violation: the player exists (possibly archived), so bring them back.
    if (error.code === "23505") {
      const { error: e2 } = await db().from("players").update({ archived: false }).ilike("name", name);
      check(e2);
    } else {
      check(error);
    }
  }
  revalidatePath("/", "layout");
}

export type RenameResult = { ok: true } | { ok: false; error: string };

/** Renames a player everywhere (games read names from the player record). */
export async function renamePlayer(playerId: number, rawName: string): Promise<RenameResult> {
  const name = rawName.trim().slice(0, 40);
  if (!name) return { ok: false, error: "Name can't be empty." };

  const { error } = await db().from("players").update({ name }).eq("id", playerId);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Another player already has that name." : "Couldn't save the name. Try again.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlayerArchived(playerId: number, archived: boolean) {
  check((await db().from("players").update({ archived }).eq("id", playerId)).error);
  revalidatePath("/", "layout");
}

export async function createGame(input: {
  players: { id: number; team: "A" | "B"; starter: boolean }[];
  target: number;
  winBy: number;
}) {
  const target = Math.max(1, Math.floor(input.target));
  const winBy = Math.max(1, Math.floor(input.winBy));
  const { players } = input;
  const ids = players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("A player can only be on one team");
  for (const team of ["A", "B"] as const) {
    if (!players.some((p) => p.team === team && p.starter)) {
      throw new Error("Each team needs at least one starter");
    }
  }

  const { data, error } = await db().rpc("create_game", {
    p_target: target,
    p_win_by: winBy,
    p_players: players,
  });
  check(error);
  revalidatePath("/", "layout");
  redirect(`/games/${Number(data)}`);
}

/** Records one scorekeeper action (one or more linked events) as a group. */
export async function recordGroup(
  gameId: number,
  grp: string,
  at: number,
  events: { playerId: number; type: EventType }[],
) {
  if (events.length === 0) return;

  const game = await db().from("games").select("status").eq("id", gameId).maybeSingle();
  check(game.error);
  if (game.data?.status !== "live") throw new Error("Game is not live");

  const roster = await db().from("game_players").select("player_id").eq("game_id", gameId);
  check(roster.error);
  const inGame = new Set((roster.data ?? []).map((r) => Number(r.player_id)));
  for (const e of events) {
    if (!inGame.has(e.playerId)) throw new Error("Player is not in this game");
    if (!EVENT_TYPES.includes(e.type)) throw new Error(`Unknown event type ${e.type}`);
  }

  const when = new Date(Number.isFinite(at) ? at : Date.now()).toISOString();
  const { error } = await db()
    .from("events")
    .insert(events.map((e) => ({ game_id: gameId, player_id: e.playerId, type: e.type, grp, at: when })));
  check(error);
}

export async function undoGroup(gameId: number, grp: string) {
  check((await db().from("events").delete().eq("game_id", gameId).eq("grp", grp)).error);
}

async function setStatus(gameId: number, status: "live" | "final") {
  check((await db().from("games").update({ status }).eq("id", gameId)).error);
  revalidatePath("/", "layout");
}

export async function finishGame(gameId: number) {
  await setStatus(gameId, "final");
}

export async function reopenGame(gameId: number) {
  await setStatus(gameId, "live");
}

export async function deleteGame(gameId: number) {
  // events and game_players cascade
  check((await db().from("games").delete().eq("id", gameId)).error);
  revalidatePath("/", "layout");
  redirect("/games");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endAdminSession, getAccess, startAdminSession } from "./access";
import { db } from "./supabase";
import { EVENT_TYPES, type EventType } from "./stats";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const GENERIC = "Something went wrong. Try again.";

// ---- Permission guards (server-side; the UI only mirrors these) -----------

/** Scoring actions: open to everyone during the window, otherwise admin only. */
async function needPlay(): Promise<ActionResult | null> {
  const a = await getAccess();
  if (a.canPlay) return null;
  return fail(`Editing is closed. Scoring opens ${a.windowLabel}, or sign in as admin.`);
}

/** Roster management, reopening and deleting: admin only, any time. */
async function needAdmin(): Promise<ActionResult | null> {
  return (await getAccess()).isAdmin ? null : fail("Admin password required.");
}

const isId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Admin sign in / out ---------------------------------------------------

export type LoginState = { error?: string } | undefined;

export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const access = await getAccess();
  if (!access.adminConfigured) return { error: "Admin sign-in isn't set up (ADMIN_PASSWORD is missing)." };

  const ok = checkPassword(String(formData.get("password") ?? ""));
  if (!ok) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 900));
    return { error: "Wrong password." };
  }
  await startAdminSession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function adminLogout(): Promise<void> {
  await endAdminSession();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---- Players ---------------------------------------------------------------

/** Adds a player (or restores an archived one with the same name). Open during the window. */
export async function addPlayer(rawName: string): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;

  const name = String(rawName ?? "").trim().slice(0, 40);
  if (!name) return fail("Name can't be empty.");

  const { error } = await db().from("players").insert({ name });
  if (error) {
    // Unique violation: the player exists (possibly archived), so bring them back.
    if (error.code !== "23505") return fail("Couldn't add the player. Try again.");
    const { error: e2 } = await db().from("players").update({ archived: false }).ilike("name", name);
    if (e2) return fail("Couldn't add the player. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Renames a player everywhere (games read names from the player record). Admin only. */
export async function renamePlayer(playerId: number, rawName: string): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(playerId)) return fail(GENERIC);

  const name = String(rawName ?? "").trim().slice(0, 40);
  if (!name) return fail("Name can't be empty.");

  const { error } = await db().from("players").update({ name }).eq("id", playerId);
  if (error) {
    return fail(error.code === "23505" ? "Another player already has that name." : "Couldn't save the name. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlayerArchived(playerId: number, archived: boolean): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(playerId)) return fail(GENERIC);

  const { error } = await db().from("players").update({ archived: Boolean(archived) }).eq("id", playerId);
  if (error) return fail(GENERIC);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---- Games -----------------------------------------------------------------

/** Starts a game. On success this redirects; it only returns when something is wrong. */
export async function createGame(input: {
  players: { id: number; team: "A" | "B"; starter: boolean }[];
  target: number;
  winBy: number;
}): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;

  const target = Math.min(100, Math.max(1, Math.floor(Number(input.target)) || 20));
  const winBy = Math.min(5, Math.max(1, Math.floor(Number(input.winBy)) || 1));
  const players = (input.players ?? []).map((p) => ({
    id: p.id,
    team: p.team === "B" ? "B" : "A",
    starter: Boolean(p.starter),
  }));
  if (players.length > 12 || !players.every((p) => isId(p.id))) return fail(GENERIC);
  if (new Set(players.map((p) => p.id)).size !== players.length) return fail("A player can only be on one team.");
  for (const team of ["A", "B"] as const) {
    if (!players.some((p) => p.team === team && p.starter)) return fail("Each team needs at least one starter.");
  }

  const { data, error } = await db().rpc("create_game", {
    p_target: target,
    p_win_by: winBy,
    p_players: players,
  });
  if (error) return fail("Couldn't start the game. Try again.");
  revalidatePath("/", "layout");
  redirect(`/games/${Number(data)}`);
}

/** Records one scorekeeper action (one or more linked events) as a group. */
export async function recordGroup(
  gameId: number,
  grp: string,
  at: number,
  events: { playerId: number; type: EventType }[],
): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;
  if (!isId(gameId) || !UUID.test(grp) || !Array.isArray(events) || events.length === 0 || events.length > 8) {
    return fail(GENERIC);
  }

  const game = await db().from("games").select("status").eq("id", gameId).maybeSingle();
  if (game.error) return fail(GENERIC);
  if (game.data?.status !== "live") return fail("This game is finished.");

  const roster = await db().from("game_players").select("player_id").eq("game_id", gameId);
  if (roster.error) return fail(GENERIC);
  const inGame = new Set((roster.data ?? []).map((r) => Number(r.player_id)));
  for (const e of events) {
    if (!inGame.has(e.playerId) || !EVENT_TYPES.includes(e.type)) return fail(GENERIC);
  }

  const when = new Date(Number.isFinite(at) ? at : Date.now()).toISOString();
  const { error } = await db()
    .from("events")
    .insert(events.map((e) => ({ game_id: gameId, player_id: e.playerId, type: e.type, grp, at: when })));
  return error ? fail(GENERIC) : { ok: true };
}

export async function undoGroup(gameId: number, grp: string): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;
  if (!isId(gameId) || !UUID.test(grp)) return fail(GENERIC);

  const { error } = await db().from("events").delete().eq("game_id", gameId).eq("grp", grp);
  return error ? fail(GENERIC) : { ok: true };
}

async function setStatus(gameId: number, status: "live" | "final"): Promise<ActionResult> {
  if (!isId(gameId)) return fail(GENERIC);
  const { error } = await db().from("games").update({ status }).eq("id", gameId);
  if (error) return fail(GENERIC);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function finishGame(gameId: number): Promise<ActionResult> {
  return (await needPlay()) ?? setStatus(gameId, "final");
}

export async function reopenGame(gameId: number): Promise<ActionResult> {
  return (await needAdmin()) ?? setStatus(gameId, "live");
}

/** Deletes a game and its stats (events and roster cascade). Redirects on success. */
export async function deleteGame(gameId: number): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(gameId)) return fail(GENERIC);

  const { error } = await db().from("games").delete().eq("id", gameId);
  if (error) return fail(GENERIC);
  revalidatePath("/", "layout");
  redirect("/games");
}

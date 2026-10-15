"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkPassword,
  endAdminSession,
  getAccess,
  startAdminSession,
} from "./access";
import { db } from "./supabase";
import { CLOCK_TYPES, EVENT_TYPES, type EventType } from "./stats";
import { leagueTimeZone } from "./format";
import {
  buildPlays,
  cleanTotals,
  pointsOf,
  STAT_KEYS,
  zonedTimeToMs,
  type Totals,
} from "./import";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const GENERIC = "Something went wrong. Try again.";
const NEEDS_CLOCK_UPDATE =
  "The game clock and timeouts need a one-time database update. Run the newest SQL file in supabase/migrations (see the README).";

// ---- Permission guards (server-side; the UI only mirrors these) -----------

/** Scoring actions: open to everyone during the window, otherwise admin only. */
async function needPlay(): Promise<ActionResult | null> {
  const a = await getAccess();
  if (a.canPlay) return null;
  return fail(
    `Editing is closed. Scoring opens ${a.windowLabel}, or sign in as admin.`,
  );
}

/** Roster management, reopening and deleting: admin only, any time. */
async function needAdmin(): Promise<ActionResult | null> {
  return (await getAccess()).isAdmin ? null : fail("Admin password required.");
}

const isId = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) > 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Admin sign in / out ---------------------------------------------------

export type LoginState = { error?: string } | undefined;

export async function adminLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const access = await getAccess();
  if (!access.adminConfigured)
    return { error: "Admin sign-in isn't set up (ADMIN_PASSWORD is missing)." };

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

  const name = String(rawName ?? "")
    .trim()
    .slice(0, 40);
  if (!name) return fail("Name can't be empty.");

  const { error } = await db().from("players").insert({ name });
  if (error) {
    // Unique violation: the player exists (possibly archived), so bring them back.
    if (error.code !== "23505")
      return fail("Couldn't add the player. Try again.");
    const { error: e2 } = await db()
      .from("players")
      .update({ archived: false })
      .ilike("name", name);
    if (e2) return fail("Couldn't add the player. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Renames a player everywhere (games read names from the player record). Admin only. */
export async function renamePlayer(
  playerId: number,
  rawName: string,
): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(playerId)) return fail(GENERIC);

  const name = String(rawName ?? "")
    .trim()
    .slice(0, 40);
  if (!name) return fail("Name can't be empty.");

  const { error } = await db()
    .from("players")
    .update({ name })
    .eq("id", playerId);
  if (error) {
    return fail(
      error.code === "23505"
        ? "Another player already has that name."
        : "Couldn't save the name. Try again.",
    );
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlayerArchived(
  playerId: number,
  archived: boolean,
): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(playerId)) return fail(GENERIC);

  const { error } = await db()
    .from("players")
    .update({ archived: Boolean(archived) })
    .eq("id", playerId);
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

  const target = Math.min(
    100,
    Math.max(1, Math.floor(Number(input.target)) || 20),
  );
  const winBy = Math.min(5, Math.max(1, Math.floor(Number(input.winBy)) || 1));
  const players = (input.players ?? []).map((p) => ({
    id: p.id,
    team: p.team === "B" ? "B" : "A",
    starter: Boolean(p.starter),
  }));
  if (players.length > 12 || !players.every((p) => isId(p.id)))
    return fail(GENERIC);
  if (new Set(players.map((p) => p.id)).size !== players.length)
    return fail("A player can only be on one team.");
  for (const team of ["A", "B"] as const) {
    if (!players.some((p) => p.team === team && p.starter))
      return fail("Each team needs at least one starter.");
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
  events: { playerId: number; type: EventType; team?: "A" | "B" }[],
): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;
  if (
    !isId(gameId) ||
    !UUID.test(grp) ||
    !Array.isArray(events) ||
    events.length === 0 ||
    events.length > 8
  ) {
    return fail(GENERIC);
  }

  const when = new Date(Number.isFinite(at) ? at : Date.now()).toISOString();
  const isClock = (t: string) => (CLOCK_TYPES as readonly string[]).includes(t);
  for (const e of events) {
    if (!EVENT_TYPES.includes(e.type)) return fail(GENERIC);
    if (e.team !== undefined && e.team !== "A" && e.team !== "B")
      return fail(GENERIC);
    if (isClock(e.type)) {
      // Pause, resume and team timeouts name no player (0); a timeout must say who called it.
      if (e.playerId !== 0 && !isId(e.playerId)) return fail(GENERIC);
      if (e.type === "TIMEOUT" && !e.playerId && !e.team) return fail(GENERIC);
    } else if (!isId(e.playerId)) {
      return fail(GENERIC);
    }
  }
  const hasClock = events.some((e) => isClock(e.type));

  // Fast path: one database function does every check and the insert in a single round trip.
  const rpc = await db().rpc("record_group", {
    p_game_id: gameId,
    p_grp: grp,
    p_at: when,
    p_events: events.map((e) => ({
      player_id: e.playerId || null,
      type: e.type,
      team: e.team ?? null,
    })),
  });
  if (!rpc.error) {
    switch (rpc.data) {
      case "ok":
        return { ok: true };
      case "not_live":
        return fail("This game is finished.");
      case "bad_player":
        // The older function can't take a clock play with no player: the update hasn't been run.
        return fail(hasClock ? NEEDS_CLOCK_UPDATE : GENERIC);
      default:
        return fail(GENERIC);
    }
  }
  // The table refused a clock play (old CHECK constraints or missing columns): update not run yet.
  if (hasClock && ["23514", "23502", "42703"].includes(rpc.error.code ?? ""))
    return fail(NEEDS_CLOCK_UPDATE);
  // PGRST202 / 42883: the function isn't installed yet (migration not run), so use the
  // slower path below and keep working.
  if (rpc.error.code !== "PGRST202" && rpc.error.code !== "42883")
    return fail(GENERIC);

  const game = await db()
    .from("games")
    .select("status")
    .eq("id", gameId)
    .maybeSingle();
  if (game.error) return fail(GENERIC);
  if (game.data?.status !== "live") return fail("This game is finished.");

  const roster = await db()
    .from("game_players")
    .select("player_id")
    .eq("game_id", gameId);
  if (roster.error) return fail(GENERIC);
  const inGame = new Set((roster.data ?? []).map((r) => Number(r.player_id)));
  if (!events.every((e) => !e.playerId || inGame.has(e.playerId)))
    return fail(GENERIC);

  // Idempotent like the function: a re-sent group is not recorded twice.
  const dup = await db()
    .from("events")
    .select("id")
    .eq("game_id", gameId)
    .eq("grp", grp)
    .limit(1);
  if (dup.error) return fail(GENERIC);
  if ((dup.data ?? []).length > 0) return { ok: true };

  const { error } = await db()
    .from("events")
    .insert(
      events.map((e) => ({
        game_id: gameId,
        player_id: e.playerId || null,
        type: e.type,
        grp,
        at: when,
        // only sent when set, so ordinary plays still save before the migration adds this column
        ...(e.team ? { team: e.team } : {}),
      })),
    );
  if (error)
    return fail(
      hasClock && ["23514", "23502", "42703"].includes(error.code ?? "")
        ? NEEDS_CLOCK_UPDATE
        : GENERIC,
    );
  return { ok: true };
}

export async function undoGroup(
  gameId: number,
  grp: string,
): Promise<ActionResult> {
  const denied = await needPlay();
  if (denied) return denied;
  if (!isId(gameId) || !UUID.test(grp)) return fail(GENERIC);

  const { error } = await db()
    .from("events")
    .delete()
    .eq("game_id", gameId)
    .eq("grp", grp);
  return error ? fail(GENERIC) : { ok: true };
}

async function setStatus(
  gameId: number,
  status: "live" | "final",
): Promise<ActionResult> {
  if (!isId(gameId)) return fail(GENERIC);
  const { error } = await db()
    .from("games")
    .update({ status })
    .eq("id", gameId);
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

// ---- Admin: import a past game, edit a finished box score ------------------

/**
 * Adds a finished game from per-player totals (for a game that was tracked somewhere else). The plays
 * are rebuilt from the totals: every number matches, the order and timing are made up. Admin only.
 * On success this redirects to the new game; it only returns when something is wrong.
 */
export async function importGame(input: {
  /** "YYYY-MM-DD" and "HH:MM" in the league's timezone. */
  date: string;
  time: string;
  minutes: number;
  target: number;
  winBy: number;
  players: { id: number; team: "A" | "B"; totals: Record<string, number> }[];
}): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;

  const startMs = zonedTimeToMs(
    String(input?.date ?? ""),
    String(input?.time ?? ""),
    leagueTimeZone(),
  );
  if (startMs === null) return fail("Pick the date and start time of the game.");
  if (startMs > Date.now() + 24 * 3600_000)
    return fail("That date is in the future.");
  if (startMs < Date.UTC(2020, 0, 1)) return fail("That date looks wrong.");

  const minutes = Math.floor(Number(input.minutes));
  if (!(minutes >= 1 && minutes <= 120))
    return fail("Game length must be between 1 and 120 minutes.");
  const target = Math.min(
    100,
    Math.max(1, Math.floor(Number(input.target)) || 20),
  );
  const winBy = Math.min(5, Math.max(1, Math.floor(Number(input.winBy)) || 1));

  const raw = Array.isArray(input.players) ? input.players : [];
  if (raw.length < 2 || raw.length > 12)
    return fail("Add between 2 and 12 players.");
  const players: { id: number; team: "A" | "B"; totals: Totals }[] = [];
  for (const p of raw) {
    const totals = cleanTotals(p?.totals);
    if (!isId(p?.id) || (p.team !== "A" && p.team !== "B") || !totals)
      return fail(
        "Check the numbers: each stat must be a whole number from 0 to 99.",
      );
    players.push({ id: p.id, team: p.team, totals });
  }
  if (new Set(players.map((p) => p.id)).size !== players.length)
    return fail("A player can only be on one team.");
  for (const t of ["A", "B"] as const) {
    if (!players.some((p) => p.team === t))
      return fail("Each team needs at least one player.");
  }
  const score = { A: 0, B: 0 };
  for (const p of players) score[p.team] += pointsOf(p.totals);
  if (score.A === score.B)
    return fail("The score is tied. A finished game needs a winner.");

  const planned = buildPlays(players, minutes * 60);
  const grpOf = new Map<number, string>();
  for (const e of planned)
    if (!grpOf.has(e.play)) grpOf.set(e.play, randomUUID());

  const created = await db()
    .from("games")
    .insert({
      played_at: new Date(startMs).toISOString(),
      status: "final",
      target,
      win_by: winBy,
    })
    .select("id")
    .single();
  if (created.error || !created.data)
    return fail("Couldn't save the game. Try again.");
  const gameId = Number(created.data.id);

  // The game is made in steps, so remove it again if a later step fails rather than leave half a game.
  const undo = async () => {
    await db().from("games").delete().eq("id", gameId);
  };
  const roster = await db()
    .from("game_players")
    .insert(
      players.map((p) => ({
        game_id: gameId,
        player_id: p.id,
        team: p.team,
        starter: true,
      })),
    );
  if (roster.error) {
    await undo();
    return fail("Couldn't save the game. Check the players and try again.");
  }
  const rows = planned.map((e) => ({
    game_id: gameId,
    player_id: e.playerId,
    type: e.type,
    grp: grpOf.get(e.play)!,
    at: new Date(startMs + e.offsetSec * 1000).toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db()
      .from("events")
      .insert(rows.slice(i, i + 500));
    if (error) {
      await undo();
      return fail("Couldn't save the plays. Try again.");
    }
  }
  revalidatePath("/", "layout");
  redirect(`/games/${gameId}`);
}

/**
 * Sets a finished game's per-player totals directly. Compares each number with what the plays add up
 * to now: a higher number adds plays, a lower one removes that player's most recent plays of that kind.
 * Added plays are stamped at the end of the game. Admin only.
 */
export async function adjustBoxScore(
  gameId: number,
  edits: { playerId: number; totals: Record<string, number> }[],
): Promise<ActionResult> {
  const denied = await needAdmin();
  if (denied) return denied;
  if (!isId(gameId) || !Array.isArray(edits)) return fail(GENERIC);

  const game = await db()
    .from("games")
    .select("status, played_at")
    .eq("id", gameId)
    .maybeSingle();
  if (game.error || !game.data) return fail(GENERIC);
  if (game.data.status !== "final")
    return fail("Only a finished game can be edited this way.");

  const roster = await db()
    .from("game_players")
    .select("player_id")
    .eq("game_id", gameId);
  if (roster.error) return fail(GENERIC);
  const inGame = new Set((roster.data ?? []).map((r) => Number(r.player_id)));

  const wanted = new Map<number, Totals>();
  for (const e of edits) {
    const totals = cleanTotals(e?.totals);
    if (!isId(e?.playerId) || !inGame.has(e.playerId) || !totals)
      return fail(
        "Check the numbers: each stat must be a whole number from 0 to 99.",
      );
    wanted.set(e.playerId, totals);
  }

  const events = await db()
    .from("events")
    .select("id, player_id, type, at")
    .eq("game_id", gameId)
    .order("id", { ascending: false });
  if (events.error) return fail(GENERIC);
  const existing = events.data ?? [];

  // New plays go at the end of the game: after the last play, or the start time if there are none.
  const endAt = existing.length
    ? existing.reduce(
        (m, e) => Math.max(m, new Date(e.at as string).getTime()),
        0,
      )
    : new Date(game.data.played_at as string).getTime();

  const add: {
    game_id: number;
    player_id: number;
    type: string;
    grp: string;
    at: string;
  }[] = [];
  const remove: number[] = [];
  for (const [playerId, totals] of wanted) {
    for (const key of STAT_KEYS) {
      // Newest first, because the events came back in descending id order.
      const have = existing.filter(
        (e) => Number(e.player_id) === playerId && e.type === key,
      );
      const delta = totals[key] - have.length;
      for (let i = 0; i < delta; i++)
        add.push({
          game_id: gameId,
          player_id: playerId,
          type: key,
          grp: randomUUID(),
          at: new Date(endAt).toISOString(),
        });
      for (let i = 0; i < -delta; i++) remove.push(Number(have[i].id));
    }
  }
  if (add.length === 0 && remove.length === 0) return { ok: true };

  // Add before removing, so a failure part-way never loses plays.
  if (add.length) {
    const { error } = await db().from("events").insert(add);
    if (error) return fail("Couldn't save the changes. Try again.");
  }
  if (remove.length) {
    const { error } = await db()
      .from("events")
      .delete()
      .eq("game_id", gameId)
      .in("id", remove);
    if (error) return fail("Couldn't save the changes. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

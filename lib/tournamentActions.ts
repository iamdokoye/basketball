"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "./access";
import { db } from "./supabase";
import type { TournamentState } from "./tournaments";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Reads the current active tournament from the database, or null if none or table not yet created. */
export async function getActiveTournament(): Promise<TournamentState | null> {
  try {
    const { data, error } = await db()
      .from("tournaments")
      .select("state")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.state as TournamentState;
  } catch {
    // If table doesn't exist yet in Supabase, return null (falls back to local storage)
    return null;
  }
}

/** Saves the tournament to Postgres. Open during the Saturday scoring window or for admin. */
export async function saveTournament(
  state: TournamentState,
): Promise<ActionResult> {
  const access = await getAccess();
  if (!access.canPlay) {
    return fail(
      `Editing is closed. Scoring opens ${access.windowLabel}, or sign in as admin.`,
    );
  }

  try {
    const { error } = await db().from("tournaments").upsert({
      id: state.id,
      name: state.name,
      format: state.format,
      status: state.status,
      state: state,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return fail("Couldn't save tournament to cloud. Saved on phone.");
    }

    revalidatePath("/tournaments");
    return { ok: true };
  } catch {
    return fail("Database table not ready. Saved on phone.");
  }
}

/** Resets or deletes a tournament. Open during scoring window or for admin. */
export async function resetTournament(id: string): Promise<ActionResult> {
  const access = await getAccess();
  if (!access.canPlay) return fail("Permission denied.");

  try {
    await db().from("tournaments").delete().eq("id", id);
    revalidatePath("/tournaments");
    return { ok: true };
  } catch {
    return fail("Couldn't reset tournament.");
  }
}

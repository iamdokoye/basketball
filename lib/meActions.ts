"use server";

import { revalidatePath } from "next/cache";
import { endMe, isActivePlayer, readMe, startMe } from "./identity";
import type { ActionResult } from "./actions";

/** Remember this device as `playerId`. Open to everyone: it only personalises what they see. */
export async function claimPlayer(playerId: number): Promise<ActionResult> {
  if (!(await isActivePlayer(playerId)))
    return { ok: false, error: "That player isn't available." };
  await startMe(playerId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Not you?": forget who this device is. */
export async function releasePlayer(): Promise<ActionResult> {
  await endMe();
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Keeps the identity alive across browser quirks. Called by IdentitySync only when needed:
 *  - the cookie is getting old: issue a fresh 400-day one for the same player, or
 *  - the cookie is gone but this browser's local backup remembers who it was: restore it.
 * Returns who the device is afterwards (null if neither works, e.g. the player was archived).
 */
export async function syncMe(
  backupId: number | null,
): Promise<{ playerId: number | null }> {
  const current = await readMe();
  if (current && (await isActivePlayer(current.playerId))) {
    await startMe(current.playerId);
    return { playerId: current.playerId };
  }
  if (backupId !== null && (await isActivePlayer(backupId))) {
    await startMe(backupId);
    revalidatePath("/", "layout");
    return { playerId: backupId };
  }
  return { playerId: null };
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./supabase";
import { ME_COOKIE, ME_MAX_AGE_S } from "./identityShared";

/**
 * "Which player is this device?" There are no accounts, so a player picks their own name once and
 * this cookie remembers it. It is for personalisation only (a personal feed and profile page): the
 * stats it shows are public anyway, and it grants no extra permissions. Scoring and admin rights
 * still come from lib/access.ts.
 *
 * The cookie is `<playerId>.<issuedAtMs>.<hmac>`. Signing stops a hand-edited cookie from pointing
 * at an arbitrary id; it is not a secret, since anyone can pick any name.
 */

/** Key derived from a server secret. Falls back through the secrets the app already needs. */
function key(): Buffer | null {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.ADMIN_PASSWORD;
  return secret
    ? createHash("sha256").update(`pickup-league-me:${secret}`).digest()
    : null;
}

const sign = (body: string, k: Buffer) =>
  createHmac("sha256", k).update(body).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type Me = { playerId: number; issuedAt: number };

/** The signed cookie's contents, or null when it is missing, tampered with or malformed. */
export async function readMe(): Promise<Me | null> {
  const k = key();
  const token = (await cookies()).get(ME_COOKIE)?.value;
  if (!k || !token) return null;
  const [id, iat, sig] = token.split(".");
  const playerId = Number(id);
  const issuedAt = Number(iat);
  if (
    !sig ||
    !Number.isSafeInteger(playerId) ||
    playerId <= 0 ||
    !Number.isFinite(issuedAt)
  )
    return null;
  return safeEqual(sig, sign(`${id}.${iat}`, k)) ? { playerId, issuedAt } : null;
}

/** Remember this device as `playerId`. Server Actions and Route Handlers only. */
export async function startMe(playerId: number): Promise<void> {
  const k = key();
  if (!k) return;
  const issued = Date.now();
  const body = `${playerId}.${issued}`;
  (await cookies()).set(ME_COOKIE, `${body}.${sign(body, k)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ME_MAX_AGE_S,
    priority: "high",
  });
}

export async function endMe(): Promise<void> {
  (await cookies()).delete(ME_COOKIE);
}

/** Is this the id of a real player who hasn't been archived? */
export async function isActivePlayer(id: unknown): Promise<boolean> {
  if (!Number.isSafeInteger(id) || (id as number) <= 0) return false;
  const { data, error } = await db()
    .from("players")
    .select("id")
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  return !error && Boolean(data);
}

export type MyPlayer = Me & { name: string };

/**
 * The player this device belongs to, or null (no cookie, a bad cookie, or a player who has since
 * been archived). Cached for the request, so the header and a page share one lookup. A database
 * error counts as "nobody": the header chip is not worth failing a page over.
 */
export const getMe = cache(async (): Promise<MyPlayer | null> => {
  const me = await readMe();
  if (!me) return null;
  const { data, error } = await db()
    .from("players")
    .select("id, name, archived")
    .eq("id", me.playerId)
    .maybeSingle();
  if (error || !data || data.archived) return null;
  return { ...me, name: String(data.name) };
});

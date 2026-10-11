import "server-only";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  DEFAULT_WINDOW,
  describeWindow,
  isWindowOpen,
  nextOpening,
  parseWindow,
  windowClosing,
  windowEndLabel,
} from "./schedule";

/**
 * Who may write:
 *  - Anyone can VIEW at any time.
 *  - During the open window (default Saturdays 6:00 AM - 1:00 PM in LEAGUE_TIMEZONE)
 *    anyone can score ("play" actions).
 *  - The admin (valid session cookie, from ADMIN_PASSWORD) can do everything, any time.
 *  - Roster management, reopening and deleting games are admin-only, always.
 *
 * This is enforced in every server action via getAccess(); hiding buttons in
 * the UI is only a convenience.
 */

export const ADMIN_COOKIE = "pl_admin";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type Access = {
  isAdmin: boolean;
  /** The public editing window is open right now. */
  windowOpen: boolean;
  /** May record scoring actions: window open or admin. */
  canPlay: boolean;
  /** Human text such as "Saturdays 6:00 AM – 1:00 PM". */
  windowLabel: string;
  /** e.g. "1:00 PM" */
  windowEnds: string;
  /** Server clock (epoch ms), so countdowns are not thrown off by a wrong device clock. */
  now: number;
  /** Epoch ms when the window next opens; null while it is open. */
  opensAt: number | null;
  /** Epoch ms when the open window closes; null while it is closed. */
  closesAt: number | null;
  /** False when ADMIN_PASSWORD is not set, so nobody can sign in as admin. */
  adminConfigured: boolean;
};

function config() {
  return {
    timeZone: process.env.LEAGUE_TIMEZONE ?? "UTC",
    window: parseWindow(process.env.LEAGUE_WINDOW ?? DEFAULT_WINDOW),
    graceMin: Number(process.env.LEAGUE_WINDOW_GRACE_MIN ?? 0) || 0,
  };
}

// ---- Admin session ---------------------------------------------------------

/** Key derived from the password, so changing ADMIN_PASSWORD signs every admin out. */
function sessionKey(): Buffer | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHash("sha256").update(`pickup-league-session:${pw}`).digest() : null;
}

function sign(expires: number, key: Buffer): string {
  return createHmac("sha256", key).update(String(expires)).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Compare fixed-length hashes so length and timing don't leak.
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  return safeEqual(h(input), h(pw));
}

export async function startAdminSession(): Promise<void> {
  const key = sessionKey();
  if (!key) return;
  const expires = Date.now() + SESSION_MS;
  (await cookies()).set(ADMIN_COOKIE, `${expires}.${sign(expires, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

async function hasAdminSession(): Promise<boolean> {
  const key = sessionKey();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!key || !token) return false;
  const [exp, sig] = token.split(".");
  const expires = Number(exp);
  if (!sig || !Number.isFinite(expires) || expires < Date.now()) return false;
  return safeEqual(sig, sign(expires, key));
}

// ---- Public API ------------------------------------------------------------

export async function getAccess(): Promise<Access> {
  const { timeZone, window, graceMin } = config();
  const [isAdmin] = await Promise.all([hasAdminSession()]);
  const now = new Date();
  const windowOpen = isWindowOpen(now, timeZone, window, graceMin);
  return {
    now: now.getTime(),
    opensAt: nextOpening(now, timeZone, window, graceMin)?.getTime() ?? null,
    closesAt: windowClosing(now, timeZone, window, graceMin)?.getTime() ?? null,
    isAdmin,
    windowOpen,
    canPlay: isAdmin || windowOpen,
    windowLabel: describeWindow(window),
    windowEnds: windowEndLabel(window),
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
  };
}

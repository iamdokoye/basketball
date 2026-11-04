// Constants shared by the server (lib/identity.ts) and the browser (IdentitySync, ClaimPlayer).
// No server-only imports here, so client components can use it.

/** Cookie that remembers which player this device belongs to. */
export const ME_COOKIE = "pl_me";

/** localStorage copy of the player id, used to restore the cookie if the browser drops it. */
export const ME_BACKUP_KEY = "pl-me";

/** Chrome caps cookie lifetime at 400 days, so ask for exactly that; it is renewed whenever it is used. */
export const ME_MAX_AGE_S = 400 * 24 * 60 * 60;

/** Re-issue the cookie once it is this old, so anyone who opens the app now and then never expires. */
export const ME_REFRESH_MS = 14 * 24 * 60 * 60 * 1000;

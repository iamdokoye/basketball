"use client";

import { useEffect } from "react";
import { syncMe } from "@/lib/meActions";
import { ME_BACKUP_KEY } from "@/lib/identityShared";

const readBackup = (): number | null => {
  try {
    const n = Number(localStorage.getItem(ME_BACKUP_KEY));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

const writeBackup = (id: number | null) => {
  try {
    if (id === null) localStorage.removeItem(ME_BACKUP_KEY);
    else localStorage.setItem(ME_BACKUP_KEY, String(id));
  } catch {
    /* private mode or blocked storage: the cookie alone still works */
  }
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/**
 * Renders nothing; keeps "who is this device" alive. The cookie is the source of truth, and this
 * covers what cookies alone can't:
 *  - mirrors the player id to localStorage, and restores the cookie from it if the browser dropped
 *    the cookie but kept the site's other storage;
 *  - renews the cookie while it is still valid, so someone who opens the app now and then never
 *    runs into the 400-day cap;
 *  - in an installed app, asks the browser not to evict this site's storage.
 * An installed iPhone app has its own cookies and storage, separate from Safari, so it starts
 * unclaimed and the player picks their name once inside it.
 */
export function IdentitySync({
  playerId,
  issuedAt,
  refreshAfterMs,
}: {
  /** Who the server thinks this device is (null if nobody). */
  playerId: number | null;
  issuedAt: number | null;
  refreshAfterMs: number;
}) {
  useEffect(() => {
    if (playerId !== null) {
      writeBackup(playerId);
      if (issuedAt !== null && Date.now() - issuedAt > refreshAfterMs) {
        void syncMe(playerId);
      }
      // Chrome grants this silently to installed apps; other browsers may prompt, so only ask there.
      if (isStandalone()) void navigator.storage?.persist?.().catch(() => {});
      return;
    }
    const backup = readBackup();
    if (backup === null) return;
    void syncMe(backup).then((r) => {
      if (r.playerId === null) writeBackup(null); // that player is gone; stop retrying
    });
  }, [playerId, issuedAt, refreshAfterMs]);

  return null;
}

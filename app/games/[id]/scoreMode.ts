"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parseScoreMode, SCORE_MODE_COOKIE, type ScoreMode } from "./scoreModeShared";

const listeners = new Set<() => void>();

function read(): ScoreMode {
  const m = document.cookie.match(new RegExp(`(?:^|; )${SCORE_MODE_COOKIE}=([^;]*)`));
  return parseScoreMode(m?.[1]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The saved style and a setter that remembers the choice on this phone. `initial` is what the server read from the cookie. */
export function useScoreMode(initial: ScoreMode): [ScoreMode, (m: ScoreMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => initial);
  const set = useCallback((m: ScoreMode) => {
    document.cookie = `${SCORE_MODE_COOKIE}=${m}; path=/; max-age=31536000; samesite=lax`;
    listeners.forEach((l) => l());
  }, []);
  return [mode, set];
}

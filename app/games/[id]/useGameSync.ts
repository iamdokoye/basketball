"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recordGroup, undoGroup } from "@/lib/actions";
import type { EventType, GameEvent, Team } from "@/lib/stats";

type Ev = { playerId: number; type: EventType; team?: Team };
type Op =
  | { kind: "add"; gameId: number; grp: string; at: number; events: Ev[] }
  | { kind: "remove"; gameId: number; grp: string };

const STORAGE_KEY = "pl-outbox-v1";
const POLL_MS = 3500;

// ---- persisted outbox (survives reloads and lost signal) ---------------------------------
function loadOutbox(): Op[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Op[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveOutbox(ops: Op[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    /* private mode or full: the in-memory queue still works for this session */
  }
}

export type SyncState = "saved" | "saving" | "offline";

/**
 * Keeps one game's plays in sync between this phone and the server.
 *  - Taps show up instantly (optimistic) and go into a persisted outbox that is sent in order;
 *    if the phone has no signal they wait and are sent when it returns. Re-sending is safe
 *    because the server ignores a play group it already has.
 *  - The server's copy is polled every few seconds, so plays recorded on another phone appear
 *    here, and a play someone else undoes disappears.
 */
export function useGameSync({
  gameId,
  initialEvents,
  paused,
  onFinished,
}: {
  gameId: number;
  initialEvents: GameEvent[];
  /** Skip polling (e.g. while a menu is open so options don't shift under a tap). */
  paused: boolean;
  onFinished: () => void;
}) {
  const [base, setBase] = useState<GameEvent[]>(initialEvents);
  const [adds, setAdds] = useState<Map<string, GameEvent[]>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Two separate signals: a poll succeeding must not hide that saving is failing.
  const [pollOk, setPollOk] = useState(true);
  const [sendOk, setSendOk] = useState(true);
  const online = pollOk && sendOk;
  const [pending, setPending] = useState(0);

  const queue = useRef<Op[]>([]);
  /** When each of our plays was confirmed saved, to tell "not on the server yet" from "someone undid it". */
  const confirmedAt = useRef(new Map<string, number>());
  const flushing = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const backoff = useRef(2000);
  /** Server time minus this phone's time, so plays and the game clock agree across phones. */
  const offset = useRef(0);
  const finishedRef = useRef(onFinished);
  useEffect(() => {
    finishedRef.current = onFinished;
  });

  const persist = useCallback(() => {
    // The stored outbox holds every game's ops; this hook owns only this game's.
    const others = loadOutbox().filter((o) => o.gameId !== gameId);
    saveOutbox([...others, ...queue.current]);
    setPending(queue.current.length);
  }, [gameId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    clearTimeout(retryTimer.current);
    try {
      while (queue.current.length > 0) {
        const op = queue.current[0];
        let res: { ok: true } | { ok: false; error: string };
        try {
          res =
            op.kind === "add"
              ? await recordGroup(op.gameId, op.grp, op.at, op.events)
              : await undoGroup(op.gameId, op.grp);
        } catch {
          // Couldn't reach the server: keep everything queued and try again shortly.
          setSendOk(false);
          retryTimer.current = setTimeout(() => void flush(), backoff.current);
          backoff.current = Math.min(backoff.current * 2, 15000);
          return;
        }
        setSendOk(true);
        backoff.current = 2000;
        queue.current.shift();
        if (res.ok && op.kind === "add")
          confirmedAt.current.set(op.grp, Date.now());
        if (!res.ok) {
          // A real refusal (game finished, editing closed): drop it and undo the optimistic change.
          if (op.kind === "add") {
            setAdds((m) => {
              const n = new Map(m);
              n.delete(op.grp);
              return n;
            });
          } else {
            setRemoved((s) => {
              const n = new Set(s);
              n.delete(op.grp);
              return n;
            });
          }
          setError(res.error);
        }
        persist();
      }
    } finally {
      flushing.current = false;
    }
  }, [persist]);

  // On load: put this game's unsent plays back on screen and start sending them. The outbox lives in
  // localStorage (an external system the server can't see), so it is read after mount, one tick later.
  useEffect(() => {
    const mine = loadOutbox().filter((o) => o.gameId === gameId);
    if (mine.length === 0) return;
    queue.current = mine;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setPending(mine.length);
      setAdds(
        new Map(
          mine
            .filter((o): o is Extract<Op, { kind: "add" }> => o.kind === "add")
            .map((o) => [
              o.grp,
              o.events.map((e) => ({ ...e, grp: o.grp, at: o.at })),
            ]),
        ),
      );
      setRemoved(
        new Set(mine.filter((o) => o.kind === "remove").map((o) => o.grp)),
      );
      void flush();
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, flush]);

  // Come back online: send what's waiting.
  useEffect(() => {
    const on = () => {
      setPollOk(true);
      setSendOk(true);
      backoff.current = 2000;
      void flush();
    };
    const off = () => setPollOk(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearTimeout(retryTimer.current);
    };
  }, [flush]);

  // Poll the server's copy.
  useEffect(() => {
    if (paused) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const sentAt = Date.now();
        const res = await fetch(`/api/games/${gameId}/events`, {
          cache: "no-store",
        });
        if (!res.ok || stop) return;
        const data = (await res.json()) as {
          status: "live" | "final";
          serverNow?: number;
          events: GameEvent[];
        };
        if (stop) return;
        // The server stamped its time somewhere between send and receive: use the midpoint.
        if (typeof data.serverNow === "number") {
          offset.current = data.serverNow - (sentAt + Date.now()) / 2;
        }
        if (data.status === "final") return finishedRef.current();
        setBase(data.events);
        const seen = new Set(data.events.map((e) => e.grp));
        // Once the server shows a play we added, it no longer needs to be held locally. If it was
        // confirmed saved a while ago and is now gone, someone else undid it: drop it here too.
        setAdds((m) => {
          const now = Date.now();
          const stillWaiting = new Map(
            [...m].filter(([grp]) => {
              if (seen.has(grp)) return false;
              const at = confirmedAt.current.get(grp);
              return at === undefined || now - at < POLL_MS * 2.5;
            }),
          );
          return stillWaiting.size === m.size ? m : stillWaiting;
        });
        // Once the server no longer has a play we removed (and it isn't still queued), forget the removal.
        setRemoved((s) => {
          const queued = new Set(
            queue.current.filter((o) => o.kind === "remove").map((o) => o.grp),
          );
          const keep = new Set(
            [...s].filter((grp) => seen.has(grp) || queued.has(grp)),
          );
          return keep.size === s.size ? s : keep;
        });
        setPollOk(true);
      } catch {
        setPollOk(false);
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    const vis = () => void tick();
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [gameId, paused]);

  /** Records a play (one or more linked events) and returns its group id. `atMs` keeps an earlier time (used when amending). */
  const add = useCallback(
    (evs: Ev[], atMs?: number): string => {
      const grp = crypto.randomUUID();
      const at = atMs ?? Date.now() + offset.current;
      setError(null);
      setAdds((m) =>
        new Map(m).set(
          grp,
          evs.map((e) => ({ ...e, grp, at })),
        ),
      );
      queue.current.push({ kind: "add", gameId, grp, at, events: evs });
      persist();
      void flush();
      return grp;
    },
    [gameId, persist, flush],
  );

  const remove = useCallback(
    (grp: string) => {
      setError(null);
      const unsent = queue.current.findIndex(
        (o) => o.kind === "add" && o.grp === grp,
      );
      if (unsent >= 0 && !flushing.current) {
        // Never left this phone: just cancel it, nothing to tell the server.
        queue.current.splice(unsent, 1);
        setAdds((m) => {
          const n = new Map(m);
          n.delete(grp);
          return n;
        });
        persist();
        return;
      }
      // If the add is still queued it is sent first, then removed, in order.
      setRemoved((s) => new Set(s).add(grp));
      queue.current.push({ kind: "remove", gameId, grp });
      persist();
      void flush();
    },
    [gameId, persist, flush],
  );

  const events = useMemo(() => {
    const seen = new Set(base.map((e) => e.grp));
    const mine = [...adds]
      .filter(([grp]) => !seen.has(grp))
      .flatMap(([, evs]) => evs);
    return [...base, ...mine].filter((e) => !removed.has(e.grp));
  }, [base, adds, removed]);

  const state: SyncState = !online
    ? "offline"
    : pending > 0
      ? "saving"
      : "saved";
  return {
    events,
    state,
    pending,
    error,
    clearError: () => setError(null),
    add,
    remove,
    /** Current time on the server's clock. */
    now: () => Date.now() + offset.current,
  };
}

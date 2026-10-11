"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addPlayer, renamePlayer, setPlayerArchived } from "@/lib/actions";
import { Avatar } from "@/app/components/Avatar";
import { RenamePlayer } from "@/app/components/RenamePlayer";

export type RosterPlayer = {
  id: number;
  name: string;
  archived: boolean;
  /** Pre-formatted career line, computed on the server. */
  stats: string;
  /** True while an optimistic change hasn't been confirmed by the server. */
  pending?: boolean;
};

type Op =
  | { t: "add"; name: string }
  | { t: "rename"; id: number; name: string }
  | { t: "archive"; id: number; archived: boolean };

const byName = (a: RosterPlayer, b: RosterPlayer) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function reduce(state: RosterPlayer[], op: Op): RosterPlayer[] {
  switch (op.t) {
    case "add": {
      const existing = state.find((p) => p.name.toLowerCase() === op.name.toLowerCase());
      if (existing) return state.map((p) => (p === existing ? { ...p, archived: false, pending: true } : p));
      // Temporary negative id until the server confirms and the real list arrives.
      return [...state, { id: -(state.length + 1), name: op.name, archived: false, stats: "No games yet", pending: true }].sort(byName);
    }
    case "rename":
      return state.map((p) => (p.id === op.id ? { ...p, name: op.name, pending: true } : p)).sort(byName);
    case "archive":
      return state.map((p) => (p.id === op.id ? { ...p, archived: op.archived, pending: true } : p));
  }
}

const PILL = "rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-40";

/**
 * Roster list that updates instantly and saves in the background. The server
 * is far from the phone (hundreds of ms per round trip), so waiting for it
 * before showing a change makes the app feel broken.
 */
export function PlayerRoster({ players }: { players: RosterPlayer[] }) {
  const [list, apply] = useOptimistic(players, reduce);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const active = list.filter((p) => !p.archived);
  const archived = list.filter((p) => p.archived);

  function add(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim().slice(0, 40);
    if (!name) return;
    const dup = list.find((p) => !p.archived && p.name.toLowerCase() === name.toLowerCase());
    if (dup) return setError(`${dup.name} is already on the roster.`);
    setError(null);
    form.current?.reset();
    startTransition(async () => {
      apply({ t: "add", name });
      const res = await addPlayer(name);
      if (!res.ok) setError(res.error);
    });
  }

  function archive(p: RosterPlayer, value: boolean) {
    setError(null);
    startTransition(async () => {
      apply({ t: "archive", id: p.id, archived: value });
      try {
        await setPlayerArchived(p.id, value);
      } catch {
        setError("Couldn't update that player. Try again.");
      }
    });
  }

  const rename = (p: RosterPlayer) => (next: string) => {
    const clash = list.find((q) => q.id !== p.id && q.name.toLowerCase() === next.toLowerCase());
    if (clash) return "Another player already has that name.";
    setError(null);
    startTransition(async () => {
      apply({ t: "rename", id: p.id, name: next });
      const res = await renamePlayer(p.id, next);
      if (!res.ok) setError(res.error);
    });
    return null; // accept: the dialog closes at once and the list already shows the new name
  };

  return (
    <div className="space-y-5">
      <form ref={form} action={add} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={40}
          placeholder="Add a player"
          autoComplete="off"
          className="glass-1 h-12 min-w-0 flex-1 rounded-full px-5 text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted focus:ring-2 focus:ring-court"
        />
        <button className="h-12 rounded-full bg-ink px-6 text-sm font-semibold text-paper shadow-sm active:scale-95">
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {active.map((p) => (
          <li key={p.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
            <Link
              href={p.id > 0 ? `/players/${p.id}` : "#"}
              aria-disabled={p.id < 0}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar name={p.name} />
              <div className="min-w-0">
                <div className="truncate font-bold">{p.name}</div>
                <div className="tabular text-xs font-semibold text-muted">
                  {p.pending ? "Saving…" : p.stats}
                </div>
              </div>
            </Link>
            <RenamePlayer
              name={p.name}
              onSubmit={rename(p)}
              disabled={p.id < 0}
              className={`${PILL} bg-sub/10 text-sub ring-1 ring-sub/25 hover:bg-sub/15`}
            />
            <button
              disabled={p.id < 0}
              onClick={() => archive(p, true)}
              className={`${PILL} bg-loss/10 text-loss ring-1 ring-loss/25 hover:bg-loss/15`}
            >
              Archive
            </button>
          </li>
        ))}
        {active.length === 0 && (
          <li className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
            Add your friends to get started.
          </li>
        )}
      </ul>

      {archived.length > 0 && (
        <section>
          <h2 className="label mb-2 px-1 text-muted">Archived</h2>
          <ul className="space-y-2">
            {archived.map((p) => (
              <li key={p.id} className="glass-1 flex items-center justify-between rounded-2xl p-3 opacity-70">
                <Link href={`/players/${p.id}`} className="font-semibold text-muted">
                  {p.name}
                </Link>
                <button
                  onClick={() => archive(p, false)}
                  className={`${PILL} bg-win/10 text-emerald-800 ring-1 ring-win/30 hover:bg-win/15`}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

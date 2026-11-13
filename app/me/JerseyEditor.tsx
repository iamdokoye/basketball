"use client";

import { useState, useTransition } from "react";
import { updatePlayerJersey } from "@/lib/actions";

export function JerseyEditor({
  playerId,
  currentJersey,
}: {
  playerId: number;
  currentJersey?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [jersey, setJersey] = useState(currentJersey ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = jersey.trim().toUpperCase();

    if (cleaned.length > 0 && !/^[A-Z0-9]{1,3}$/.test(cleaned)) {
      setError("1–3 numbers or letters (e.g. 23, 00, 7)");
      return;
    }

    startTransition(async () => {
      const res = await updatePlayerJersey(playerId, cleaned || null);
      if (res.ok) {
        setEditing(false);
      } else {
        setError(res.error ?? "Failed to save jersey");
      }
    });
  }

  if (!editing) {
    return (
      <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" aria-hidden>
            🎽
          </span>
          <div>
            <div className="text-xs font-semibold text-muted">Jersey Number</div>
            <div className="text-sm font-bold text-ink">
              {currentJersey ? (
                <span className="font-extrabold text-court-ink">#{currentJersey}</span>
              ) : (
                <span className="text-muted">Not assigned</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setJersey(currentJersey ?? "");
            setError(null);
            setEditing(true);
          }}
          className="rounded-full bg-black/[0.05] hover:bg-black/[0.08] px-3 py-1 text-xs font-bold text-ink transition active:scale-95"
        >
          {currentJersey ? "Change #" : "Set #"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-1 space-y-3 rounded-2xl p-4 ring-1 ring-court-ink/20"
    >
      <div className="flex items-center justify-between">
        <label htmlFor="jersey-input" className="text-xs font-bold uppercase tracking-wider text-muted">
          Jersey Number (00–99)
        </label>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2">
        <input
          id="jersey-input"
          type="text"
          maxLength={3}
          value={jersey}
          onChange={(e) => setJersey(e.target.value.toUpperCase())}
          placeholder="e.g. 23"
          className="w-24 rounded-xl border border-black/10 bg-white/80 px-3 py-1.5 text-center text-lg font-black tracking-wider text-ink shadow-inner outline-none focus:border-court-ink focus:ring-1 focus:ring-court-ink"
          autoFocus
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-court-ink px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-court-ink/90 active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Jersey"}
        </button>
      </div>

      {error && <p className="text-xs font-bold text-loss">{error}</p>}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteGame, reopenGame } from "@/lib/actions";

/** Admin-only controls for a finished game. The server re-checks the admin session. */
export default function GameAdminActions({ gameId }: { gameId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reopen() {
    setError(null);
    startTransition(async () => {
      const res = await reopenGame(gameId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this game and all of its stats? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      // On success this redirects to /games; it only returns when it fails.
      try {
        const res = await deleteGame(gameId);
        if (res && !res.ok) setError(res.error);
      } catch (e) {
        if (typeof e === "object" && e !== null && "digest" in e) throw e;
        setError("Couldn't delete the game. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/games/${gameId}/edit`}
          className="glass-1 rounded-full px-4 py-2 text-sm font-semibold active:scale-95"
        >
          Edit box score
        </Link>
        <button
          onClick={reopen}
          disabled={pending}
          className="glass-1 rounded-full px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-50"
        >
          Reopen to fix stats
        </button>
        <button
          onClick={remove}
          disabled={pending}
          className="rounded-full px-4 py-2 text-sm font-semibold text-loss active:bg-loss/10 disabled:opacity-50"
        >
          Delete game
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

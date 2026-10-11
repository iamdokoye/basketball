"use client";

import { deleteGame } from "@/lib/actions";

export default function DeleteGameButton({ gameId }: { gameId: number }) {
  return (
    <form
      action={deleteGame.bind(null, gameId)}
      onSubmit={(e) => {
        if (!confirm("Delete this game and all of its stats? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded-full px-4 py-2 text-sm font-semibold text-rose-700 active:bg-rose-100">
        Delete game
      </button>
    </form>
  );
}

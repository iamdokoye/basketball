"use client";

import { Avatar } from "@/app/components/Avatar";
import type { RosterEntry } from "@/lib/stats";

export type PadAction = {
  key: string;
  label: string;
  tone: "good" | "bad" | "neutral" | "sub";
  /** Needs a selected player. Actions like Undo don't. */
  needsPlayer?: boolean;
  onPress: () => void;
};

const TONE = {
  good: "bg-win/15 text-emerald-800 ring-1 ring-win/30 active:bg-win/30",
  bad: "bg-white/70 text-loss ring-1 ring-black/5 active:bg-loss/10",
  neutral: "bg-white/70 text-ink ring-1 ring-black/5 active:bg-white",
  sub: "bg-sub/10 text-sub ring-1 ring-sub/25 active:bg-sub/20",
};

/**
 * The always-visible action bar. Pick a player in the tiles above once; every tap here is then a
 * play for them, so a run of plays by one player is one tap each. Nothing pops up over the screen.
 */
export function ActionPad({
  player,
  actions,
}: {
  player: RosterEntry | null;
  actions: PadAction[];
}) {
  return (
    <div className="glass-3 rounded-3xl !bg-paper/95 p-3 shadow-lg">
      <div className="mb-2 flex min-h-8 items-center gap-2 px-1">
        {player ? (
          <>
            <Avatar id={player.id} name={player.name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
              {player.name}
            </span>
            <span
              className={`label ${player.team === "A" ? "text-court-ink" : "text-away-dark"}`}
            >
              Team {player.team}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-muted">
            Tap a player to start scoring
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {actions.map((a) => {
          const disabled = a.needsPlayer !== false && !player;
          return (
            <button
              key={a.key}
              type="button"
              disabled={disabled}
              onClick={a.onPress}
              className={`h-10 rounded-xl text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-35 ${TONE[a.tone]}`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

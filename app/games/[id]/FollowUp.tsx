"use client";

import { useEffect } from "react";

export type Chip = {
  key: string;
  label: string;
  tone?: "good" | "bad" | "neutral";
  onPick: () => void;
};
export type ChipGroup = { heading?: string; chips: Chip[] };

/** How long the chips stay up. Ignoring them leaves the play as it was recorded. */
export const FOLLOW_UP_MS = 10_000;

const TONE = {
  good: "bg-win/15 text-emerald-800 ring-1 ring-win/30 active:bg-win/25",
  bad: "bg-white/70 text-loss ring-1 ring-black/5 active:bg-loss/10",
  neutral: "bg-white/70 text-ink ring-1 ring-black/5 active:bg-white",
};

/**
 * The "annotate after" strip. The play is already saved; these chips add the detail (who assisted,
 * who rebounded...) to it with one tap, or the strip fades away and the play stays as recorded.
 * `stamp` changes with every new play so the countdown restarts.
 */
export function FollowUp({
  stamp,
  title,
  groups,
  onDismiss,
}: {
  stamp: string;
  title: string;
  groups: ChipGroup[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, FOLLOW_UP_MS);
    return () => clearTimeout(t);
  }, [stamp, onDismiss]);

  return (
    <div
      role="group"
      aria-label={title}
      className="glass-3 sheet-up overflow-hidden rounded-3xl !bg-paper/95 shadow-lg"
    >
      <div className="space-y-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="label text-court-ink">{title}</div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Skip"
            className="-mr-1 rounded-full px-2.5 py-1 text-xs font-semibold text-muted active:bg-black/5"
          >
            Skip ✕
          </button>
        </div>
        {groups.map((g, i) => (
          <div key={i} className="flex items-start gap-2">
            {g.heading && (
              <span
                className={`label shrink-0 truncate pt-3 text-[10px] text-muted ${g.heading.length <= 3 ? "w-7" : "w-[4.5rem]"}`}
              >
                {g.heading}
              </span>
            )}
            <div className="flex flex-1 flex-wrap gap-1.5">
              {g.chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.onPick}
                  className={`min-h-10 rounded-full px-3 text-sm font-semibold transition-transform active:scale-95 ${TONE[c.tone ?? "neutral"]}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Time left: shrinks to nothing, then the strip goes away by itself. */}
      <div className="h-1 bg-black/[0.05]">
        <div
          key={stamp}
          className="h-full origin-left bg-court-soft/70"
          style={{
            animation: `follow-up-drain ${FOLLOW_UP_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

/** How long the "Saved" message (with its Undo) stays up. */
export const SAVED_MS = 5_000;

/**
 * Shown after a voice or typed play was saved without asking. The plays are already in the log; this is
 * the one-tap way out if it heard something wrong. It goes away by itself.
 */
export function SavedToast({
  stamp,
  text,
  onUndo,
  onDismiss,
}: {
  stamp: string;
  text: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, SAVED_MS);
    return () => clearTimeout(t);
  }, [stamp, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-3 sheet-up overflow-hidden rounded-3xl !bg-paper/95 shadow-lg"
    >
      <div className="flex items-center gap-3 p-3">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-win/15 font-extrabold text-win"
        >
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <div className="label text-[10px] text-muted">Saved</div>
          <div className="text-sm font-bold leading-snug">{text}</div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-paper active:scale-95"
        >
          Undo
        </button>
      </div>
      <div className="h-1 bg-black/[0.05]">
        <div
          key={stamp}
          className="h-full origin-left bg-win/60"
          style={{ animation: `follow-up-drain ${SAVED_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

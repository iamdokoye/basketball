"use client";

import { Avatar } from "@/app/components/Avatar";
import {
  MAX_STAT,
  STAT_FIELDS,
  pointsOf,
  type StatKey,
  type Totals,
} from "@/lib/import";

/** One player's totals as labelled number boxes. Shared by "Import a game" and "Edit box score". */
export function PlayerStatCard({
  name,
  team,
  totals,
  onChange,
  onRemove,
}: {
  name: string;
  team: "A" | "B";
  totals: Totals;
  onChange: (next: Totals) => void;
  onRemove?: () => void;
}) {
  const set = (k: StatKey, raw: string) => {
    // Typing over a 0 gives "05"; Number() turns that into 5, so no stray leading zeros are kept.
    const n = Math.min(MAX_STAT, Math.max(0, Math.floor(Number(raw)) || 0));
    onChange({ ...totals, [k]: n });
  };
  return (
    <li className="glass-1 space-y-3 rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <Avatar name={name} size="sm" />
        <span className="min-w-0 flex-1 truncate font-bold">{name}</span>
        <span
          className={`tabular text-sm font-extrabold ${team === "A" ? "text-court-ink" : "text-away-dark"}`}
        >
          {pointsOf(totals)} pts
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            className="h-8 rounded-full px-3 text-xs font-semibold text-loss active:bg-loss/10"
          >
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STAT_FIELDS.map((f) => (
          <label key={f.key} className="label block text-muted">
            {f.label}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_STAT}
              value={totals[f.key]}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => set(f.key, e.target.value)}
              className="tabular mt-1 block h-11 w-full rounded-xl border border-white/80 bg-white/60 px-2 text-center text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
            />
          </label>
        ))}
      </div>
    </li>
  );
}

/** The running score from the typed totals, with a note when it can't be saved yet. */
export function ScoreBar({ a, b }: { a: number; b: number }) {
  return (
    <div className="glass-2 rounded-2xl p-4" role="status">
      <div className="grid grid-cols-3 items-center text-center">
        <div>
          <div className="label text-court-ink">Team A</div>
          <div className="tabular text-4xl font-extrabold leading-none tracking-tighter">
            {a}
          </div>
        </div>
        <div className="label text-muted">Final</div>
        <div>
          <div className="label text-away-dark">Team B</div>
          <div className="tabular text-4xl font-extrabold leading-none tracking-tighter">
            {b}
          </div>
        </div>
      </div>
      {a === b && (
        <p className="mt-3 text-center text-xs font-semibold text-loss">
          Tied. A finished game needs a winner.
        </p>
      )}
    </div>
  );
}

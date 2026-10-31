"use client";

import { useMemo, useState } from "react";

type Item = { id: number; label: string; score: string };

export function ExportGames({ games }: { games: Item[] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<"events" | "box">("events");

  const allSelected = games.length > 0 && picked.size === games.length;
  const href = useMemo(() => {
    const ids = allSelected ? "all" : [...picked].sort((a, b) => a - b).join(",");
    return `/api/admin/export?games=${ids}&format=${format}`;
  }, [picked, allSelected, format]);

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const disabled = picked.size === 0;

  return (
    <div className="glass-2 space-y-4 rounded-3xl p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            📤
          </span>
          <h2 className="label text-court-ink">Export games (CSV)</h2>
        </div>
        <p className="text-xs text-muted">
          Pick the games to include, or select all, then download a spreadsheet file.
        </p>
      </div>

      <div className="flex gap-1.5">
        {(
          [
            ["events", "Play-by-play"],
            ["box", "Box scores"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFormat(k)}
            aria-pressed={format === k}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              format === k ? "bg-ink text-paper" : "bg-black/[0.05] text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs font-semibold">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allSelected}
            onChange={() => setPicked(allSelected ? new Set() : new Set(games.map((g) => g.id)))}
          />
          Select all ({games.length})
        </label>
        <span className="text-muted">{picked.size} selected</span>
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto overscroll-contain rounded-2xl bg-black/[0.03] p-2">
        {games.length === 0 && <li className="p-2 text-xs text-muted">No games yet.</li>}
        {games.map((g) => (
          <li key={g.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-xs hover:bg-black/[0.04]">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={picked.has(g.id)}
                onChange={() => toggle(g.id)}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">{g.label}</span>
              <span className="tabular shrink-0 text-muted">{g.score}</span>
            </label>
          </li>
        ))}
      </ul>

      <a
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        download
        className={`flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-paper active:scale-95 ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
      >
        Download CSV
      </a>
    </div>
  );
}

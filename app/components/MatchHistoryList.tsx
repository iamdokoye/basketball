"use client";

import { useMemo, useState } from "react";
import type { Game } from "@/lib/queries";
import { GameRow } from "./GameRow";

type FormatFilter = "all" | "target" | "timed";
type ClosenessFilter = "all" | "close";

export function MatchHistoryList({
  games,
  canPlay,
}: {
  games: Game[];
  canPlay: boolean;
}) {
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [closenessFilter, setClosenessFilter] = useState<ClosenessFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (formatFilter !== "all" && g.gameType !== formatFilter) return false;
      if (closenessFilter === "close") {
        const diff = Math.abs(g.score.A - g.score.B);
        if (diff > 3) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesPlayer = g.roster.some((p) => p.name.toLowerCase().includes(q));
        if (!matchesPlayer) return false;
      }
      return true;
    });
  }, [games, formatFilter, closenessFilter, searchQuery]);

  return (
    <section className="space-y-3">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2">
          <h2 className="label text-ink font-black">
            Match History ({filteredGames.length}
            {filteredGames.length !== games.length ? ` of ${games.length}` : ""})
          </h2>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format filter */}
          <div className="inline-flex rounded-xl bg-black/[0.05] p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormatFilter("all")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                formatFilter === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFormatFilter("target")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                formatFilter === "target" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Pickup
            </button>
            <button
              type="button"
              onClick={() => setFormatFilter("timed")}
              className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                formatFilter === "timed" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Timed
            </button>
          </div>

          {/* Close Games Filter */}
          <button
            type="button"
            onClick={() => setClosenessFilter((prev) => (prev === "all" ? "close" : "all"))}
            className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              closenessFilter === "close"
                ? "bg-court-ink text-white shadow-xs"
                : "bg-black/[0.05] text-muted hover:text-ink"
            }`}
          >
            🔥 Close Games (≤3 pts)
          </button>

          {/* Player Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player..."
              className="w-32 sm:w-36 rounded-xl bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-ink placeholder-muted focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-court-ink"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {filteredGames.length === 0 ? (
        <div className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
          {games.length === 0
            ? canPlay
              ? "No games yet. Start one!"
              : "No games yet."
            : "No games match the selected filters."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredGames.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

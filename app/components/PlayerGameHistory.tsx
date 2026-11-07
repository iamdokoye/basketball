"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, shortName } from "./Avatar";
import { formatDate } from "./BoxScore";
import { fmtMinutes, fmtSigned } from "@/lib/stats";
import type { PlayerHistorySummary, PlayerGameInsight } from "@/lib/playerHistory";

type ViewMode = "insights" | "table";
type FormatFilter = "all" | "target" | "timed";
type ResultFilter = "all" | "W" | "L";
type HighlightFilter = "all" | "assists" | "blocks" | "steals" | "scoring";

export function PlayerGameHistory({
  summary,
  currentPlayerId,
}: {
  summary: PlayerHistorySummary;
  currentPlayerId: number;
}) {
  const { games, highlights, playerName } = summary;

  const [viewMode, setViewMode] = useState<ViewMode>("insights");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGameIds, setExpandedGameIds] = useState<Set<number>>(() => {
    // By default, expand the first 2 most recent games
    return new Set(games.slice(0, 2).map((g) => g.gameId));
  });

  const toggleGameExpanded = (id: number) => {
    setExpandedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedGameIds(new Set(games.map((g) => g.gameId)));
  };

  const handleCollapseAll = () => {
    setExpandedGameIds(new Set());
  };

  // Filter games based on selected controls
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (formatFilter !== "all" && g.gameType !== formatFilter) return false;
      if (resultFilter !== "all" && g.result !== resultFilter) return false;

      if (highlightFilter === "assists" && g.assists.totalAst === 0) return false;
      if (highlightFilter === "blocks" && g.blocks.totalBlk === 0) return false;
      if (highlightFilter === "steals" && g.steals.totalStl === 0) return false;
      if (highlightFilter === "scoring" && g.line.pts < 10) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hasTeammate = g.teammates.some((t) => t.name.toLowerCase().includes(q));
        const hasOpponent = g.opponents.some((o) => o.name.toLowerCase().includes(q));
        const hasAssisted = g.assists.assistedPlayers.some((p) =>
          p.playerName.toLowerCase().includes(q),
        );
        const hasBlocked = g.blocks.blockedPlayers.some((p) =>
          p.playerName.toLowerCase().includes(q),
        );
        const hasStolen = g.steals.stolenFromPlayers.some((p) =>
          p.playerName.toLowerCase().includes(q),
        );
        if (!hasTeammate && !hasOpponent && !hasAssisted && !hasBlocked && !hasStolen) {
          return false;
        }
      }

      return true;
    });
  }, [games, formatFilter, resultFilter, highlightFilter, searchQuery]);

  const allExpanded = filteredGames.length > 0 && filteredGames.every((g) => expandedGameIds.has(g.gameId));

  const firstName = playerName.split(" ")[0];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between px-1">
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl flex items-center gap-2">
            <span>📜</span>
            <span>Player Game History & Detailed Insights</span>
          </h2>
          <p className="text-xs font-medium text-muted mt-0.5">
            Breakdown of every game: points made, teammates assisted, blocked opponents, and takeaways.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl bg-black/[0.05] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("insights")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                viewMode === "insights"
                  ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>🔍</span>
              <span>Detailed Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                viewMode === "table"
                  ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📊</span>
              <span>Dense Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Career Synergy Highlights Banner */}
      {highlights.totalGames > 0 && (
        <div className="glass-2 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-court-ink">
              <span>⚡</span>
              <span>{firstName}&apos;s Career Playmaking & Defensive Targets</span>
            </div>
            <div className="text-xs font-semibold text-muted">
              {highlights.totalGames} {highlights.totalGames === 1 ? "game" : "games"} · {highlights.wins}W-{highlights.losses}L ({highlights.winRatePct}%)
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Top Assisted Teammates */}
            <div className="rounded-xl bg-black/[0.03] p-3 space-y-1.5 border border-black/[0.04]">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
                <span>🪄 Top Assisted</span>
                <span className="text-court-ink font-extrabold">{highlights.totalAst} AST</span>
              </div>
              {highlights.topAssistedTeammates.length === 0 ? (
                <p className="text-xs text-muted italic">No assists recorded yet.</p>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {highlights.topAssistedTeammates.slice(0, 3).map((t) => (
                    <Link
                      key={t.playerId}
                      href={`/players/${t.playerId}`}
                      className="flex items-center justify-between gap-2 text-xs group hover:opacity-80 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={t.playerName} size="sm" />
                        <span className="font-extrabold text-ink truncate group-hover:underline">
                          {shortName(t.playerName)}
                        </span>
                      </div>
                      <span className="tabular font-black text-court-ink shrink-0 text-[11px]">
                        {t.totalAssists} ast <span className="text-muted font-normal">({t.totalPointsGenerated} pts)</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Top Block Victims */}
            <div className="rounded-xl bg-black/[0.03] p-3 space-y-1.5 border border-black/[0.04]">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
                <span>🧱 Top Block Targets</span>
                <span className="text-amber-800 font-extrabold">{highlights.totalBlk} BLK</span>
              </div>
              {highlights.topBlockVictims.length === 0 ? (
                <p className="text-xs text-muted italic">No blocks recorded yet.</p>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {highlights.topBlockVictims.slice(0, 3).map((o) => (
                    <Link
                      key={o.playerId}
                      href={`/players/${o.playerId}`}
                      className="flex items-center justify-between gap-2 text-xs group hover:opacity-80 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={o.playerName} size="sm" />
                        <span className="font-extrabold text-ink truncate group-hover:underline">
                          {shortName(o.playerName)}
                        </span>
                      </div>
                      <span className="tabular font-black text-amber-800 shrink-0 text-[11px]">
                        {o.count} {o.count === 1 ? "block" : "blocks"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Top Steal Victims */}
            <div className="rounded-xl bg-black/[0.03] p-3 space-y-1.5 border border-black/[0.04]">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
                <span>🥷 Top Steal Targets</span>
                <span className="text-emerald-800 font-extrabold">{highlights.totalStl} STL</span>
              </div>
              {highlights.topStealTargets.length === 0 ? (
                <p className="text-xs text-muted italic">No steals recorded yet.</p>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {highlights.topStealTargets.slice(0, 3).map((o) => (
                    <Link
                      key={o.playerId}
                      href={`/players/${o.playerId}`}
                      className="flex items-center justify-between gap-2 text-xs group hover:opacity-80 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={o.playerName} size="sm" />
                        <span className="font-extrabold text-ink truncate group-hover:underline">
                          {shortName(o.playerName)}
                        </span>
                      </div>
                      <span className="tabular font-black text-emerald-800 shrink-0 text-[11px]">
                        {o.count} {o.count === 1 ? "steal" : "steals"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Playmakers Who Assisted This Player */}
            <div className="rounded-xl bg-black/[0.03] p-3 space-y-1.5 border border-black/[0.04]">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
                <span>🎯 Assisted By</span>
                <span className="text-purple-800 font-extrabold">
                  {highlights.assistedBasketsPct}% assisted
                </span>
              </div>
              {highlights.topPlaymakersAssisting.length === 0 ? (
                <p className="text-xs text-muted italic">
                  {highlights.totalPts > 0 ? "All baskets unassisted." : "No baskets yet."}
                </p>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {highlights.topPlaymakersAssisting.slice(0, 3).map((a) => (
                    <Link
                      key={a.playerId}
                      href={`/players/${a.playerId}`}
                      className="flex items-center justify-between gap-2 text-xs group hover:opacity-80 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={a.playerName} size="sm" />
                        <span className="font-extrabold text-ink truncate group-hover:underline">
                          {shortName(a.playerName)}
                        </span>
                      </div>
                      <span className="tabular font-black text-purple-800 shrink-0 text-[11px]">
                        {a.count} {a.count === 1 ? "assist" : "assists"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-1 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Format and Result Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Format: All, Pickup, Timed */}
            <div className="inline-flex rounded-lg bg-black/[0.05] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormatFilter("all")}
                className={`rounded-md px-2.5 py-1 transition ${
                  formatFilter === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                All Formats
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter("target")}
                className={`rounded-md px-2.5 py-1 transition ${
                  formatFilter === "target" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                Pickup
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter("timed")}
                className={`rounded-md px-2.5 py-1 transition ${
                  formatFilter === "timed" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                Timed
              </button>
            </div>

            {/* Result: All, Wins, Losses */}
            <div className="inline-flex rounded-lg bg-black/[0.05] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setResultFilter("all")}
                className={`rounded-md px-2.5 py-1 transition ${
                  resultFilter === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                All Results
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("W")}
                className={`rounded-md px-2.5 py-1 transition ${
                  resultFilter === "W" ? "bg-emerald-600 text-white shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                Wins Only
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("L")}
                className={`rounded-md px-2.5 py-1 transition ${
                  resultFilter === "L" ? "bg-rose-600 text-white shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                Losses Only
              </button>
            </div>
          </div>

          {/* Expand/Collapse All Buttons */}
          {viewMode === "insights" && filteredGames.length > 0 && (
            <button
              type="button"
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}
              className="text-xs font-extrabold text-court-ink hover:underline cursor-pointer"
            >
              {allExpanded ? "Collapse All Cards" : "Expand All Cards"}
            </button>
          )}
        </div>

        {/* Highlights quick tags & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-black/[0.05]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">
              Filter By:
            </span>
            <button
              type="button"
              onClick={() => setHighlightFilter("all")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                highlightFilter === "all"
                  ? "bg-court-ink text-white"
                  : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
              }`}
            >
              All ({games.length})
            </button>
            <button
              type="button"
              onClick={() => setHighlightFilter("assists")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                highlightFilter === "assists"
                  ? "bg-court-ink text-white"
                  : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
              }`}
            >
              🪄 Assisted Teammates
            </button>
            <button
              type="button"
              onClick={() => setHighlightFilter("blocks")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                highlightFilter === "blocks"
                  ? "bg-court-ink text-white"
                  : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
              }`}
            >
              🧱 Blocked Opponents
            </button>
            <button
              type="button"
              onClick={() => setHighlightFilter("steals")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                highlightFilter === "steals"
                  ? "bg-court-ink text-white"
                  : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
              }`}
            >
              🥷 Steals & Takeaways
            </button>
            <button
              type="button"
              onClick={() => setHighlightFilter("scoring")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                highlightFilter === "scoring"
                  ? "bg-court-ink text-white"
                  : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
              }`}
            >
              🔥 10+ Points
            </button>
          </div>

          {/* Search by player name */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by opponent or teammate..."
              className="w-full rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-ink placeholder-muted focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-court-ink"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredGames.length === 0 ? (
        <div className="glass-1 rounded-2xl p-8 text-center text-sm text-muted space-y-2">
          <p className="font-semibold text-ink">No games match the selected filters.</p>
          <button
            type="button"
            onClick={() => {
              setFormatFilter("all");
              setResultFilter("all");
              setHighlightFilter("all");
              setSearchQuery("");
            }}
            className="text-xs font-bold text-court-ink hover:underline cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      ) : viewMode === "insights" ? (
        /* ------------------------------------------------------------- */
        /* VIEW 1: DETAILED INSIGHT CARDS                                */
        /* ------------------------------------------------------------- */
        <div className="space-y-3.5">
          {filteredGames.map((game) => {
            const isExpanded = expandedGameIds.has(game.gameId);
            return (
              <GameInsightCard
                key={game.gameId}
                game={game}
                isExpanded={isExpanded}
                onToggle={() => toggleGameExpanded(game.gameId)}
                currentPlayerId={currentPlayerId}
              />
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* VIEW 2: DENSE TABLE WITH INLINE EXPANSION                      */
        /* ------------------------------------------------------------- */
        <div className="glass-2 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="tabular w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="label text-muted border-b border-black/[0.06]">
                  <th className="sticky-cell px-3 py-2.5 text-left font-semibold">Game</th>
                  <th className="px-2 py-2 text-right font-semibold">PTS</th>
                  <th className="px-2 py-2 text-right font-semibold">RTG</th>
                  <th className="px-2 py-2 text-right font-semibold">FG</th>
                  <th className="px-2 py-2 text-right font-semibold">3P</th>
                  <th className="px-2 py-2 text-right font-semibold">FT</th>
                  <th className="px-2 py-2 text-right font-semibold">REB</th>
                  <th className="px-2 py-2 text-right font-semibold">AST</th>
                  <th className="px-2 py-2 text-right font-semibold">STL</th>
                  <th className="px-2 py-2 text-right font-semibold">BLK</th>
                  <th className="px-2 py-2 text-right font-semibold">TO</th>
                  <th className="px-2 py-2 text-right font-semibold">+/-</th>
                  <th className="px-2 py-2 text-right font-semibold">MIN</th>
                  <th className="px-3 py-2 text-center font-semibold">Insights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {filteredGames.map((game) => {
                  const isExpanded = expandedGameIds.has(game.gameId);
                  const isWin = game.result === "W";
                  return (
                    <tr
                      key={game.gameId}
                      className="hover:bg-black/[0.02] transition-colors cursor-pointer"
                      onClick={() => toggleGameExpanded(game.gameId)}
                    >
                      <td className="sticky-cell px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-black ${
                              isWin ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {game.result}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/games/${game.gameId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-extrabold text-ink hover:underline"
                            >
                              {game.score.mine}–{game.score.theirs}
                            </Link>
                            <div className="text-[11px] text-muted font-medium">
                              {formatDate(game.playedAt)} · {game.gameType === "timed" ? "Timed" : "Pickup"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-extrabold text-ink text-base">
                        {game.line.pts}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-court-ink">
                        {game.rating !== null ? game.rating.toFixed(1) : "–"}
                      </td>
                      <td className="px-2 py-2 text-right text-muted">
                        {game.line.fgm}-{game.line.fga}
                      </td>
                      <td className="px-2 py-2 text-right text-muted">
                        {game.line.fg3m}-{game.line.fg3a}
                      </td>
                      <td className="px-2 py-2 text-right text-muted">
                        {game.line.ftm}-{game.line.fta}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-ink">{game.line.reb}</td>
                      <td className="px-2 py-2 text-right font-semibold text-court-ink">{game.line.ast}</td>
                      <td className="px-2 py-2 text-right font-semibold text-emerald-800">{game.line.stl}</td>
                      <td className="px-2 py-2 text-right font-semibold text-amber-800">{game.line.blk}</td>
                      <td className="px-2 py-2 text-right text-muted">{game.line.tov}</td>
                      <td className="px-2 py-2 text-right font-medium">{fmtSigned(game.line.plusMinus)}</td>
                      <td className="px-2 py-2 text-right text-muted">{fmtMinutes(game.line.sec)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          className="rounded-lg bg-black/[0.05] hover:bg-black/10 px-2.5 py-1 text-xs font-bold text-ink transition cursor-pointer"
                        >
                          {isExpanded ? "Close ▲" : "View ▼"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Individual Rich Game Card with full expandable insights
 */
function GameInsightCard({
  game,
  isExpanded,
  onToggle,
  currentPlayerId,
}: {
  game: PlayerGameInsight;
  isExpanded: boolean;
  onToggle: () => void;
  currentPlayerId: number;
}) {
  const isWin = game.result === "W";
  const { line, scoring, assists, blocks, steals, turnovers } = game;

  // Build quick preview badge string for collapsed state
  const previewHighlights: string[] = [];
  if (scoring.totalPts >= 10) previewHighlights.push(`🔥 ${scoring.totalPts} PTS`);
  if (assists.totalAst > 0) {
    const top = assists.assistedPlayers[0];
    previewHighlights.push(
      top ? `🪄 Assisted ${shortName(top.playerName)}${top.count > 1 ? ` (${top.count})` : ""}` : `🪄 ${assists.totalAst} AST`,
    );
  }
  if (blocks.totalBlk > 0) {
    const top = blocks.blockedPlayers[0];
    previewHighlights.push(
      top ? `🧱 Blocked ${shortName(top.playerName)}${top.count > 1 ? ` (${top.count})` : ""}` : `🧱 ${blocks.totalBlk} BLK`,
    );
  }
  if (steals.totalStl > 0) {
    const top = steals.stolenFromPlayers[0];
    previewHighlights.push(
      top ? `🥷 Stole from ${shortName(top.playerName)}` : `🥷 ${steals.totalStl} STL`,
    );
  }

  return (
    <article className="glass-2 rounded-2xl overflow-hidden transition-all duration-200 border border-black/[0.06] shadow-sm">
      {/* Clickable Header Bar */}
      <div
        onClick={onToggle}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 gap-3 cursor-pointer hover:bg-black/[0.015] transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Result Box */}
          <div
            className={`grid h-12 w-12 place-items-center rounded-xl font-black text-base shrink-0 shadow-xs ${
              isWin ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            <span>{game.result}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/games/${game.gameId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-base font-black text-ink hover:underline flex items-center gap-1.5"
              >
                <span>Game #{game.gameId}</span>
                <span className="text-muted font-bold text-sm">
                  ({game.score.mine}–{game.score.theirs})
                </span>
              </Link>
              {game.gameType === "timed" ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-800">
                  Timed
                </span>
              ) : (
                <span className="rounded-full bg-court-ink/10 px-2 py-0.5 text-[10px] font-black text-court-ink">
                  Pickup (to {line.pts >= 20 ? 20 : 20})
                </span>
              )}
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold text-muted">
                Team {game.team}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-muted mt-0.5">
              <span>{formatDate(game.playedAt)}</span>
              <span>·</span>
              <span>{fmtMinutes(line.sec)} played</span>
              {line.plusMinus !== 0 && (
                <>
                  <span>·</span>
                  <span className={line.plusMinus > 0 ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}>
                    {fmtSigned(line.plusMinus)} +/-
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side stats summary & expand button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-black/[0.05]">
          <div className="flex items-center gap-2.5 tabular text-right">
            <div>
              <div className="text-lg font-black text-ink">{line.pts}</div>
              <div className="text-[10px] font-bold text-muted uppercase">PTS</div>
            </div>
            <div>
              <div className="text-lg font-black text-ink">{line.reb}</div>
              <div className="text-[10px] font-bold text-muted uppercase">REB</div>
            </div>
            <div>
              <div className="text-lg font-black text-court-ink">{line.ast}</div>
              <div className="text-[10px] font-bold text-court-ink uppercase">AST</div>
            </div>
            <div>
              <div className="text-lg font-black text-amber-800">{line.blk}</div>
              <div className="text-[10px] font-bold text-amber-800 uppercase">BLK</div>
            </div>
            <div>
              <div className="text-lg font-black text-emerald-800">{line.stl}</div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase">STL</div>
            </div>
            {game.rating !== null && (
              <div className="pl-1 border-l border-black/10">
                <div className="text-lg font-black text-court-ink">{game.rating.toFixed(1)}</div>
                <div className="text-[10px] font-bold text-muted uppercase">RTG</div>
              </div>
            )}
          </div>

          <div
            className={`grid h-8 w-8 place-items-center rounded-full bg-black/[0.04] text-sm font-bold text-muted transition-transform duration-200 ${
              isExpanded ? "rotate-180 bg-black/[0.08] text-ink" : ""
            }`}
          >
            ▼
          </div>
        </div>
      </div>

      {/* Quick Preview Chips (when collapsed) */}
      {!isExpanded && previewHighlights.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-black/[0.03] pt-2">
          {previewHighlights.map((hl) => (
            <span
              key={hl}
              className="inline-flex items-center rounded-lg bg-black/[0.03] px-2 py-0.5 text-[11px] font-extrabold text-ink"
            >
              {hl}
            </span>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* EXPANDED DETAILED INSIGHTS BODY                             */}
      {/* ----------------------------------------------------------- */}
      {isExpanded && (
        <div className="border-t border-black/[0.07] bg-white/40 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
          {/* Top Quick Bar: Shooting splits & creation ratio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-xl bg-black/[0.03] p-2">
              <div className="text-muted font-bold text-[10px]">FIELD GOALS</div>
              <div className="font-extrabold text-ink text-sm">
                {line.fgm}/{line.fga}{" "}
                <span className="text-[11px] text-muted font-normal">
                  ({scoring.fgPct.toFixed(0)}%)
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-2">
              <div className="text-muted font-bold text-[10px]">3-POINTERS</div>
              <div className="font-extrabold text-ink text-sm">
                {line.fg3m}/{line.fg3a}{" "}
                <span className="text-[11px] text-muted font-normal">
                  ({line.fg3a > 0 ? ((line.fg3m / line.fg3a) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-2">
              <div className="text-muted font-bold text-[10px]">FREE THROWS</div>
              <div className="font-extrabold text-ink text-sm">
                {line.ftm}/{line.fta}
              </div>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-2">
              <div className="text-muted font-bold text-[10px]">REBOUNDS (O / D)</div>
              <div className="font-extrabold text-ink text-sm">
                {line.reb}{" "}
                <span className="text-[11px] text-muted font-normal">
                  ({game.rebounds.oreb} off / {game.rebounds.dreb} def)
                </span>
              </div>
            </div>
          </div>

          {/* Core Insights Grid: 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. SCORING & SHOT CREATION */}
            <div className="rounded-2xl bg-white/80 p-3.5 space-y-2.5 ring-1 ring-black/5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-court-ink flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>Scoring & Shot Creation</span>
                </span>
                <span className="text-xs font-black text-ink">
                  {scoring.totalPts} Points
                </span>
              </div>

              {/* Makes breakdown */}
              <div className="text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-muted">Total Baskets Made:</span>
                  <span className="font-extrabold text-ink">{line.fgm} FGM</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>· Assisted makes:</span>
                  <span className="font-bold text-ink">{scoring.assistedMakesCount}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>· Self-created / unassisted:</span>
                  <span className="font-bold text-ink">{scoring.unassistedMakesCount}</span>
                </div>

                {/* Assisted By Details */}
                {scoring.assistedBy.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-black/[0.05] space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-court-ink">
                      Assisted by teammates:
                    </div>
                    {scoring.assistedBy.map((a) => (
                      <Link
                        key={a.playerId}
                        href={`/players/${a.playerId}`}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-black/[0.02] hover:bg-black/[0.05] transition text-xs group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={a.playerName} size="sm" />
                          <span className="font-extrabold text-ink truncate group-hover:underline">
                            {a.playerName}
                          </span>
                        </div>
                        <span className="tabular font-black text-court-ink text-xs">
                          {a.count} {a.count === 1 ? "assist" : "assists"}
                          <span className="text-[10px] text-muted font-normal ml-1">
                            ({a.points} pts)
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Shot zones if recorded */}
                {scoring.zones.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-black/[0.05] space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                      Charted Shot Zones:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {scoring.zones.map((z) => (
                        <span
                          key={z.zone}
                          className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[10px] font-bold text-ink"
                        >
                          {z.label}: {z.made}/{z.attempted}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PLAYMAKING & ASSISTS */}
            <div className="rounded-2xl bg-white/80 p-3.5 space-y-2.5 ring-1 ring-black/5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-court-ink flex items-center gap-1.5">
                  <span>🪄</span>
                  <span>Assists & Playmaking</span>
                </span>
                <span className="text-xs font-black text-court-ink">
                  {assists.totalAst} Assists
                </span>
              </div>

              {assists.totalAst === 0 ? (
                <p className="text-xs text-muted py-2 italic">
                  No assists recorded in this game.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Teammates set up for baskets:
                  </div>
                  {assists.assistedPlayers.map((p) => (
                    <Link
                      key={p.playerId}
                      href={`/players/${p.playerId}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-court-ink/[0.04] hover:bg-court-ink/[0.08] transition text-xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={p.playerName} size="sm" />
                        <div>
                          <div className="font-extrabold text-ink truncate group-hover:underline">
                            {p.playerName}
                          </div>
                          <div className="text-[10px] text-muted font-medium">
                            {p.twoPointers > 0 && `${p.twoPointers}× 2PT`}
                            {p.twoPointers > 0 && p.threePointers > 0 && " · "}
                            {p.threePointers > 0 && `${p.threePointers}× 3PT`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-court-ink text-xs">
                          {p.count} {p.count === 1 ? "assist" : "assists"}
                        </div>
                        <div className="text-[10px] font-bold text-muted">
                          {p.pointsGenerated} pts generated
                        </div>
                      </div>
                    </Link>
                  ))}
                  {assists.unattributedAst > 0 && (
                    <div className="text-[11px] text-muted italic">
                      + {assists.unattributedAst} unattributed assist
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. RIM PROTECTION & BLOCKS */}
            <div className="rounded-2xl bg-white/80 p-3.5 space-y-2.5 ring-1 ring-black/5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <span>🧱</span>
                  <span>Blocks & Rim Protection</span>
                </span>
                <span className="text-xs font-black text-amber-800">
                  {blocks.totalBlk} Blocks
                </span>
              </div>

              {blocks.totalBlk === 0 ? (
                <p className="text-xs text-muted py-2 italic">
                  No blocks recorded in this game.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Opponents rejected at the rim:
                  </div>
                  {blocks.blockedPlayers.map((o) => (
                    <Link
                      key={o.playerId}
                      href={`/players/${o.playerId}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-amber-500/[0.06] hover:bg-amber-500/[0.12] transition text-xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={o.playerName} size="sm" />
                        <span className="font-extrabold text-ink truncate group-hover:underline">
                          {o.playerName}
                        </span>
                      </div>
                      <span className="tabular font-black text-amber-800 text-xs">
                        {o.count} {o.count === 1 ? "shot blocked" : "shots blocked"}
                      </span>
                    </Link>
                  ))}
                  {blocks.unattributedBlk > 0 && (
                    <div className="text-[11px] text-muted italic">
                      + {blocks.unattributedBlk} unattributed block
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. STEALS & TAKEAWAYS */}
            <div className="rounded-2xl bg-white/80 p-3.5 space-y-2.5 ring-1 ring-black/5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <span>🥷</span>
                  <span>Steals & Takeaways</span>
                </span>
                <span className="text-xs font-black text-emerald-800">
                  {steals.totalStl} Steals · {game.defense.defl} Defl
                </span>
              </div>

              {steals.totalStl === 0 && game.defense.defl === 0 ? (
                <p className="text-xs text-muted py-2 italic">
                  No steals or deflections recorded in this game.
                </p>
              ) : (
                <div className="space-y-2">
                  {steals.stolenFromPlayers.length > 0 && (
                    <>
                      <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                        Opponents stripped of the ball:
                      </div>
                      {steals.stolenFromPlayers.map((o) => (
                        <Link
                          key={o.playerId}
                          href={`/players/${o.playerId}`}
                          className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] transition text-xs group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={o.playerName} size="sm" />
                            <span className="font-extrabold text-ink truncate group-hover:underline">
                              {o.playerName}
                            </span>
                          </div>
                          <span className="tabular font-black text-emerald-800 text-xs">
                            {o.count} {o.count === 1 ? "steal" : "steals"}
                          </span>
                        </Link>
                      ))}
                    </>
                  )}
                  {steals.unattributedStl > 0 && (
                    <div className="text-[11px] text-muted italic">
                      + {steals.unattributedStl} unattributed steal
                    </div>
                  )}
                  {game.defense.defl > 0 && (
                    <div className="text-xs text-muted font-medium pt-1 border-t border-black/[0.05]">
                      ⚡ Disruptions: {game.defense.defl} deflections
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Turnovers & Opponent Resistance (if any happened) */}
          {(turnovers.totalTov > 0 || game.blockedBy.length > 0) && (
            <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2 text-xs border border-black/[0.05]">
              <div className="font-black uppercase tracking-wider text-muted text-[10px] flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Ball Security & Opponent Defense</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted">
                {turnovers.totalTov > 0 && (
                  <div>
                    <span className="font-bold text-ink">{turnovers.totalTov} Turnovers</span>
                    {turnovers.stolenByPlayers.length > 0 && (
                      <span className="ml-1">
                        (stolen by {turnovers.stolenByPlayers.map((s) => s.playerName).join(", ")})
                      </span>
                    )}
                  </div>
                )}
                {game.blockedBy.length > 0 && (
                  <div>
                    <span className="font-bold text-ink">Shots Blocked:</span>{" "}
                    blocked by {game.blockedBy.map((b) => `${b.playerName} (${b.count})`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lineup & Matchups */}
          <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2 text-xs border border-black/[0.05]">
            <div className="font-black uppercase tracking-wider text-muted text-[10px] flex items-center gap-1.5">
              <span>👥</span>
              <span>Game Lineup & Matchup</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Teammates */}
              <div>
                <div className="text-[11px] font-bold text-muted mb-1">
                  Teammates (Team {game.team}):
                </div>
                {game.teammates.length === 0 ? (
                  <span className="text-muted italic">Solo game</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {game.teammates.map((t) => (
                      <Link
                        key={t.id}
                        href={`/players/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink shadow-2xs hover:bg-court-ink hover:text-white transition"
                      >
                        <Avatar name={t.name} size="sm" />
                        <span>{t.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Opponents */}
              <div>
                <div className="text-[11px] font-bold text-muted mb-1">
                  Opponents (Team {game.team === "A" ? "B" : "A"}):
                </div>
                {game.opponents.length === 0 ? (
                  <span className="text-muted italic">None</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {game.opponents.map((o) => (
                      <div key={o.id} className="inline-flex items-center gap-1">
                        <Link
                          href={`/players/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink shadow-2xs hover:bg-black hover:text-white transition"
                        >
                          <Avatar name={o.name} size="sm" />
                          <span>{o.name}</span>
                        </Link>
                        {currentPlayerId && (
                          <Link
                            href={`/compare?p1=${currentPlayerId}&p2=${o.id}`}
                            className="rounded-full bg-court-ink/10 px-1.5 py-0.5 text-[9px] font-black text-court-ink hover:bg-court-ink hover:text-white transition"
                            title="Compare head-to-head"
                          >
                            VS
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Direct link to game */}
          <div className="pt-1 flex justify-end">
            <Link
              href={`/games/${game.gameId}`}
              className="inline-flex items-center gap-1.5 text-xs font-black text-court-ink hover:underline"
            >
              <span>View Full Game Box Score & Play-by-Play</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

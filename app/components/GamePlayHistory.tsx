"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { shortName } from "./Avatar";
import type { GameHistoryInsights, GameChronologicalPlay } from "@/lib/gameHistory";
import type { Team } from "@/lib/stats";

type TeamFilter = "all" | "A" | "B";
type ActionFilter = "all" | "scoring" | "assists" | "blocks" | "steals" | "rebounds" | "turnovers";

export function GamePlayHistory({
  insights,
  teamNames = { A: "Team A", B: "Team B" },
}: {
  insights: GameHistoryInsights;
  teamNames?: Record<Team, string>;
}) {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [playerFilter, setPlayerFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllPlays, setShowAllPlays] = useState(false);

  // Extract all unique players who appeared in plays
  const allPlayersInGame = useMemo(() => {
    const map = new Map<number, { id: number; name: string; team?: Team }>();
    for (const p of insights.plays) {
      if (p.primaryPlayer) map.set(p.primaryPlayer.id, p.primaryPlayer);
      if (p.secondaryPlayer) map.set(p.secondaryPlayer.id, p.secondaryPlayer);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [insights.plays]);

  // Filtered chronological plays
  const filteredPlays = useMemo(() => {
    return insights.plays.filter((p) => {
      if (teamFilter !== "all" && p.team !== teamFilter) return false;

      if (actionFilter === "scoring" && !p.isScoring) return false;
      if (actionFilter === "assists" && p.type !== "AST" && !p.detail.includes("Assisted by")) return false;
      if (actionFilter === "blocks" && p.type !== "BLK" && !p.detail.includes("Blocked by")) return false;
      if (actionFilter === "steals" && p.type !== "STL" && !p.title.includes("steal")) return false;
      if (actionFilter === "rebounds" && p.type !== "OREB" && p.type !== "DREB" && !p.detail.includes("rebound")) return false;
      if (actionFilter === "turnovers" && p.type !== "TOV" && !p.title.includes("turnover")) return false;

      if (playerFilter !== "all") {
        const matchesPrimary = p.primaryPlayer?.id === playerFilter;
        const matchesSecondary = p.secondaryPlayer?.id === playerFilter;
        if (!matchesPrimary && !matchesSecondary) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDetail = p.detail.toLowerCase().includes(q);
        const matchesPrimary = p.primaryPlayer?.name.toLowerCase().includes(q);
        const matchesSecondary = p.secondaryPlayer?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDetail && !matchesPrimary && !matchesSecondary) {
          return false;
        }
      }

      return true;
    });
  }, [insights.plays, teamFilter, actionFilter, playerFilter, searchQuery]);

  const displayedPlays = showAllPlays ? filteredPlays : filteredPlays.slice(0, 40);
  const hasMorePlays = filteredPlays.length > 40 && !showAllPlays;

  return (
    <section className="space-y-4">
      {/* Section Title */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between px-1">
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl flex items-center gap-2">
            <span>📜</span>
            <span>Game History & Play Insights</span>
          </h2>
          <p className="text-xs font-medium text-muted mt-0.5">
            Detailed breakdown of every assist connection, rim rejection, takeaway, and the complete play-by-play narrative.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted">
          {insights.totalPlays} total plays · {insights.leadChanges} lead changes · {insights.timesTied} ties
        </div>
      </div>

      {/* Matchup Synergy & Target Banners */}
      <div className="glass-2 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-court-ink flex items-center gap-1.5">
            <span>⚡</span>
            <span>Head-to-Head & Playmaking Matrix</span>
          </span>
          {insights.biggestRun && (
            <span className="text-xs font-bold text-ink">
              Biggest run:{" "}
              <strong className="text-court-ink">
                {teamNames[insights.biggestRun.team]} {insights.biggestRun.pts}–0 run
              </strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Assists in this game */}
          <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2 border border-black/[0.04]">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
              <span>🪄 Assists ({insights.assists.reduce((s, a) => s + a.count, 0)})</span>
              <span className="text-court-ink font-extrabold">Playmaking</span>
            </div>
            {insights.assists.length === 0 ? (
              <p className="text-xs text-muted italic py-1">No assists recorded in this game.</p>
            ) : (
              <div className="space-y-2 pt-0.5 max-h-52 overflow-y-auto pr-1">
                {insights.assists.map((a) => (
                  <div
                    key={`${a.assisterId}->${a.scorerId}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white/70 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link
                        href={`/players/${a.assisterId}`}
                        className="font-extrabold text-ink truncate hover:underline hover:text-court-ink transition"
                      >
                        {shortName(a.assisterName)}
                      </Link>
                      <span className="text-muted text-[10px]">→</span>
                      <Link
                        href={`/players/${a.scorerId}`}
                        className="font-extrabold text-muted truncate hover:underline hover:text-ink transition"
                      >
                        {shortName(a.scorerName)}
                      </Link>
                    </div>
                    <span className="tabular font-black text-court-ink shrink-0 text-xs">
                      {a.count} {a.count === 1 ? "ast" : "asts"}{" "}
                      <span className="text-[10px] text-muted font-normal">({a.pointsGenerated} pts)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Blocks in this game */}
          <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2 border border-black/[0.04]">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
              <span>🧱 Blocks ({insights.blocks.reduce((s, b) => s + b.count, 0)})</span>
              <span className="text-amber-800 font-extrabold">Rim Rejections</span>
            </div>
            {insights.blocks.length === 0 ? (
              <p className="text-xs text-muted italic py-1">No blocks recorded in this game.</p>
            ) : (
              <div className="space-y-2 pt-0.5 max-h-52 overflow-y-auto pr-1">
                {insights.blocks.map((b) => (
                  <div
                    key={`${b.blockerId}->${b.shooterId}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white/70 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link
                        href={`/players/${b.blockerId}`}
                        className="font-extrabold text-ink truncate hover:underline hover:text-amber-800 transition"
                      >
                        {shortName(b.blockerName)}
                      </Link>
                      <span className="text-muted text-[10px]">blocked</span>
                      <Link
                        href={`/players/${b.shooterId}`}
                        className="font-extrabold text-muted truncate hover:underline hover:text-ink transition"
                      >
                        {shortName(b.shooterName)}
                      </Link>
                    </div>
                    <span className="tabular font-black text-amber-800 shrink-0 text-xs">
                      {b.count} {b.count === 1 ? "blk" : "blks"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Steals in this game */}
          <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2 border border-black/[0.04]">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
              <span>🥷 Steals ({insights.steals.reduce((s, st) => s + st.count, 0)})</span>
              <span className="text-emerald-800 font-extrabold">Takeaways</span>
            </div>
            {insights.steals.length === 0 ? (
              <p className="text-xs text-muted italic py-1">No steals recorded in this game.</p>
            ) : (
              <div className="space-y-2 pt-0.5 max-h-52 overflow-y-auto pr-1">
                {insights.steals.map((st) => (
                  <div
                    key={`${st.stealerId}->${st.victimId}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white/70 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link
                        href={`/players/${st.stealerId}`}
                        className="font-extrabold text-ink truncate hover:underline hover:text-emerald-800 transition"
                      >
                        {shortName(st.stealerName)}
                      </Link>
                      <span className="text-muted text-[10px]">from</span>
                      <Link
                        href={`/players/${st.victimId}`}
                        className="font-extrabold text-muted truncate hover:underline hover:text-ink transition"
                      >
                        {shortName(st.victimName)}
                      </Link>
                    </div>
                    <span className="tabular font-black text-emerald-800 shrink-0 text-xs">
                      {st.count} {st.count === 1 ? "stl" : "stls"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Shot Creation Breakdown per Team */}
          <div className="rounded-2xl bg-black/[0.03] p-3.5 space-y-2.5 border border-black/[0.04]">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center justify-between">
              <span>🎯 Shot Creation</span>
              <span className="text-purple-800 font-extrabold">Ball Movement</span>
            </div>
            <div className="space-y-2 text-xs">
              {/* Team A */}
              <div className="p-2 rounded-xl bg-white/70 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between font-extrabold">
                  <span className="text-court-ink">{teamNames.A}</span>
                  <span className="text-ink">
                    {insights.teamCreation.A.assistedPct}% assisted
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between">
                  <span>{insights.teamCreation.A.assistedMakes} assisted makes</span>
                  <span>{insights.teamCreation.A.unassistedMakes} unassisted</span>
                </div>
              </div>

              {/* Team B */}
              <div className="p-2 rounded-xl bg-white/70 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between font-extrabold">
                  <span className="text-away-dark">{teamNames.B}</span>
                  <span className="text-ink">
                    {insights.teamCreation.B.assistedPct}% assisted
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between">
                  <span>{insights.teamCreation.B.assistedMakes} assisted makes</span>
                  <span>{insights.teamCreation.B.unassistedMakes} unassisted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Play-by-Play & Game Timeline */}
      <div className="glass-2 rounded-3xl p-4 sm:p-5 space-y-4">
        {/* Play log Header & Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-black/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-ink">Chronological Play Narrative</span>
              <span className="rounded-full bg-court-ink/10 px-2.5 py-0.5 text-[10px] font-black text-court-ink">
                {filteredPlays.length} {filteredPlays.length === 1 ? "play" : "plays"}
              </span>
            </div>

            {/* Team Filter Pills */}
            <div className="inline-flex rounded-xl bg-black/[0.05] p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTeamFilter("all")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  teamFilter === "all" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                All Teams
              </button>
              <button
                type="button"
                onClick={() => setTeamFilter("A")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  teamFilter === "A" ? "bg-white text-court-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                {teamNames.A}
              </button>
              <button
                type="button"
                onClick={() => setTeamFilter("B")}
                className={`rounded-lg px-2.5 py-1 transition ${
                  teamFilter === "B" ? "bg-white text-away-dark shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                {teamNames.B}
              </button>
            </div>
          </div>

          {/* Action Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActionFilter("all")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "all"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                All Plays
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("scoring")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "scoring"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                🏀 Scoring
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("assists")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "assists"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                🪄 Assists
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("blocks")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "blocks"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                🧱 Blocks
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("steals")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "steals"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                🥷 Steals
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("rebounds")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  actionFilter === "rebounds"
                    ? "bg-court-ink text-white"
                    : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                }`}
              >
                🦍 Rebounds
              </button>
            </div>

            {/* Filter by player dropdown & Search */}
            <div className="flex items-center gap-2">
              {allPlayersInGame.length > 0 && (
                <select
                  value={playerFilter}
                  onChange={(e) =>
                    setPlayerFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="rounded-xl bg-black/[0.04] px-2.5 py-1.5 text-xs font-semibold text-ink focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Players</option>
                  {allPlayersInGame.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.team ? `(Team ${p.team})` : ""}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plays..."
                className="w-36 sm:w-44 rounded-xl bg-black/[0.04] px-2.5 py-1.5 text-xs font-semibold text-ink placeholder-muted focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-court-ink"
              />
            </div>
          </div>
        </div>

        {/* Plays List */}
        {filteredPlays.length === 0 ? (
          <div className="rounded-2xl bg-black/[0.02] p-8 text-center text-sm text-muted">
            No plays match the selected filters.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="divide-y divide-black/[0.05] rounded-2xl bg-white/60 overflow-hidden border border-black/[0.05]">
              {displayedPlays.map((play) => (
                <ChronologicalPlayRow
                  key={`${play.grp}-${play.step}`}
                  play={play}
                  teamNames={teamNames}
                />
              ))}
            </div>

            {hasMorePlays && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllPlays(true)}
                  className="rounded-xl bg-black/[0.05] hover:bg-black/10 px-4 py-2 text-xs font-extrabold text-ink transition cursor-pointer"
                >
                  Show remaining {filteredPlays.length - 40} plays ▼
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Individual Chronological Play Row
 */
function ChronologicalPlayRow({
  play,
  teamNames,
}: {
  play: GameChronologicalPlay;
  teamNames: Record<Team, string>;
}) {
  const isA = play.team === "A";

  return (
    <div
      className={`flex items-start sm:items-center justify-between p-3 gap-3 transition-colors ${
        play.isClutch ? "bg-amber-500/[0.05]" : play.isScoring ? "hover:bg-black/[0.015]" : ""
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Play Icon */}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.04] text-base shadow-2xs">
          {play.icon}
        </span>

        {/* Description & Actors */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-xs sm:text-sm text-ink">{play.title}</span>
            {play.team && (
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-black ${
                  isA ? "bg-court-ink/10 text-court-ink" : "bg-sky-500/10 text-away-dark"
                }`}
              >
                {teamNames[play.team]}
              </span>
            )}
            {play.isClutch && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.2 text-[9px] font-black uppercase tracking-wider text-rose-700 animate-pulse">
                Clutch
              </span>
            )}
          </div>

          <div className="text-xs text-muted font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{play.detail}</span>
            {play.timeStr && play.timeStr !== "0:00" && (
              <>
                <span>·</span>
                <span className="tabular text-[11px] text-muted">{play.timeStr}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Running Score at This Play */}
      <div className="shrink-0 text-right pl-2">
        <div className="tabular text-xs sm:text-sm font-black text-ink">
          <span className={play.marginAfter > 0 ? "text-court-ink" : "text-ink"}>
            {play.scoreAfter.A}
          </span>
          <span className="text-muted font-normal mx-1">–</span>
          <span className={play.marginAfter < 0 ? "text-away-dark" : "text-ink"}>
            {play.scoreAfter.B}
          </span>
        </div>
        <div className="text-[10px] font-bold text-muted">
          {play.leaderAfter === "TIE" ? (
            "Tied"
          ) : (
            <span className={play.leaderAfter === "A" ? "text-court-ink" : "text-away-dark"}>
              {teamNames[play.leaderAfter]} +{Math.abs(play.marginAfter)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

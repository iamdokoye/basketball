"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import {
  type ArchetypeNodeId,
  type PlayerTreeItem,
  SKILL_TREE_NODES,
  SKILL_TREE_TIERS,
} from "@/lib/skillTree";
import { ARCHETYPE_TIER_META, type ArchetypeTier } from "@/lib/badges";

type ViewMode = "diagram" | "table";
type TimeMode = "season" | "allTime";

export function ArchetypeTreeClient({
  seasonPlayers,
  allTimePlayers,
  seasonLabel,
  initialPlayerId,
}: {
  seasonPlayers: PlayerTreeItem[];
  allTimePlayers: PlayerTreeItem[];
  seasonLabel: string;
  initialPlayerId?: number;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("diagram");
  const [timeMode, setTimeMode] = useState<TimeMode>("season");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(
    initialPlayerId ?? null,
  );
  const [tierFilter, setTierFilter] = useState<"all" | ArchetypeTier>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideArchived, setHideArchived] = useState(true);

  // Expanded state for table tree tiers (all open by default)
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({
    4: true,
    3: true,
    2: true,
    1: true,
    0: true,
  });

  const activePlayers = timeMode === "season" ? seasonPlayers : allTimePlayers;

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return activePlayers.filter((p) => {
      if (hideArchived && p.archived) return false;
      if (tierFilter !== "all" && p.archetype.tier !== tierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesArchetype = p.archetype.title.toLowerCase().includes(q);
        const matchesRoad = p.targetTitle.toLowerCase().includes(q);
        const matchesNick = p.nicknames.some((n) => n.toLowerCase().includes(q));
        return matchesName || matchesArchetype || matchesRoad || matchesNick;
      }
      return true;
    });
  }, [activePlayers, hideArchived, tierFilter, searchQuery]);

  // Selected player object
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return activePlayers.find((p) => p.id === selectedPlayerId) ?? null;
  }, [activePlayers, selectedPlayerId]);

  // Map of players grouped by node ID
  const playersByNode = useMemo(() => {
    const map = new Map<ArchetypeNodeId, PlayerTreeItem[]>();
    for (const p of filteredPlayers) {
      const list = map.get(p.nodeId) ?? [];
      list.push(p);
      map.set(p.nodeId, list);
    }
    return map;
  }, [filteredPlayers]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of activePlayers) {
      if (hideArchived && p.archived) continue;
      counts[p.archetype.tier] = (counts[p.archetype.tier] ?? 0) + 1;
    }
    return counts;
  }, [activePlayers, hideArchived]);

  const totalActivePlayers = Object.values(tierCounts).reduce((a, b) => a + b, 0);

  // Player closest to next tier graduation ("On the Cusp")
  const closestToGraduation = useMemo(() => {
    const eligible = activePlayers
      .filter((p) => (!hideArchived || !p.archived) && p.archetype.tier < 4 && p.roadProgressPct < 100)
      .sort((a, b) => b.roadProgressPct - a.roadProgressPct);
    return eligible[0] ?? null;
  }, [activePlayers, hideArchived]);

  // Total unique archetypes unlocked by at least one player
  const unlockedArchetypeCount = useMemo(() => {
    const unique = new Set<string>();
    for (const p of activePlayers) {
      if (hideArchived && p.archived) continue;
      unique.add(p.nodeId);
    }
    return unique.size;
  }, [activePlayers, hideArchived]);

  const toggleTierAccordion = (tier: number) => {
    setExpandedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <section className="glass-2 relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl" aria-hidden>
                🌳
              </span>
              <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
                Archetype Skill Tree
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted sm:text-sm">
              The complete progression roadmap from{" "}
              <strong className="text-ink">Tier 0 Foundations</strong> to the supreme{" "}
              <strong className="text-emerald-700">Tier 4 Apex</strong>. Track each
              player&apos;s active road, milestone percentages, and exact requirements.
            </p>
          </div>

          {/* Time & View Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Season vs All-Time */}
            <div className="inline-flex rounded-xl bg-black/[0.05] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTimeMode("season")}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  timeMode === "season"
                    ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                    : "text-muted hover:text-ink"
                }`}
              >
                {seasonLabel} Season
              </button>
              <button
                type="button"
                onClick={() => setTimeMode("allTime")}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  timeMode === "allTime"
                    ? "bg-white text-ink shadow-xs ring-1 ring-black/5"
                    : "text-muted hover:text-ink"
                }`}
              >
                All-Time Career
              </button>
            </div>

            {/* View Mode: Diagram vs Table */}
            <div className="inline-flex rounded-xl bg-black/[0.05] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("diagram")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  viewMode === "diagram"
                    ? "bg-court-ink text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>🎨</span>
                <span>Diagram Tree</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  viewMode === "table"
                    ? "bg-court-ink text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>📋</span>
                <span>Table Tree</span>
              </button>
            </div>
          </div>
        </div>

        {/* League Census & Spotlight Banner */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Spotlight: On the Cusp */}
          {closestToGraduation && (
            <div
              onClick={() => setSelectedPlayerId(closestToGraduation.id)}
              className="glass-1 cursor-pointer rounded-2xl p-3.5 transition-all hover:scale-[1.01] hover:ring-2 hover:ring-court-ink/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-court-ink">
                  <span>⚡</span>
                  <span>On the Cusp of Tier Up</span>
                </span>
                <span className="tabular rounded-full bg-court-soft/10 px-2 py-0.5 text-xs font-black text-court-ink ring-1 ring-inset ring-court-ink/20">
                  {closestToGraduation.roadProgressPct}%
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <Avatar name={closestToGraduation.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold text-ink">
                    {closestToGraduation.name}
                  </div>
                  <div className="truncate text-[11px] font-semibold text-muted">
                    {closestToGraduation.archetype.emoji} {closestToGraduation.archetype.title} →{" "}
                    <span className="text-court-ink font-bold">
                      {closestToGraduation.targetEmoji} {closestToGraduation.targetTitle}
                    </span>
                  </div>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full bg-court-ink transition-all duration-500"
                  style={{ width: `${closestToGraduation.roadProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Archetypes Discovered */}
          <div className="glass-1 flex flex-col justify-between rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-muted">
              <span>Archetypes Discovered</span>
              <span>{unlockedArchetypeCount} / 18</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🏆
              </span>
              <div>
                <div className="text-base font-black text-ink">
                  {Math.round((unlockedArchetypeCount / 18) * 100)}% of Tree Unlocked
                </div>
                <div className="text-[11px] font-medium text-muted">
                  Across {totalActivePlayers} active players
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < unlockedArchetypeCount ? "bg-court-ink" : "bg-black/[0.08]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Tier Census Breakdown */}
          <div className="glass-1 flex flex-col justify-between rounded-2xl p-3.5 sm:col-span-2 lg:col-span-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted">
              League Tier Distribution
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-extrabold">
              <span className="text-emerald-700">T4: {tierCounts[4] ?? 0}</span>
              <span className="text-muted/40">·</span>
              <span className="text-purple-700">T3: {tierCounts[3] ?? 0}</span>
              <span className="text-muted/40">·</span>
              <span className="text-amber-700">T2: {tierCounts[2] ?? 0}</span>
              <span className="text-muted/40">·</span>
              <span className="text-sky-700">T1: {tierCounts[1] ?? 0}</span>
              <span className="text-muted/40">·</span>
              <span className="text-slate-600">T0: {tierCounts[0] ?? 0}</span>
            </div>
            {/* Visual segmented bar */}
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              {totalActivePlayers > 0 && (
                <>
                  <div
                    style={{ width: `${((tierCounts[4] ?? 0) / totalActivePlayers) * 100}%` }}
                    className="bg-emerald-500"
                    title={`Tier 4: ${tierCounts[4]}`}
                  />
                  <div
                    style={{ width: `${((tierCounts[3] ?? 0) / totalActivePlayers) * 100}%` }}
                    className="bg-purple-500"
                    title={`Tier 3: ${tierCounts[3]}`}
                  />
                  <div
                    style={{ width: `${((tierCounts[2] ?? 0) / totalActivePlayers) * 100}%` }}
                    className="bg-amber-400"
                    title={`Tier 2: ${tierCounts[2]}`}
                  />
                  <div
                    style={{ width: `${((tierCounts[1] ?? 0) / totalActivePlayers) * 100}%` }}
                    className="bg-sky-400"
                    title={`Tier 1: ${tierCounts[1]}`}
                  />
                  <div
                    style={{ width: `${((tierCounts[0] ?? 0) / totalActivePlayers) * 100}%` }}
                    className="bg-slate-300"
                    title={`Tier 0: ${tierCounts[0]}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="glass-1 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tier Quick-Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTierFilter("all")}
            className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
              tierFilter === "all"
                ? "bg-ink text-paper shadow-xs"
                : "bg-black/[0.05] text-muted hover:text-ink"
            }`}
          >
            All Tiers ({totalActivePlayers})
          </button>
          {SKILL_TREE_TIERS.map((t) => {
            const count = tierCounts[t.tier] ?? 0;
            const isSelected = tierFilter === t.tier;
            return (
              <button
                key={t.tier}
                type="button"
                onClick={() => setTierFilter(isSelected ? "all" : t.tier)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  isSelected
                    ? `${t.badgeClass} ring-2 ring-current`
                    : "bg-black/[0.05] text-muted hover:text-ink"
                }`}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search input & Archived toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or road..."
              className="w-full rounded-xl bg-black/[0.05] px-3 py-1.5 text-xs font-medium text-ink placeholder:text-muted/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-court-ink/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHideArchived(!hideArchived)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
              !hideArchived
                ? "bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/30"
                : "bg-black/[0.05] text-muted hover:text-ink"
            }`}
            title="Toggle showing archived/inactive players"
          >
            Archived {hideArchived ? "Hidden" : "Shown"}
          </button>
        </div>
      </section>

      {/* Main View Area: Diagram or Table */}
      {viewMode === "diagram" ? (
        <DiagramTreeView
          playersByNode={playersByNode}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={(p) => setSelectedPlayerId(p.id)}
          tierFilter={tierFilter}
        />
      ) : (
        <TableTreeView
          players={filteredPlayers}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={(p) => setSelectedPlayerId(p.id)}
          expandedTiers={expandedTiers}
          onToggleTier={toggleTierAccordion}
        />
      )}

      {/* Selected Player Road Inspector Drawer/Modal */}
      {selectedPlayer && (
        <PlayerRoadInspector
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 1: DIAGRAM TREE VIEW
// ---------------------------------------------------------------------------
function DiagramTreeView({
  playersByNode,
  selectedPlayer,
  onSelectPlayer,
  tierFilter,
}: {
  playersByNode: Map<ArchetypeNodeId, PlayerTreeItem[]>;
  selectedPlayer: PlayerTreeItem | null;
  onSelectPlayer: (player: PlayerTreeItem) => void;
  tierFilter: "all" | ArchetypeTier;
}) {
  const tiersToRender = SKILL_TREE_TIERS.filter(
    (t) => tierFilter === "all" || t.tier === tierFilter,
  );

  return (
    <div className="relative space-y-8">
      {tiersToRender.map((tierMeta, tierIndex) => {
        return (
          <div key={tierMeta.tier} className="relative">
            {/* Visual connector line between tiers */}
            {tierIndex < tiersToRender.length - 1 && (
              <div
                aria-hidden
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none"
              >
                <div className="h-8 w-0.5 bg-gradient-to-b from-black/15 to-black/5" />
                <div className="text-[10px] text-muted/60 font-black">▼</div>
              </div>
            )}

            {/* Tier Card Container */}
            <div
              className={`glass-2 relative overflow-hidden rounded-3xl p-5 ring-1 ${tierMeta.borderColor} transition-all`}
              style={{
                boxShadow: `0 4px 24px ${tierMeta.glowColor}`,
              }}
            >
              {/* Tier Header */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-black/[0.06] pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tierMeta.badgeClass}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${tierMeta.dotClass}`} />
                    {tierMeta.label} · {tierMeta.title}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    {tierMeta.tagline}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-muted bg-black/[0.04] px-2.5 py-1 rounded-xl">
                  {tierMeta.requirementSummary}
                </div>
              </div>

              {/* Archetype Nodes Grid */}
              <div
                className={`grid gap-3.5 ${
                  tierMeta.tier === 4
                    ? "grid-cols-1 max-w-xl mx-auto"
                    : tierMeta.tier === 3
                      ? "grid-cols-1 md:grid-cols-3"
                      : tierMeta.tier === 2
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                        : tierMeta.tier === 1
                          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                          : "grid-cols-1 md:grid-cols-3"
                }`}
              >
                {tierMeta.nodeIds.map((nodeId) => {
                  const node = SKILL_TREE_NODES[nodeId];
                  const occupants = playersByNode.get(nodeId) ?? [];
                  const isOccupied = occupants.length > 0;

                  // Highlighting logic for selected player
                  const isCurrentForSelected =
                    selectedPlayer && selectedPlayer.nodeId === nodeId;
                  const isActiveTargetForSelected =
                    selectedPlayer &&
                    selectedPlayer.activeRoad &&
                    selectedPlayer.targetTitle === node.title;

                  let nodeRingClass = "ring-black/[0.08]";
                  if (isCurrentForSelected) {
                    nodeRingClass = "ring-3 ring-court-ink bg-court-ink/[0.04] shadow-md";
                  } else if (isActiveTargetForSelected) {
                    nodeRingClass = "ring-2 ring-emerald-500 bg-emerald-500/[0.04] animate-pulse";
                  }

                  return (
                    <div
                      key={nodeId}
                      className={`glass-1 relative flex flex-col justify-between rounded-2xl p-4 transition-all hover:scale-[1.01] hover:ring-2 hover:ring-court-ink/40 ${nodeRingClass}`}
                    >
                      <div>
                        {/* Node Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl" aria-hidden>
                              {node.emoji}
                            </span>
                            <div>
                              <div className="font-extrabold text-ink leading-snug">
                                {node.title}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                {node.pillarLabel}
                              </span>
                            </div>
                          </div>

                          {/* Occupants count */}
                          <span
                            className={`tabular shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${
                              isOccupied
                                ? "bg-court-ink text-white ring-court-ink"
                                : "bg-black/[0.04] text-muted ring-black/10"
                            }`}
                          >
                            {occupants.length} {occupants.length === 1 ? "player" : "players"}
                          </span>
                        </div>

                        {/* Player state badges if selected */}
                        {isCurrentForSelected && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-court-ink px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                            <span>📍</span> Current Archetype
                          </div>
                        )}
                        {isActiveTargetForSelected && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                            <span>🎯</span> Target Road ({selectedPlayer.roadProgressPct}%)
                          </div>
                        )}

                        {/* Node Summary */}
                        <p className="mt-2.5 text-[11px] font-medium leading-relaxed text-muted line-clamp-2">
                          {node.summary}
                        </p>

                        {/* Requirements checklist preview */}
                        <div className="mt-2 space-y-0.5">
                          {node.requirements.map((req, rIdx) => (
                            <div
                              key={rIdx}
                              className="text-[10px] font-medium text-court-ink/90 flex items-start gap-1"
                            >
                              <span className="text-muted/60 shrink-0">•</span>
                              <span className="leading-tight">{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Occupants Roster Chips */}
                      <div className="mt-4 border-t border-black/[0.06] pt-3">
                        {isOccupied ? (
                          <div className="flex flex-wrap gap-1.5">
                            {occupants.map((p) => {
                              const isSelected = selectedPlayer?.id === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => onSelectPlayer(p)}
                                  className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                                    isSelected
                                      ? "bg-court-ink text-white shadow-xs ring-2 ring-court-ink"
                                      : "bg-white/80 text-ink ring-1 ring-black/10 hover:bg-white hover:ring-court-ink/40"
                                  }`}
                                >
                                  <Avatar name={p.name} size="sm" />
                                  <span className="truncate max-w-[90px]">
                                    {shortName(p.name)}
                                  </span>
                                  {p.injured && <InjuredBadge />}
                                  {p.roadProgressPct < 100 && (
                                    <span
                                      className={`tabular rounded-full px-1.5 text-[9px] font-extrabold ${
                                        isSelected
                                          ? "bg-white/20 text-white"
                                          : "bg-black/[0.06] text-court-ink"
                                      }`}
                                    >
                                      {p.roadProgressPct}%
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] font-medium italic text-muted/60">
                            Unclaimed territory ⚡
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW 2: TABLE TREE SYSTEM VIEW
// ---------------------------------------------------------------------------
function TableTreeView({
  players,
  selectedPlayer,
  onSelectPlayer,
  expandedTiers,
  onToggleTier,
}: {
  players: PlayerTreeItem[];
  selectedPlayer: PlayerTreeItem | null;
  onSelectPlayer: (player: PlayerTreeItem) => void;
  expandedTiers: Record<number, boolean>;
  onToggleTier: (tier: number) => void;
}) {
  // Group players by tier
  const playersByTier = useMemo(() => {
    const map = new Map<ArchetypeTier, PlayerTreeItem[]>();
    for (const p of players) {
      const list = map.get(p.archetype.tier) ?? [];
      list.push(p);
      map.set(p.archetype.tier, list);
    }
    // Sort players in each tier by road progress descending
    for (const list of map.values()) {
      list.sort((a, b) => b.roadProgressPct - a.roadProgressPct || a.name.localeCompare(b.name));
    }
    return map;
  }, [players]);

  return (
    <div className="space-y-4">
      {SKILL_TREE_TIERS.map((tierMeta) => {
        const tierPlayers = playersByTier.get(tierMeta.tier) ?? [];
        const isExpanded = expandedTiers[tierMeta.tier] ?? true;

        return (
          <div
            key={tierMeta.tier}
            className={`glass-2 overflow-hidden rounded-3xl ring-1 ${tierMeta.borderColor} transition-all`}
          >
            {/* Tier Table Header Accordion Toggle */}
            <button
              type="button"
              onClick={() => onToggleTier(tierMeta.tier)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-black/[0.02]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tierMeta.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${tierMeta.dotClass}`} />
                  {tierMeta.label} · {tierMeta.title}
                </span>
                <span className="text-xs font-bold text-muted hidden sm:inline">
                  {tierMeta.requirementSummary}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs font-extrabold text-ink">
                  {tierPlayers.length} {tierPlayers.length === 1 ? "player" : "players"}
                </span>
                <span className="text-sm font-bold text-muted">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {/* Table Content */}
            {isExpanded && (
              <div className="border-t border-black/[0.06] overflow-x-auto">
                {tierPlayers.length === 0 ? (
                  <div className="p-6 text-center text-xs font-medium text-muted">
                    No players currently stationed in {tierMeta.label}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[10px] font-black uppercase tracking-wider text-muted">
                        <th className="px-4 py-2.5">Player</th>
                        <th className="px-4 py-2.5">Current Archetype</th>
                        <th className="px-4 py-2.5">Active Road Target</th>
                        <th className="px-4 py-2.5 min-w-[150px]">Road Progress</th>
                        <th className="px-4 py-2.5 min-w-[200px]">What It Takes</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {tierPlayers.map((player) => {
                        const isSelected = selectedPlayer?.id === player.id;
                        return (
                          <tr
                            key={player.id}
                            onClick={() => onSelectPlayer(player)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-court-ink/10 font-bold"
                                : "hover:bg-black/[0.025]"
                            }`}
                          >
                            {/* Player info */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={player.name} size="sm" />
                                <div>
                                  <div className="font-extrabold text-ink flex items-center gap-1.5">
                                    <span>{player.name}</span>
                                    {player.injured && <InjuredBadge />}
                                  </div>
                                  <div className="text-[10px] font-semibold text-muted">
                                    {player.gp} GP · {player.ppg.toFixed(1)} pts · {player.apg.toFixed(1)} ast
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Current Archetype */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 font-extrabold text-ink">
                                <span className="text-base" aria-hidden>
                                  {player.archetype.emoji}
                                </span>
                                <span>{player.archetype.title}</span>
                              </div>
                            </td>

                            {/* Active Road Target */}
                            <td className="px-4 py-3">
                              {player.archetype.tier === 4 ? (
                                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-800">
                                  <span>👑</span> Supreme Apex
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 font-bold text-ink">
                                  <span className="text-sm" aria-hidden>
                                    {player.targetEmoji}
                                  </span>
                                  <span>{player.targetTitle}</span>
                                  <span
                                    className={`text-[9px] font-black uppercase rounded-sm px-1 ${
                                      ARCHETYPE_TIER_META[player.targetTier]?.badgeClass
                                    }`}
                                  >
                                    T{player.targetTier}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Road Progress Bar */}
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-black">
                                  <span className="text-muted">Completion</span>
                                  <span className="text-court-ink">
                                    {player.roadProgressPct}%
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                                  <div
                                    className="h-full rounded-full bg-court-ink transition-all duration-500"
                                    style={{
                                      width: `${Math.max(5, player.roadProgressPct)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* What It Takes Delta */}
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-semibold text-court-ink leading-tight block">
                                🎯 {player.deltaSummary}
                              </span>
                            </td>

                            {/* Action Button */}
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlayer(player);
                                }}
                                className="rounded-lg bg-court-ink px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition-all hover:bg-court-dark"
                              >
                                Inspect Road 🔍
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLAYER ROAD INSPECTOR DRAWER / MODAL
// ---------------------------------------------------------------------------
function PlayerRoadInspector({
  player,
  onClose,
}: {
  player: PlayerTreeItem;
  onClose: () => void;
}) {
  const currentTierMeta =
    ARCHETYPE_TIER_META[player.archetype.tier] ?? ARCHETYPE_TIER_META[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-3 relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl p-6 shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-black text-muted transition-colors hover:bg-black/10 hover:text-ink"
        >
          ✕
        </button>

        {/* Player Header Banner */}
        <div className="flex items-start gap-4">
          <Avatar name={player.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-ink">{player.name}</h2>
              {player.injured && <InjuredBadge />}
              <span
                className={`tabular inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${currentTierMeta.badgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${currentTierMeta.dotClass}`} />
                {currentTierMeta.label}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {player.archetype.emoji}
              </span>
              <span className="text-base font-extrabold text-ink">
                {player.archetype.title}
              </span>
              <span className="text-xs font-semibold text-muted">
                ({player.gp} GP · {player.ppg.toFixed(1)} PPG · {player.apg.toFixed(1)} APG · {player.stockPg.toFixed(1)} Stocks/g)
              </span>
            </div>

            <p className="mt-1.5 text-xs font-medium text-muted leading-relaxed">
              {player.archetype.description}
            </p>
          </div>
        </div>

        {/* 5-Tier Journey Waypoints Map */}
        <div className="mt-6 rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/[0.05]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-muted">
            <span>Milestone Ladder: Road to Tier 4</span>
            <span className="text-court-ink font-bold">
              Current Tier: {player.archetype.tier} / 4
            </span>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2 text-center">
            {[0, 1, 2, 3, 4].map((tierNum) => {
              const isPast = tierNum < player.archetype.tier;
              const isCurrent = tierNum === player.archetype.tier;
              const isTarget = tierNum === player.targetTier && player.archetype.tier < 4;

              return (
                <div
                  key={tierNum}
                  className={`rounded-xl p-2 transition-all ${
                    isCurrent
                      ? "bg-court-ink text-white shadow-xs ring-2 ring-court-ink"
                      : isTarget
                        ? "bg-emerald-500/15 text-emerald-950 ring-2 ring-emerald-500/40"
                        : isPast
                          ? "bg-black/[0.06] text-ink font-semibold"
                          : "bg-black/[0.02] text-muted/50"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider">
                    Tier {tierNum}
                  </div>
                  <div className="mt-0.5 text-base" aria-hidden>
                    {tierNum === 4
                      ? "🌟"
                      : tierNum === 3
                        ? "👑"
                        : tierNum === 2
                          ? "⚔️"
                          : tierNum === 1
                            ? "🎯"
                            : "🏀"}
                  </div>
                  <div className="mt-1 text-[9px] font-extrabold uppercase">
                    {isCurrent
                      ? "Current"
                      : isPast
                        ? "Done ✓"
                        : isTarget
                          ? `${player.roadProgressPct}%`
                          : "Locked"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Next Tier Road Card */}
        {player.archetype.tier === 4 ? (
          <div className="mt-4 rounded-2xl bg-emerald-500/15 p-4 ring-2 ring-emerald-500/40 text-emerald-950">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
              <span>🌟</span>
              <span>Supreme Apex Achieved</span>
            </div>
            <p className="mt-1 text-xs font-medium leading-relaxed">
              This player has mastered all 3 foundational pillars of the game. Statistical dominance across scoring, playmaking, and lockdown defense!
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {player.targetEmoji}
                </span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-court-ink">
                    Active Road: Tier {player.targetTier} Evolution
                  </div>
                  <div className="text-base font-black text-ink">
                    {player.targetTitle}
                  </div>
                </div>
              </div>
              <span className="tabular rounded-full bg-court-ink px-3 py-1 text-sm font-black text-white shadow-xs">
                {player.roadProgressPct}%
              </span>
            </div>

            {/* Glowing Big Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-court-soft to-court-ink transition-all duration-500"
                style={{ width: `${Math.max(6, player.roadProgressPct)}%` }}
              />
            </div>

            {/* Exact Requirements Checklist */}
            <div className="mt-3 rounded-xl bg-court-soft/10 p-3 text-xs font-extrabold text-court-ink ring-1 ring-court-ink/15">
              <div className="text-[10px] font-black uppercase tracking-wider text-court-ink/80 mb-1">
                🎯 Requirements Checklist
              </div>
              <p className="leading-snug">{player.deltaSummary}</p>
            </div>
          </div>
        )}

        {/* Alternative Upgrades (if available) */}
        {player.candidateRoads.length > 1 && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-muted">
              Alternative Evolutionary Branches
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {player.candidateRoads.slice(1).map((alt) => (
                <div
                  key={alt.title}
                  className="rounded-xl bg-black/[0.03] p-3 text-xs ring-1 ring-black/[0.05]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-ink">
                      {alt.emoji} {alt.title}
                    </span>
                    <span className="tabular font-black text-court-ink">
                      {alt.progressPct}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-muted line-clamp-2">
                    {alt.requirement}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pillar Mastery Progress Radios */}
        <div className="mt-4 rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/[0.05]">
          <div className="text-[11px] font-black uppercase tracking-wider text-muted mb-2">
            Tri-Pillar Mastery Progress
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {/* Shoot */}
            <div className="rounded-xl bg-white/70 p-2.5 text-center ring-1 ring-black/5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                🏹 Shoot Pillar
              </div>
              <div className="mt-1 text-sm font-black text-ink">
                {player.pillarScores.shoot.pct}%
              </div>
              <div className="text-[10px] font-bold text-court-ink">
                {player.pillarScores.shoot.gold
                  ? "Gold Master"
                  : player.pillarScores.shoot.silver
                    ? "Silver Unlocked"
                    : "In Progress"}
              </div>
            </div>

            {/* Assist */}
            <div className="rounded-xl bg-white/70 p-2.5 text-center ring-1 ring-black/5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                🪄 Assist Pillar
              </div>
              <div className="mt-1 text-sm font-black text-ink">
                {player.pillarScores.assist.pct}%
              </div>
              <div className="text-[10px] font-bold text-purple-700">
                {player.pillarScores.assist.gold
                  ? "Gold Master"
                  : player.pillarScores.assist.silver
                    ? "Silver Unlocked"
                    : "In Progress"}
              </div>
            </div>

            {/* Defense */}
            <div className="rounded-xl bg-white/70 p-2.5 text-center ring-1 ring-black/5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted">
                🛡️ Defense Pillar
              </div>
              <div className="mt-1 text-sm font-black text-ink">
                {player.pillarScores.defense.pct}%
              </div>
              <div className="text-[10px] font-bold text-emerald-700">
                {player.pillarScores.defense.gold
                  ? "Gold Master"
                  : player.pillarScores.defense.silver
                    ? "Silver Unlocked"
                    : "In Progress"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-black/[0.06] pt-4">
          <Link
            href={`/players/${player.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-black text-paper shadow-xs transition-all hover:bg-black"
          >
            <span>View Full Profile</span>
            <span>↗</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-black/[0.05] px-4 py-2 text-xs font-bold text-muted transition-colors hover:text-ink"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

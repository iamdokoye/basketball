"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import {
  type ArchetypeNodeId,
  type PlayerTreeItem,
  SKILL_TREE_NODES,
  SKILL_TREE_TIERS,
  SKILL_TREE_COORDS,
  SKILL_TREE_BRANCHES,
  archetypeTitleToId,
} from "@/lib/skillTree";
import { ARCHETYPE_TIER_META, type ArchetypeTier } from "@/lib/badges";

type ViewMode = "diagram" | "table";
type TimeMode = "season" | "allTime";

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1060;

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
  const [hoveredPlayerId, setHoveredPlayerId] = useState<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<ArchetypeNodeId | null>(null);
  const [tierFilter, setTierFilter] = useState<"all" | ArchetypeTier>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideArchived, setHideArchived] = useState(true);
  const [zoomScale, setZoomScale] = useState(0.85);

  // Table tree tier accordion state
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({
    4: true,
    3: true,
    2: true,
    1: true,
    0: true,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Selected player
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return activePlayers.find((p) => p.id === selectedPlayerId) ?? null;
  }, [activePlayers, selectedPlayerId]);

  // Hovered player
  const hoveredPlayer = useMemo(() => {
    if (!hoveredPlayerId) return null;
    return activePlayers.find((p) => p.id === hoveredPlayerId) ?? null;
  }, [activePlayers, hoveredPlayerId]);

  // Players grouped by archetype node
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

  // Player closest to next tier graduation
  const closestToGraduation = useMemo(() => {
    const eligible = activePlayers
      .filter((p) => (!hideArchived || !p.archived) && p.archetype.tier < 4 && p.roadProgressPct < 100)
      .sort((a, b) => b.roadProgressPct - a.roadProgressPct);
    return eligible[0] ?? null;
  }, [activePlayers, hideArchived]);

  // Unique archetypes discovered
  const unlockedArchetypeCount = useMemo(() => {
    const unique = new Set<string>();
    for (const p of activePlayers) {
      if (hideArchived && p.archived) continue;
      unique.add(p.nodeId);
    }
    return unique.size;
  }, [activePlayers, hideArchived]);

  // Auto center or smart fit on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const containerW = scrollContainerRef.current.clientWidth;
      let initialScale = 0.85;
      if (containerW > 0 && containerW < CANVAS_WIDTH) {
        initialScale = Math.max(0.55, Math.min(0.85, (containerW - 32) / CANVAS_WIDTH));
        setZoomScale(Number(initialScale.toFixed(2)));
      }
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, (CANVAS_WIDTH * initialScale - containerW) / 2),
        top: 0,
      });
    }
  }, []);

  // Auto center on initial player if provided via URL
  useEffect(() => {
    if (initialPlayerId && scrollContainerRef.current) {
      const p = activePlayers.find((x) => x.id === initialPlayerId);
      if (p) {
        const coord = SKILL_TREE_COORDS[p.nodeId];
        if (coord) {
          const container = scrollContainerRef.current;
          container.scrollTo({
            left: coord.x * zoomScale - container.clientWidth / 2,
            top: coord.y * zoomScale - container.clientHeight / 2,
            behavior: "smooth",
          });
        }
      }
    }
  }, [initialPlayerId, activePlayers, zoomScale]);

  const toggleTierAccordion = (tier: number) => {
    setExpandedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  const handleZoom = (delta: number) => {
    setZoomScale((prev) => Math.max(0.45, Math.min(1.6, Number((prev + delta).toFixed(2)))));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, (CANVAS_WIDTH - scrollContainerRef.current.clientWidth) / 2),
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const handleFitScreen = () => {
    if (scrollContainerRef.current) {
      const containerW = scrollContainerRef.current.clientWidth - 48;
      const fit = Math.max(0.45, Math.min(1.0, containerW / CANVAS_WIDTH));
      setZoomScale(Number(fit.toFixed(2)));
      scrollContainerRef.current.scrollTo({
        left: 0,
        top: 0,
        behavior: "smooth",
      });
    }
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
              Explore all 18 playstyle archetypes on the expanded tree canvas. Hover over any{" "}
              <strong className="text-court-ink">player dot</strong> on the branches to inspect
              who is stationed there, their completion percentage, and what they need to level up!
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
                <span>🌳</span>
                <span>Graphical Tree</span>
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
                  <span>Closest to Next Tier</span>
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

      {/* Filter, Search & Quick Controls Toolbar */}
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

        {/* Search, Zoom & Archived */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "diagram" && (
            <div className="inline-flex items-center rounded-xl bg-black/[0.05] p-0.5 text-xs font-black">
              <button
                type="button"
                onClick={() => handleZoom(-0.15)}
                title="Zoom Out (−)"
                className="px-2 py-1 text-muted hover:text-ink transition-colors cursor-pointer"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom to 100%"
                className="px-2 py-1 text-[11px] text-muted hover:text-ink transition-colors cursor-pointer"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => handleZoom(0.15)}
                title="Zoom In (+)"
                className="px-2 py-1 text-muted hover:text-ink transition-colors cursor-pointer"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleFitScreen}
                title="Fit to Screen"
                className="border-l border-black/10 px-2 py-1 text-[10px] text-court-ink hover:text-court-dark transition-colors cursor-pointer"
              >
                Fit
              </button>
            </div>
          )}

          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or archetype..."
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

      {/* Player Quick-Selector Strip */}
      <section className="glass-1 overflow-x-auto rounded-2xl p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted shrink-0 pl-1">
            Active Players:
          </span>
          <div className="flex items-center gap-1.5">
            {filteredPlayers.map((p) => {
              const isSelected = selectedPlayerId === p.id;
              const isHovered = hoveredPlayerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setHoveredPlayerId(p.id)}
                  onMouseLeave={() => setHoveredPlayerId(null)}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-court-ink text-white ring-2 ring-court-ink shadow-xs"
                      : isHovered
                        ? "bg-white text-ink ring-2 ring-court-ink/40 shadow-xs scale-105"
                        : "bg-black/[0.04] text-ink hover:bg-black/[0.07]"
                  }`}
                >
                  <Avatar name={p.name} size="sm" />
                  <span>{shortName(p.name)}</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    {p.archetype.emoji}
                  </span>
                  {p.roadProgressPct < 100 && (
                    <span
                      className={`tabular rounded-full px-1 text-[9px] font-black ${
                        isSelected ? "bg-white/20 text-white" : "bg-black/[0.06] text-court-ink"
                      }`}
                    >
                      {p.roadProgressPct}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main View Area: Graphical Tree or Table Tree */}
      {viewMode === "diagram" ? (
        <GraphicalTreeCanvas
          playersByNode={playersByNode}
          selectedPlayer={selectedPlayer}
          hoveredPlayer={hoveredPlayer}
          hoveredNodeId={hoveredNodeId}
          onHoverPlayer={setHoveredPlayerId}
          onSelectPlayer={(p) => setSelectedPlayerId(p.id)}
          onHoverNode={setHoveredNodeId}
          tierFilter={tierFilter}
          zoomScale={zoomScale}
          setZoomScale={setZoomScale}
          onZoom={handleZoom}
          onFitScreen={handleFitScreen}
          onResetZoom={handleResetZoom}
          scrollContainerRef={scrollContainerRef}
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

      {/* Selected Player Road Inspector Drawer / Modal */}
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
// VIEW 1: EXPANDED GRAPHICAL TREE CANVAS WITH ZOOM & PAN CONTROLS
// ---------------------------------------------------------------------------
function GraphicalTreeCanvas({
  playersByNode,
  selectedPlayer,
  hoveredPlayer,
  hoveredNodeId,
  onHoverPlayer,
  onSelectPlayer,
  onHoverNode,
  tierFilter,
  zoomScale,
  setZoomScale,
  onZoom,
  onFitScreen,
  onResetZoom,
  scrollContainerRef,
}: {
  playersByNode: Map<ArchetypeNodeId, PlayerTreeItem[]>;
  selectedPlayer: PlayerTreeItem | null;
  hoveredPlayer: PlayerTreeItem | null;
  hoveredNodeId: ArchetypeNodeId | null;
  onHoverPlayer: (id: number | null) => void;
  onSelectPlayer: (p: PlayerTreeItem) => void;
  onHoverNode: (id: ArchetypeNodeId | null) => void;
  tierFilter: "all" | ArchetypeTier;
  zoomScale: number;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  onZoom: (delta: number) => void;
  onFitScreen: () => void;
  onResetZoom: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const activeFocusPlayer = hoveredPlayer ?? selectedPlayer;

  // Drag-to-pan state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = dragStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handling with Ctrl/Meta or trackpad pinch
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      setZoomScale((prev) => Math.max(0.45, Math.min(1.6, Number((prev + delta).toFixed(2)))));
    }
  };

  // Compute active target node for highlighted player
  const targetNodeId = useMemo(() => {
    if (!activeFocusPlayer || !activeFocusPlayer.activeRoad) return null;
    return archetypeTitleToId(activeFocusPlayer.activeRoad.title);
  }, [activeFocusPlayer]);

  // Compute active branches for the focused player
  const activeBranchIds = useMemo(() => {
    if (!activeFocusPlayer) return new Set<string>();
    const ids = new Set<string>();
    const currentNode = activeFocusPlayer.nodeId;

    for (const b of SKILL_TREE_BRANCHES) {
      if (b.target === currentNode) ids.add(b.id);
      if (b.source === currentNode && targetNodeId && b.target === targetNodeId) {
        ids.add(b.id);
      }
    }
    return ids;
  }, [activeFocusPlayer, targetNodeId]);

  return (
    <div
      ref={scrollContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className={`glass-2 relative overflow-auto rounded-3xl p-4 shadow-xl ring-1 ring-black/10 select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ minHeight: "750px", maxHeight: "88vh" }}
    >
      {/* Sticky Top Bar & Legend */}
      <div className="sticky left-0 top-0 z-30 flex items-center justify-between gap-3 pb-3 mb-2 border-b border-black/[0.06] bg-white/60 backdrop-blur-md px-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            ✨
          </span>
          <span className="text-xs font-bold text-ink">
            Interactive Tree Graph ({CANVAS_WIDTH}px canvas) · Hover on any{" "}
            <span className="text-court-ink font-black">player dot</span> to inspect their road!
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Apex (T4)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-500" /> Pinnacle (T3)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Hybrid (T2)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Specialist (T1)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> Root (T0)
          </span>
        </div>
      </div>

      {/* Floating Zoom & Pan HUD Controls */}
      <div className="sticky bottom-4 right-4 z-40 ml-auto flex items-center gap-1.5 rounded-2xl glass-3 p-1.5 shadow-2xl ring-1 ring-black/15 w-fit bg-white/90 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onZoom(-0.15)}
          title="Zoom Out (−)"
          className="grid h-8 w-8 place-items-center rounded-xl bg-black/[0.05] text-base font-black text-ink hover:bg-black/10 transition-colors cursor-pointer"
        >
          −
        </button>
        <span className="tabular px-2 text-xs font-black text-ink select-none min-w-[50px] text-center">
          {Math.round(zoomScale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onZoom(0.15)}
          title="Zoom In (+)"
          className="grid h-8 w-8 place-items-center rounded-xl bg-black/[0.05] text-base font-black text-ink hover:bg-black/10 transition-colors cursor-pointer"
        >
          +
        </button>
        <div className="h-4 w-px bg-black/15 mx-0.5" />
        <button
          type="button"
          onClick={onFitScreen}
          title="Fit whole tree into screen"
          className="flex items-center gap-1 rounded-xl bg-court-ink/10 px-2.5 py-1.5 text-xs font-black text-court-ink hover:bg-court-ink hover:text-white transition-colors cursor-pointer"
        >
          <span>⤢</span>
          <span>Fit Screen</span>
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          title="Reset to 100%"
          className="rounded-xl bg-black/[0.05] px-2.5 py-1.5 text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
        >
          100%
        </button>
      </div>

      {/* Scalable Coordinate Container */}
      <div
        className="relative mx-auto transition-transform duration-150 origin-top"
        style={{
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          transform: `scale(${zoomScale})`,
          transformOrigin: "top center",
        }}
      >
        {/* SVG Layer: Tier Bands and Connector Branches */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <defs>
            {/* Gradients for Glowing Active Branches */}
            <linearGradient id="activeBranchGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
            </linearGradient>

            <filter id="branchGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal Tier Region Backdrops */}
          {/* Tier 4 Apex Summit */}
          <rect
            x="40"
            y="25"
            width="1520"
            height="150"
            rx="24"
            fill="rgba(16, 185, 129, 0.04)"
            stroke="rgba(16, 185, 129, 0.18)"
            strokeDasharray="4 4"
          />
          <text x="70" y="55" fill="#065f46" fontSize="13" fontWeight="800" letterSpacing="0.08em">
            TIER 4 · THE SUPREME APEX
          </text>

          {/* Tier 3 Pinnacle Ridge */}
          <rect
            x="40"
            y="235"
            width="1520"
            height="160"
            rx="24"
            fill="rgba(168, 85, 247, 0.03)"
            stroke="rgba(168, 85, 247, 0.14)"
            strokeDasharray="4 4"
          />
          <text x="70" y="265" fill="#7e22ce" fontSize="13" fontWeight="800" letterSpacing="0.08em">
            TIER 3 · PINNACLE DUAL-PILLARS
          </text>

          {/* Tier 2 Hybrid Bridge */}
          <rect
            x="40"
            y="450"
            width="1520"
            height="170"
            rx="24"
            fill="rgba(245, 158, 11, 0.03)"
            stroke="rgba(245, 158, 11, 0.14)"
            strokeDasharray="4 4"
          />
          <text x="70" y="480" fill="#b45309" fontSize="13" fontWeight="800" letterSpacing="0.08em">
            TIER 2 · HYBRID ROLES
          </text>

          {/* Tier 1 Specialist Meadow */}
          <rect
            x="40"
            y="670"
            width="1520"
            height="170"
            rx="24"
            fill="rgba(14, 165, 233, 0.03)"
            stroke="rgba(14, 165, 233, 0.14)"
            strokeDasharray="4 4"
          />
          <text x="70" y="700" fill="#0369a1" fontSize="13" fontWeight="800" letterSpacing="0.08em">
            TIER 1 · SPECIALIZED DISCIPLINES
          </text>

          {/* Tier 0 Foundation Ground */}
          <rect
            x="40"
            y="870"
            width="1520"
            height="160"
            rx="24"
            fill="rgba(148, 163, 184, 0.04)"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeDasharray="4 4"
          />
          <text x="70" y="900" fill="#475569" fontSize="13" fontWeight="800" letterSpacing="0.08em">
            TIER 0 · FOUNDATIONS & ROOTS
          </text>

          {/* SVG Tree Connector Branches */}
          {SKILL_TREE_BRANCHES.map((branch) => {
            const sourceCoord = SKILL_TREE_COORDS[branch.source];
            const targetCoord = SKILL_TREE_COORDS[branch.target];
            if (!sourceCoord || !targetCoord) return null;

            const isHighlighted = activeBranchIds.has(branch.id);
            const isFaded = activeFocusPlayer && !isHighlighted;

            // Smooth vertical Bezier curve from source to target
            const dy = Math.abs(sourceCoord.y - targetCoord.y);
            const cy1 = sourceCoord.y - dy * 0.45;
            const cy2 = targetCoord.y + dy * 0.45;
            const pathData = `M ${sourceCoord.x} ${sourceCoord.y} C ${sourceCoord.x} ${cy1}, ${targetCoord.x} ${cy2}, ${targetCoord.x} ${targetCoord.y}`;

            return (
              <path
                key={branch.id}
                d={pathData}
                fill="none"
                stroke={isHighlighted ? "url(#activeBranchGrad)" : "rgba(0, 0, 0, 0.13)"}
                strokeWidth={isHighlighted ? 4 : 2}
                strokeDasharray={isHighlighted ? "6 3" : undefined}
                filter={isHighlighted ? "url(#branchGlow)" : undefined}
                opacity={isFaded ? 0.22 : 1}
                className={isHighlighted ? "animate-[dash_1.5s_linear_infinite]" : "transition-opacity duration-300"}
              />
            );
          })}
        </svg>

        {/* HTML Layer: All 18 Archetype Nodes and Interactive Player Dots */}
        {(Object.keys(SKILL_TREE_NODES) as ArchetypeNodeId[]).map((nodeId) => {
          const node = SKILL_TREE_NODES[nodeId];
          const coord = SKILL_TREE_COORDS[nodeId];
          const occupants = playersByNode.get(nodeId) ?? [];
          const isOccupied = occupants.length > 0;

          // Check if this node is relevant to the active focused player
          const isCurrentForFocus = activeFocusPlayer && activeFocusPlayer.nodeId === nodeId;
          const isTargetForFocus = activeFocusPlayer && targetNodeId === nodeId;
          const isDimmed =
            (tierFilter !== "all" && node.tier !== tierFilter) ||
            (activeFocusPlayer && !isCurrentForFocus && !isTargetForFocus);

          return (
            <div
              key={nodeId}
              onMouseEnter={() => onHoverNode(nodeId)}
              onMouseLeave={() => onHoverNode(null)}
              className={`absolute flex flex-col items-center transition-all duration-300 ${
                isDimmed ? "opacity-35 scale-95" : "opacity-100 scale-100"
              }`}
              style={{
                left: `${coord.x}px`,
                top: `${coord.y}px`,
                transform: "translate(-50%, -50%)",
                width: "144px",
              }}
            >
              {/* ------------------------------------------------------------- */}
              {/* PLAYER DOTS ON THE TREE (Positioned directly above the node) */}
              {/* ------------------------------------------------------------- */}
              {isOccupied && (
                <div className="absolute -top-7 flex items-center justify-center gap-1.5 z-20">
                  {occupants.map((p) => {
                    const isDotSelected = selectedPlayer?.id === p.id;
                    const isDotHovered = hoveredPlayer?.id === p.id;

                    return (
                      <div
                        key={p.id}
                        className="relative group/dot"
                        onMouseEnter={() => onHoverPlayer(p.id)}
                        onMouseLeave={() => onHoverPlayer(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlayer(p);
                        }}
                      >
                        {/* The Interactive Glowing Player Dot */}
                        <button
                          type="button"
                          aria-label={`Player ${p.name}`}
                          className={`relative grid h-6.5 w-6.5 place-items-center rounded-full text-[9px] font-black uppercase transition-all duration-200 cursor-pointer ${
                            isDotSelected
                              ? "bg-court-ink text-white ring-3 ring-court-ink ring-offset-2 scale-125 shadow-lg"
                              : isDotHovered
                                ? "bg-court-ink text-white ring-2 ring-court-ink ring-offset-1 scale-125 shadow-md"
                                : "bg-ink text-paper ring-2 ring-white shadow-xs hover:scale-115 hover:bg-court-ink"
                          }`}
                        >
                          {/* Dot Initials */}
                          <span>{p.name.slice(0, 2).toUpperCase()}</span>

                          {/* Pulsing Aura */}
                          <span
                            className={`absolute inset-0 rounded-full animate-ping opacity-30 ${
                              isDotSelected ? "bg-court-ink" : "bg-emerald-400"
                            }`}
                          />
                        </button>

                        {/* --------------------------------------------------------- */}
                        {/* HOVER POPOVER CARD: Displays when user hovers on this dot */}
                        {/* --------------------------------------------------------- */}
                        {isDotHovered && (
                          <div
                            className={`absolute z-50 w-72 rounded-2xl glass-3 p-4 shadow-2xl ring-1 ring-black/15 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 ${
                              coord.x > 1100
                                ? "right-0 translate-x-4"
                                : coord.x < 500
                                  ? "left-0 -translate-x-4"
                                  : "left-1/2 -translate-x-1/2"
                            } ${coord.y < 400 ? "top-8" : "bottom-8"}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar name={p.name} size="md" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-sm text-ink truncate">
                                    {p.name}
                                  </span>
                                  {p.injured && <InjuredBadge size="xs" />}
                                </div>
                                <div className="text-[11px] font-bold text-muted truncate">
                                  {p.archetype.emoji} {p.archetype.title} · Tier {p.archetype.tier}
                                </div>
                              </div>
                            </div>

                            {/* Stat snapshot */}
                            <div className="mt-2.5 grid grid-cols-4 gap-1 text-center bg-black/[0.04] p-1.5 rounded-xl text-[10px]">
                              <div>
                                <div className="text-muted font-bold">GP</div>
                                <div className="font-extrabold text-ink">{p.gp}</div>
                              </div>
                              <div>
                                <div className="text-muted font-bold">PPG</div>
                                <div className="font-extrabold text-ink">{p.ppg.toFixed(1)}</div>
                              </div>
                              <div>
                                <div className="text-muted font-bold">APG</div>
                                <div className="font-extrabold text-ink">{p.apg.toFixed(1)}</div>
                              </div>
                              <div>
                                <div className="text-muted font-bold">STOCKS</div>
                                <div className="font-extrabold text-ink">{p.stockPg.toFixed(1)}</div>
                              </div>
                            </div>

                            {/* Active Road to Next Tier */}
                            <div className="mt-2.5 border-t border-black/[0.06] pt-2">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-court-ink">
                                <span>Road to Tier {p.targetTier}</span>
                                <span>{p.roadProgressPct}%</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs font-black text-ink">
                                <span>{p.targetEmoji}</span>
                                <span>{p.targetTitle}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
                                <div
                                  className="h-full rounded-full bg-court-ink transition-all duration-300"
                                  style={{ width: `${Math.max(6, p.roadProgressPct)}%` }}
                                />
                              </div>
                              <div className="mt-1.5 text-[10px] font-medium text-court-ink leading-tight">
                                🎯 {p.deltaSummary}
                              </div>
                            </div>

                            <div className="mt-2 text-[9px] font-bold text-muted text-center italic">
                              Click dot to inspect full evolution path
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Archetype Node Badge */}
              <div
                className={`relative flex flex-col items-center justify-center rounded-2xl p-3 transition-all text-center ${
                  isCurrentForFocus
                    ? "bg-court-ink/15 ring-3 ring-court-ink shadow-lg scale-110"
                    : isTargetForFocus
                      ? "bg-emerald-500/15 ring-2 ring-emerald-500 shadow-lg scale-110 animate-pulse"
                      : isOccupied
                        ? "bg-white/90 ring-1 ring-black/15 shadow-sm hover:scale-105 hover:ring-court-ink/50"
                        : "bg-white/55 ring-1 ring-dashed ring-black/15 hover:bg-white/75"
                }`}
                style={{ width: "136px" }}
              >
                {/* Node Emoji */}
                <span className="text-2xl" aria-hidden>
                  {node.emoji}
                </span>

                {/* Node Title */}
                <span className="mt-0.5 text-xs font-extrabold text-ink leading-tight line-clamp-2">
                  {node.title}
                </span>

                {/* Pillar / Tier tag */}
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted">
                  {node.pillarLabel.split("+")[0].trim()}
                </span>

                {/* Occupant Counter */}
                <span
                  className={`mt-1 tabular rounded-full px-2 py-0.5 text-[9px] font-extrabold ring-1 ring-inset ${
                    isOccupied
                      ? "bg-court-ink text-white ring-court-ink"
                      : "bg-black/[0.04] text-muted ring-black/10"
                  }`}
                >
                  {occupants.length} {occupants.length === 1 ? "player" : "players"}
                </span>

                {/* Status Badges for Active Focused Player */}
                {isCurrentForFocus && (
                  <span className="mt-1 text-[8px] font-black uppercase text-court-ink bg-court-soft/10 px-1 rounded-sm">
                    📍 Current
                  </span>
                )}
                {isTargetForFocus && (
                  <span className="mt-1 text-[8px] font-black uppercase text-emerald-700 bg-emerald-500/15 px-1 rounded-sm">
                    🎯 Next Target
                  </span>
                )}
              </div>

              {/* Archetype Hover Info Tooltip (When node itself is hovered and no dot is hovered) */}
              {hoveredNodeId === nodeId && !hoveredPlayer && (
                <div
                  className={`absolute z-40 w-64 rounded-2xl glass-3 p-3.5 shadow-2xl ring-1 ring-black/15 pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150 ${
                    coord.y < 400 ? "top-20" : "bottom-20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>{node.emoji}</span>
                    <div>
                      <div className="font-extrabold text-xs text-ink leading-tight">{node.title}</div>
                      <div className="text-[10px] font-bold uppercase text-muted">{node.pillarLabel}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-muted leading-relaxed">{node.summary}</p>
                  <div className="mt-2 border-t border-black/[0.06] pt-1.5 space-y-0.5 text-left">
                    <div className="text-[10px] font-black uppercase tracking-wider text-court-ink">Requirements:</div>
                    {node.requirements.map((r, i) => (
                      <div key={i} className="text-[10px] text-ink flex items-start gap-1">
                        <span className="text-muted">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
  const playersByTier = useMemo(() => {
    const map = new Map<ArchetypeTier, PlayerTreeItem[]>();
    for (const p of players) {
      const list = map.get(p.archetype.tier) ?? [];
      list.push(p);
      map.set(p.archetype.tier, list);
    }
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
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-black/[0.02] cursor-pointer"
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
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={player.name} size="sm" />
                                <div>
                                  <div className="font-extrabold text-ink flex items-center gap-1.5">
                                    <span>{player.name}</span>
                                    {player.injured && <InjuredBadge size="xs" />}
                                  </div>
                                  <div className="text-[10px] font-semibold text-muted">
                                    {player.gp} GP · {player.ppg.toFixed(1)} pts · {player.apg.toFixed(1)} ast
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 font-extrabold text-ink">
                                <span className="text-base" aria-hidden>
                                  {player.archetype.emoji}
                                </span>
                                <span>{player.archetype.title}</span>
                              </div>
                            </td>

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

                            <td className="px-4 py-3">
                              <span className="text-[11px] font-semibold text-court-ink leading-tight block">
                                🎯 {player.deltaSummary}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlayer(player);
                                }}
                                className="rounded-lg bg-court-ink px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition-all hover:bg-court-dark cursor-pointer"
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
// PLAYER ROAD INSPECTOR MODAL
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
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-black text-muted transition-colors hover:bg-black/10 hover:text-ink cursor-pointer"
        >
          ✕
        </button>

        {/* Player Header Banner */}
        <div className="flex items-start gap-4">
          <Avatar name={player.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-ink">{player.name}</h2>
              {player.injured && <InjuredBadge size="xs" />}
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
            className="rounded-xl bg-black/[0.05] px-4 py-2 text-xs font-bold text-muted transition-colors hover:text-ink cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

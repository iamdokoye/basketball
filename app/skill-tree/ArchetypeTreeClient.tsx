"use client";

import { useMemo, useState, useRef } from "react";
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
  TOTAL_ARCHETYPES,
  archetypeTitleToId,
} from "@/lib/skillTree";
import { ARCHETYPE_TIER_META, type ArchetypeTier } from "@/lib/badges";

type ViewMode = "diagram" | "table";
type TimeMode = "season" | "allTime";

const BASE_VB_WIDTH = 1000;
const BASE_VB_HEIGHT = 880;

// Hover card placement (SVG viewBox units unless suffixed _PX)
const HOVER_GAP_PX = 8; // breathing room between a card and what it describes
const HOVER_CARD_HALF_WIDTH_PX = 152; // w-72 (288px) / 2 plus a little edge padding
const HOVER_FLIP_BELOW_Y = 480; // anchors above this Y (Tiers 4, 3, 2) open below; Tiers 1 and 0 open above
const DOT_ANCHOR_OFFSET = 13; // dot radius (10 hovered) + ping ring headroom
const DOT_ROW_CLEARANCE = 28; // card top -> top of the player-dot row
const FOCUS_LABEL_CLEARANCE = 14; // height of the "CURRENT" / "NEXT TARGET" label

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
  const activePlayers = timeMode === "season" ? seasonPlayers : allTimePlayers;

  // Compute initial focus if initialPlayerId is provided via URL
  const initialFocus = useMemo(() => {
    if (!initialPlayerId) return null;
    const p = activePlayers.find((x) => x.id === initialPlayerId);
    if (!p) return null;
    const coord = SKILL_TREE_COORDS[p.nodeId];
    if (!coord) return null;
    const vbW = BASE_VB_WIDTH / 1.3;
    const vbH = BASE_VB_HEIGHT / 1.3;
    const maxPanX = (BASE_VB_WIDTH - vbW) / 2;
    const maxPanY = (BASE_VB_HEIGHT - vbH) / 2;
    const targetPanX = coord.x - BASE_VB_WIDTH / 2;
    const targetPanY = coord.y - BASE_VB_HEIGHT / 2;
    return {
      zoom: 1.3,
      pan: {
        x: Math.max(-maxPanX, Math.min(maxPanX, targetPanX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, targetPanY)),
      },
    };
  }, [initialPlayerId, activePlayers]);

  const [zoomScale, setZoomScale] = useState(() => initialFocus?.zoom ?? 1.0);
  const [pan, setPan] = useState(() => initialFocus?.pan ?? { x: 0, y: 0 });

  // Table tree tier accordion state
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({
    4: true,
    3: true,
    2: true,
    1: true,
    0: true,
  });

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

  const toggleTierAccordion = (tier: number) => {
    setExpandedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  const handleZoom = (delta: number) => {
    setZoomScale((prev) => {
      const next = Math.max(1.0, Math.min(2.2, Number((prev + delta).toFixed(2))));
      if (next === 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFitScreen = () => {
    setZoomScale(1.0);
    setPan({ x: 0, y: 0 });
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
              Explore all {TOTAL_ARCHETYPES} playstyle archetypes on the expanded tree canvas. Hover over any{" "}
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
              <span>
                {unlockedArchetypeCount} / {TOTAL_ARCHETYPES}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🏆
              </span>
              <div>
                <div className="text-base font-black text-ink">
                  {Math.round((unlockedArchetypeCount / TOTAL_ARCHETYPES) * 100)}% of Tree Unlocked
                </div>
                <div className="text-[11px] font-medium text-muted">
                  Across {totalActivePlayers} active players
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: TOTAL_ARCHETYPES }).map((_, i) => (
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
                onClick={() => handleZoom(-0.2)}
                disabled={zoomScale <= 1.0}
                title="Zoom Out (−)"
                className={`px-2 py-1 transition-colors ${
                  zoomScale <= 1.0 ? "text-muted/30 cursor-not-allowed" : "text-muted hover:text-ink cursor-pointer"
                }`}
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
                onClick={() => handleZoom(0.2)}
                disabled={zoomScale >= 2.2}
                title="Zoom In (+)"
                className={`px-2 py-1 transition-colors ${
                  zoomScale >= 2.2 ? "text-muted/30 cursor-not-allowed" : "text-muted hover:text-ink cursor-pointer"
                }`}
              >
                +
              </button>
              <button
                type="button"
                onClick={handleFitScreen}
                title="Fit to Screen"
                className={`border-l border-black/10 px-2 py-1 text-[10px] font-black transition-colors cursor-pointer ${
                  zoomScale === 1.0 && pan.x === 0 && pan.y === 0
                    ? "text-court-ink underline"
                    : "text-court-ink hover:text-court-dark"
                }`}
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
          pan={pan}
          setPan={setPan}
          onZoom={handleZoom}
          onFitScreen={handleFitScreen}
          onResetZoom={handleResetZoom}
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
// VIEW 1: RESPONSIVE GRAPHICAL TREE CANVAS (CONTAINER IS CANVAS)
// ---------------------------------------------------------------------------
function splitNodeTitle(title: string): [string, string?] {
  if (title === "The All-Around Threat") return ["All-Around", "Threat"];
  if (title === "Playmaking Shot Creator") return ["Playmaking", "Shot Creator"];
  if (title === "3-and-D Specialist") return ["3-and-D", "Specialist"];
  if (title === "Floor Commander") return ["Floor", "Commander"];
  if (title === "Two-Way Combo") return ["Two-Way", "Combo"];
  if (title === "Lockdown Specialist") return ["Lockdown", "Specialist"];
  if (title === "Defensive Anchor") return ["Defensive", "Anchor"];
  if (title === "Two-Way Playmaker") return ["Two-Way", "Playmaker"];
  if (title === "Two-Way Scorer") return ["Two-Way", "Scorer"];
  if (title === "Two-Way Shooter") return ["Two-Way", "Shooter"];
  if (title === "Two-Way Force") return ["Two-Way", "Force"];
  if (title === "Clutch Assassin") return ["Clutch", "Assassin"];
  if (title === "Hustle Engine") return ["Hustle", "Engine"];
  return [title];
}

function getNodeDimensions(tier: ArchetypeTier) {
  switch (tier) {
    case 4:
      return { width: 140, height: 74 };
    case 3:
      return { width: 126, height: 74 };
    case 2:
      return { width: 108, height: 74 };
    case 1:
      return { width: 94, height: 74 };
    case 0:
    default:
      return { width: 126, height: 74 };
  }
}

function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getPlayerDotCoords(
  nodeCoord: { x: number; y: number },
  cardHeight: number,
  index: number,
  total: number,
) {
  const visibleCount = total > 4 ? 4 : total;
  const spacing = 22;
  const startX = nodeCoord.x - ((visibleCount - 1) * spacing) / 2;
  return {
    x: startX + index * spacing,
    y: nodeCoord.y - cardHeight / 2 - 14,
  };
}

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
  pan,
  setPan,
  onZoom,
  onFitScreen,
  onResetZoom,
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
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  onZoom: (delta: number) => void;
  onFitScreen: () => void;
  onResetZoom: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeFocusPlayer = hoveredPlayer ?? selectedPlayer;

  // ViewBox coordinates based on zoomScale & pan
  const viewBoxW = BASE_VB_WIDTH / zoomScale;
  const viewBoxH = BASE_VB_HEIGHT / zoomScale;
  const maxPanX = (BASE_VB_WIDTH - viewBoxW) / 2;
  const maxPanY = (BASE_VB_HEIGHT - viewBoxH) / 2;
  const viewBoxX = maxPanX + pan.x;
  const viewBoxY = maxPanY + pan.y;

  // Pointer drag-to-pan state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    if (zoomScale <= 1.0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const svgDx = dx * (viewBoxW / rect.width);
    const svgDy = dy * (viewBoxH / rect.height);

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStart.panX - svgDx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, dragStart.panY - svgDy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      setZoomScale((prev) => {
        const next = Math.max(1.0, Math.min(2.2, Number((prev + delta).toFixed(2))));
        if (next === 1.0) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Hovered roster popover state for nodes with multiple/overflow players
  const [hoveredRosterNodeId, setHoveredRosterNodeId] = useState<ArchetypeNodeId | null>(null);

  // Hovered badge state for node occupants count circle
  const [hoveredBadgeNodeId, setHoveredBadgeNodeId] = useState<ArchetypeNodeId | null>(null);

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

  // Hovered dot position in SVG coordinates
  const hoveredDotCoord = useMemo(() => {
    if (!hoveredPlayer) return null;
    const node = SKILL_TREE_NODES[hoveredPlayer.nodeId];
    const coord = SKILL_TREE_COORDS[hoveredPlayer.nodeId];
    if (!node || !coord) return null;
    const occupants = playersByNode.get(hoveredPlayer.nodeId) ?? [];
    const idx = occupants.findIndex((p) => p.id === hoveredPlayer.id);
    const dim = getNodeDimensions(node.tier);
    const totalSlots = occupants.length > 4 ? 4 : occupants.length;
    const slotIndex = idx >= 3 && occupants.length > 4 ? 3 : Math.max(0, idx);
    return getPlayerDotCoords(coord, dim.height, slotIndex, totalSlots);
  }, [hoveredPlayer, playersByNode]);

  // Hover cards are positioned inside a wrapper that has exactly the SVG's aspect
  // ratio, so a viewBox coordinate maps 1:1 onto a percentage of that wrapper.
  // The card is then pushed away from its anchor by a fixed HOVER_GAP_PX.
  const anchorStyle = (x: number, y: number, below: boolean): React.CSSProperties => {
    const leftPct = ((x - viewBoxX) / viewBoxW) * 100;
    const topPct = ((y - viewBoxY) / viewBoxH) * 100;
    return {
      // Keep the 288px card fully inside the canvas horizontally
      left: `clamp(${HOVER_CARD_HALF_WIDTH_PX}px, ${leftPct}%, calc(100% - ${HOVER_CARD_HALF_WIDTH_PX}px))`,
      top: `${topPct}%`,
      transform: below
        ? `translate(-50%, ${HOVER_GAP_PX}px)`
        : `translate(-50%, calc(-100% - ${HOVER_GAP_PX}px))`,
    };
  };

  // Player-dot popover: hugs the dot, opens below it for nodes near the top edge
  const dotPopoverStyle = hoveredDotCoord
    ? (() => {
        const below = hoveredDotCoord.y < HOVER_FLIP_BELOW_Y;
        return anchorStyle(
          hoveredDotCoord.x,
          hoveredDotCoord.y + (below ? DOT_ANCHOR_OFFSET : -DOT_ANCHOR_OFFSET),
          below,
        );
      })()
    : null;

  // Roster popover (archetype node with overflow roster): anchored to the "+N" dot
  const rosterPopoverStyle = hoveredRosterNodeId
    ? (() => {
        const coord = SKILL_TREE_COORDS[hoveredRosterNodeId];
        const node = SKILL_TREE_NODES[hoveredRosterNodeId];
        if (!coord || !node) return null;
        const dim = getNodeDimensions(node.tier);
        const dotCoord = getPlayerDotCoords(coord, dim.height, 3, 4);
        const below = dotCoord.y < HOVER_FLIP_BELOW_Y;
        return anchorStyle(
          dotCoord.x,
          dotCoord.y + (below ? DOT_ANCHOR_OFFSET : -DOT_ANCHOR_OFFSET),
          below,
        );
      })()
    : null;

  // Badge tooltip position (when hovering the occupants circle badge on a card)
  const badgeTooltipPos = useMemo(() => {
    if (!hoveredBadgeNodeId) return null;
    const coord = SKILL_TREE_COORDS[hoveredBadgeNodeId];
    const node = SKILL_TREE_NODES[hoveredBadgeNodeId];
    if (!coord || !node) return null;
    const dim = getNodeDimensions(node.tier);
    const badgeX = coord.x + dim.width / 2 - 11;
    const badgeY = coord.y - dim.height / 2 + 11;
    const leftPct = ((badgeX - viewBoxX) / viewBoxW) * 100;
    const topPct = ((badgeY - viewBoxY) / viewBoxH) * 100;
    return { leftPct, topPct };
  }, [hoveredBadgeNodeId, viewBoxX, viewBoxY, viewBoxW, viewBoxH]);

  // Archetype description card: shown for ANY hovered node, occupied or not, unless the
  // pointer is on a player dot, the count badge, or the roster popover (they have their own card).
  const nodeTooltipStyle = (() => {
    if (!hoveredNodeId || hoveredPlayer || hoveredRosterNodeId || hoveredBadgeNodeId) return null;
    const coord = SKILL_TREE_COORDS[hoveredNodeId];
    const node = SKILL_TREE_NODES[hoveredNodeId];
    if (!coord || !node) return null;
    const dim = getNodeDimensions(node.tier);
    const isOccupied = (playersByNode.get(hoveredNodeId)?.length ?? 0) > 0;
    const below = coord.y < HOVER_FLIP_BELOW_Y;

    // Occupied cards carry a row of player dots above them: anchor above that row so the card
    // never covers a dot. "CURRENT"/"NEXT TARGET" labels sit under the card: clear them when below.
    const hasFocusLabel =
      !!activeFocusPlayer &&
      (activeFocusPlayer.nodeId === hoveredNodeId || targetNodeId === hoveredNodeId);
    const anchorY = below
      ? coord.y + dim.height / 2 + (hasFocusLabel ? FOCUS_LABEL_CLEARANCE : 0)
      : coord.y - dim.height / 2 - (isOccupied ? DOT_ROW_CLEARANCE : 0);
    return anchorStyle(coord.x, anchorY, below);
  })();

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      className={`glass-2 relative rounded-3xl p-3 sm:p-5 shadow-xl ring-1 ring-black/10 overflow-hidden select-none w-full ${
        isDragging ? "cursor-grabbing" : zoomScale > 1.0 ? "cursor-grab" : "cursor-default"
      }`}
    >
      {/* Top Bar with Legend */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-2 border-b border-black/[0.06] bg-white/70 backdrop-blur-md px-3.5 py-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            ✨
          </span>
          <span className="text-xs font-bold text-ink">
            Interactive Tree Graph · Hover on any{" "}
            <span className="text-court-ink font-black">player dot</span> to inspect their road!
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-bold text-muted">
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

      {/* Floating Zoom & Pan HUD Controls (Reverted to bottom-right) */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 rounded-2xl glass-3 p-1.5 shadow-xl ring-1 ring-black/10 bg-white/90 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onZoom(-0.2)}
          disabled={zoomScale <= 1.0}
          title="Zoom Out (−)"
          className={`grid h-8 w-8 place-items-center rounded-xl text-sm font-black transition-colors ${
            zoomScale <= 1.0
              ? "text-muted/30 cursor-not-allowed"
              : "text-ink hover:bg-black/10 cursor-pointer"
          }`}
        >
          −
        </button>
        <span className="tabular px-2 text-xs font-black text-ink select-none min-w-[46px] text-center">
          {Math.round(zoomScale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onZoom(0.2)}
          disabled={zoomScale >= 2.2}
          title="Zoom In (+)"
          className={`grid h-8 w-8 place-items-center rounded-xl text-sm font-black transition-colors ${
            zoomScale >= 2.2
              ? "text-muted/30 cursor-not-allowed"
              : "text-ink hover:bg-black/10 cursor-pointer"
          }`}
        >
          +
        </button>
        <div className="h-4 w-px bg-black/15 mx-0.5" />
        <button
          type="button"
          onClick={onFitScreen}
          title="Fit tree directly inside placeholder container"
          className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition-colors cursor-pointer ${
            zoomScale === 1.0 && pan.x === 0 && pan.y === 0
              ? "bg-court-ink text-white shadow-xs"
              : "bg-court-ink/10 text-court-ink hover:bg-court-ink hover:text-white"
          }`}
        >
          <span>⤢</span>
          <span>Fit Screen</span>
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          title="Reset to 100%"
          className="rounded-xl bg-black/[0.05] px-2 py-1.5 text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
        >
          100%
        </button>
      </div>

      {/* Canvas wrapper: same aspect ratio as the viewBox (never letterboxed), so the
          hover cards below can be positioned with plain percentages. */}
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: `calc(82vh * ${BASE_VB_WIDTH} / ${BASE_VB_HEIGHT})` }}
      >
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        className="w-full h-auto block select-none"
      >
        <defs>
          <linearGradient id="activeBranchGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
          </linearGradient>

          <filter id="branchGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="nodeShadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
          </filter>

          <filter id="dotShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Tier 4 Apex Summit */}
        <rect
          x="12"
          y="16"
          width="976"
          height="134"
          rx="20"
          fill="rgba(16, 185, 129, 0.04)"
          stroke="rgba(16, 185, 129, 0.2)"
          strokeDasharray="4 4"
        />
        <text x="28" y="38" fill="#065f46" fontSize="11" fontWeight="800" letterSpacing="0.08em">
          TIER 4 · THE SUPREME APEX
        </text>

        {/* Tier 3 Pinnacle Ridge */}
        <rect
          x="12"
          y="166"
          width="976"
          height="150"
          rx="20"
          fill="rgba(168, 85, 247, 0.03)"
          stroke="rgba(168, 85, 247, 0.16)"
          strokeDasharray="4 4"
        />
        <text x="28" y="188" fill="#7e22ce" fontSize="11" fontWeight="800" letterSpacing="0.08em">
          TIER 3 · PINNACLE DUAL-PILLARS
        </text>

        {/* Tier 2 Hybrid Bridge */}
        <rect
          x="12"
          y="326"
          width="976"
          height="162"
          rx="20"
          fill="rgba(245, 158, 11, 0.03)"
          stroke="rgba(245, 158, 11, 0.16)"
          strokeDasharray="4 4"
        />
        <text x="28" y="342" fill="#b45309" fontSize="10.5" fontWeight="800" letterSpacing="0.08em">
          TIER 2 · HYBRID ROLES
        </text>

        {/* Tier 1 Specialist Meadow */}
        <rect
          x="12"
          y="504"
          width="976"
          height="176"
          rx="20"
          fill="rgba(14, 165, 233, 0.03)"
          stroke="rgba(14, 165, 233, 0.16)"
          strokeDasharray="4 4"
        />
        <text x="28" y="522" fill="#0369a1" fontSize="10.5" fontWeight="800" letterSpacing="0.08em">
          TIER 1 · SPECIALIZED DISCIPLINES
        </text>

        {/* Tier 0 Foundation Ground */}
        <rect
          x="12"
          y="696"
          width="976"
          height="166"
          rx="20"
          fill="rgba(148, 163, 184, 0.04)"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeDasharray="4 4"
        />
        <text x="28" y="718" fill="#475569" fontSize="11" fontWeight="800" letterSpacing="0.08em">
          TIER 0 · FOUNDATIONS & ROOTS
        </text>

        {/* Connector Branches */}
        {SKILL_TREE_BRANCHES.map((branch) => {
          const sourceCoord = SKILL_TREE_COORDS[branch.source];
          const targetCoord = SKILL_TREE_COORDS[branch.target];
          const sourceNode = SKILL_TREE_NODES[branch.source];
          const targetNode = SKILL_TREE_NODES[branch.target];
          if (!sourceCoord || !targetCoord || !sourceNode || !targetNode) return null;

          const sourceDim = getNodeDimensions(sourceNode.tier);
          const targetDim = getNodeDimensions(targetNode.tier);
          const sourceOccupants = playersByNode.get(branch.source)?.length ?? 0;
          const dotOffset = sourceOccupants > 0 ? 22 : 0;

          const startX = sourceCoord.x;
          const startY = sourceCoord.y - sourceDim.height / 2 - dotOffset;
          const endX = targetCoord.x;
          const endY = targetCoord.y + targetDim.height / 2;

          const isHighlighted = activeBranchIds.has(branch.id);
          const isFaded = activeFocusPlayer && !isHighlighted;

          const dy = Math.abs(startY - endY);
          const cy1 = startY - dy * 0.45;
          const cy2 = endY + dy * 0.45;
          const pathData = `M ${startX} ${startY} C ${startX} ${cy1}, ${endX} ${cy2}, ${endX} ${endY}`;

          return (
            <path
              key={branch.id}
              d={pathData}
              fill="none"
              stroke={isHighlighted ? "url(#activeBranchGrad)" : "rgba(0, 0, 0, 0.14)"}
              strokeWidth={isHighlighted ? 3.5 : 1.8}
              strokeDasharray={isHighlighted ? "6 3" : undefined}
              filter={isHighlighted ? "url(#branchGlow)" : undefined}
              opacity={isFaded ? 0.2 : 1}
              className={isHighlighted ? "animate-[dash_1.5s_linear_infinite]" : "transition-opacity duration-300"}
            />
          );
        })}

        {/* Archetype Cards & Player Dots */}
        {(Object.keys(SKILL_TREE_NODES) as ArchetypeNodeId[]).map((nodeId) => {
          const node = SKILL_TREE_NODES[nodeId];
          const coord = SKILL_TREE_COORDS[nodeId];
          const dim = getNodeDimensions(node.tier);
          const occupants = playersByNode.get(nodeId) ?? [];
          const isOccupied = occupants.length > 0;

          const isCurrentForFocus = activeFocusPlayer && activeFocusPlayer.nodeId === nodeId;
          const isTargetForFocus = activeFocusPlayer && targetNodeId === nodeId;
          const isDimmed =
            (tierFilter !== "all" && node.tier !== tierFilter) ||
            (activeFocusPlayer && !isCurrentForFocus && !isTargetForFocus);

          const [titleLine1, titleLine2] = splitNodeTitle(node.title);

          return (
            <g
              key={nodeId}
              opacity={isDimmed ? 0.35 : 1}
              className="transition-opacity duration-200"
            >
              {/* Archetype Card Rectangle */}
              <g
                className="cursor-pointer group/card"
                onMouseEnter={() => onHoverNode(nodeId)}
                onMouseLeave={() => onHoverNode(null)}
                onClick={() => {
                  if (occupants.length > 0) {
                    onSelectPlayer(occupants[0]);
                  }
                }}
              >
                <rect
                  x={coord.x - dim.width / 2}
                  y={coord.y - dim.height / 2}
                  width={dim.width}
                  height={dim.height}
                  rx={14}
                  fill={
                    isCurrentForFocus
                      ? "rgba(234, 88, 12, 0.12)"
                      : isTargetForFocus
                        ? "rgba(16, 185, 129, 0.12)"
                        : isOccupied
                          ? "#ffffff"
                          : "rgba(255, 255, 255, 0.65)"
                  }
                  stroke={
                    isCurrentForFocus
                      ? "#ea580c"
                      : isTargetForFocus
                        ? "#10b981"
                        : isOccupied
                          ? "rgba(0, 0, 0, 0.18)"
                          : "rgba(0, 0, 0, 0.1)"
                  }
                  strokeWidth={isCurrentForFocus || isTargetForFocus ? 2.5 : 1}
                  strokeDasharray={!isOccupied && !isCurrentForFocus && !isTargetForFocus ? "4 3" : undefined}
                  filter="url(#nodeShadow)"
                />

                {/* Node Emoji */}
                <text
                  x={coord.x}
                  y={coord.y - 14}
                  textAnchor="middle"
                  fontSize={node.tier === 1 ? 18 : 20}
                  className="select-none pointer-events-none"
                >
                  {node.emoji}
                </text>

                {/* Node Title */}
                <text
                  x={coord.x}
                  y={coord.y + (titleLine2 ? 0 : 3)}
                  textAnchor="middle"
                  fontSize={node.tier === 1 ? 9.5 : 10.5}
                  fontWeight="800"
                  fill="#1c1917"
                  className="select-none pointer-events-none"
                >
                  {titleLine1}
                </text>
                {titleLine2 && (
                  <text
                    x={coord.x}
                    y={coord.y + 11.5}
                    textAnchor="middle"
                    fontSize={node.tier === 1 ? 9.5 : 10.5}
                    fontWeight="800"
                    fill="#1c1917"
                    className="select-none pointer-events-none"
                  >
                    {titleLine2}
                  </text>
                )}

                {/* Pillar Tag */}
                <text
                  x={coord.x}
                  y={coord.y + (titleLine2 ? 22 : 15)}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="#6f6762"
                  letterSpacing="0.04em"
                  className="select-none pointer-events-none uppercase"
                >
                  {node.pillarLabel.split("+")[0].trim()}
                </text>

                {/* Occupants Badge: Circle with number at top-right of card (rendered ONLY when occupied) */}
                {isOccupied && (() => {
                  const badgeX = coord.x + dim.width / 2 - 12;
                  const badgeY = coord.y - dim.height / 2 + 12;
                  const isHovered = hoveredBadgeNodeId === nodeId;
                  const badgeR = (occupants.length > 9 ? 10 : 8.5) + (isHovered ? 1 : 0);

                  return (
                    <g
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        setHoveredBadgeNodeId(nodeId);
                        onHoverNode(null);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setHoveredBadgeNodeId(null);
                        // Still over the card itself: bring its description card back
                        onHoverNode(nodeId);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredRosterNodeId((prev) => (prev === nodeId ? null : nodeId));
                      }}
                    >
                      <circle
                        cx={badgeX}
                        cy={badgeY}
                        r={badgeR}
                        fill={isHovered ? "#c2410c" : "#ea580c"}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2 : 1.5}
                        filter="url(#dotShadow)"
                        className="transition-colors duration-150"
                      />
                      <text
                        x={badgeX}
                        y={badgeY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={occupants.length > 9 ? 7.5 : 8}
                        fontWeight="900"
                        fill="#ffffff"
                        className="select-none pointer-events-none"
                      >
                        {occupants.length}
                      </text>
                    </g>
                  );
                })()}

                {/* Focus Badges */}
                {isCurrentForFocus && (
                  <text
                    x={coord.x}
                    y={coord.y + dim.height / 2 + 10}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight="900"
                    fill="#a73a00"
                  >
                    📍 CURRENT
                  </text>
                )}
                {isTargetForFocus && (
                  <text
                    x={coord.x}
                    y={coord.y + dim.height / 2 + 10}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight="900"
                    fill="#059669"
                  >
                    🎯 NEXT TARGET
                  </text>
                )}
              </g>

              {/* ----------------------------------------------------------- */}
              {/* PLAYER DOTS ON THE TREE (Positioned directly above the card) */}
              {/* ----------------------------------------------------------- */}
              {isOccupied && (() => {
                const maxDots = 4;
                const hasOverflow = occupants.length > maxDots;
                const visibleOccupants = hasOverflow ? occupants.slice(0, 3) : occupants;
                const totalSlots = hasOverflow ? 4 : occupants.length;

                return (
                  <g>
                    {visibleOccupants.map((p, idx) => {
                      const dotCoord = getPlayerDotCoords(coord, dim.height, idx, totalSlots);
                      const isDotSelected = selectedPlayer?.id === p.id;
                      const isDotHovered = hoveredPlayer?.id === p.id;

                      return (
                        <g
                          key={p.id}
                          className="cursor-pointer group/dot"
                          onMouseEnter={() => onHoverPlayer(p.id)}
                          onMouseLeave={() => onHoverPlayer(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlayer(p);
                          }}
                        >
                          {/* Pulsing Outer Ring */}
                          {(isDotSelected || isDotHovered) && (
                            <circle
                              cx={dotCoord.x}
                              cy={dotCoord.y}
                              r={12}
                              fill="none"
                              stroke="#ea580c"
                              strokeWidth={1.5}
                              opacity={0.8}
                              className="animate-ping"
                            />
                          )}

                          {/* Main Player Dot Circle */}
                          <circle
                            cx={dotCoord.x}
                            cy={dotCoord.y}
                            r={isDotSelected || isDotHovered ? 10 : 8.5}
                            fill={isDotSelected || isDotHovered ? "#ea580c" : "#059669"}
                            stroke="#ffffff"
                            strokeWidth={1.75}
                            filter="url(#dotShadow)"
                            className="transition-all duration-150"
                          />

                          {/* Player Initials */}
                          <text
                            x={dotCoord.x}
                            y={dotCoord.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={7.5}
                            fontWeight="900"
                            fill="#ffffff"
                            letterSpacing="-0.02em"
                            className="select-none pointer-events-none"
                          >
                            {getPlayerInitials(p.name)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Overflow "+N" Badge */}
                    {hasOverflow && (() => {
                      const overflowCount = occupants.length - 3;
                      const overflowCoord = getPlayerDotCoords(coord, dim.height, 3, totalSlots);
                      const isRosterOpen = hoveredRosterNodeId === nodeId;

                      return (
                        <g
                          key="overflow-badge"
                          className="cursor-pointer group/overflow"
                          onMouseEnter={() => setHoveredRosterNodeId(nodeId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoveredRosterNodeId((prev) => (prev === nodeId ? null : nodeId));
                          }}
                        >
                          <circle
                            cx={overflowCoord.x}
                            cy={overflowCoord.y}
                            r={isRosterOpen ? 10.5 : 9}
                            fill={isRosterOpen ? "#ea580c" : "#1e293b"}
                            stroke="#ffffff"
                            strokeWidth={1.75}
                            filter="url(#dotShadow)"
                            className="transition-all duration-150"
                          />
                          <text
                            x={overflowCoord.x}
                            y={overflowCoord.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={7}
                            fontWeight="900"
                            fill="#ffffff"
                            className="select-none pointer-events-none"
                          >
                            +{overflowCount}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {/* ----------------------------------------------------------- */}
      {/* HTML ROSTER POPOVER FOR ARCHETYPE WITH OVERFLOW PLAYERS     */}
      {/* ----------------------------------------------------------- */}
      {hoveredRosterNodeId && rosterPopoverStyle && !hoveredPlayer && (
        <div
          className="glass-pop absolute z-50 w-72 rounded-3xl p-3.5 pointer-events-auto"
          style={rosterPopoverStyle}
          onMouseEnter={() => setHoveredRosterNodeId(hoveredRosterNodeId)}
          onMouseLeave={() => setHoveredRosterNodeId(null)}
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-ink">
              <span>{SKILL_TREE_NODES[hoveredRosterNodeId]?.emoji}</span>
              <span>{SKILL_TREE_NODES[hoveredRosterNodeId]?.title} Roster</span>
            </div>
            <span className="rounded-full bg-court-ink/10 px-2 py-0.5 text-[10px] font-black text-court-ink">
              {(playersByNode.get(hoveredRosterNodeId) ?? []).length} players
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {(playersByNode.get(hoveredRosterNodeId) ?? []).map((p) => {
              const isSelected = selectedPlayer?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPlayer(p);
                    setHoveredRosterNodeId(null);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-court-ink text-white"
                      : "bg-black/[0.03] hover:bg-black/[0.07] text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0">
                      <div className={`text-xs font-extrabold truncate ${isSelected ? "text-white" : "text-ink"}`}>
                        {p.name}
                      </div>
                      <div className={`text-[10px] font-medium truncate ${isSelected ? "text-white/80" : "text-muted"}`}>
                        Road: {p.targetTitle}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black shrink-0 ${isSelected ? "text-white" : "text-court-ink"}`}>
                    {p.roadProgressPct}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-1.5 border-t border-black/[0.05] text-[9px] font-bold text-muted text-center italic">
            Click any player to inspect evolution path
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* HTML TOOLTIP FOR HOVERED OCCUPANTS COUNT BADGE              */}
      {/* ----------------------------------------------------------- */}
      {hoveredBadgeNodeId && badgeTooltipPos && !hoveredPlayer && !hoveredRosterNodeId && (
        <div
          className="absolute z-50 pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${Math.max(8, Math.min(92, badgeTooltipPos.leftPct))}%`,
            top: `${Math.max(5, Math.min(92, badgeTooltipPos.topPct))}%`,
            transform: "translate(-50%, 15px)",
          }}
        >
          <div className="rounded-lg bg-slate-900/95 text-white px-2 py-0.5 text-[10px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-court-ink" />
            <span>
              {(playersByNode.get(hoveredBadgeNodeId) ?? []).length}{" "}
              {(playersByNode.get(hoveredBadgeNodeId) ?? []).length === 1
                ? "player"
                : "players"}
            </span>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* HTML HOVER POPOVER CARD FOR HOVERED PLAYER DOT               */}
      {/* ----------------------------------------------------------- */}
      {hoveredPlayer && dotPopoverStyle && (
        <div
          className="glass-pop absolute z-50 w-72 rounded-3xl p-4 pointer-events-none"
          style={dotPopoverStyle}
        >
          <div className="flex items-center gap-2.5">
            <Avatar name={hoveredPlayer.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-ink truncate">
                  {hoveredPlayer.name}
                </span>
                {hoveredPlayer.injured && <InjuredBadge size="xs" />}
              </div>
              <div className="text-[11px] font-bold text-muted truncate">
                {hoveredPlayer.archetype.emoji} {hoveredPlayer.archetype.title} · Tier{" "}
                {hoveredPlayer.archetype.tier}
              </div>
            </div>
          </div>

          {/* Stat Snapshot */}
          <div className="mt-2.5 grid grid-cols-4 gap-1 text-center bg-black/[0.04] p-1.5 rounded-xl text-[10px]">
            <div>
              <div className="text-muted font-bold">GP</div>
              <div className="font-extrabold text-ink">{hoveredPlayer.gp}</div>
            </div>
            <div>
              <div className="text-muted font-bold">PPG</div>
              <div className="font-extrabold text-ink">{hoveredPlayer.ppg.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-muted font-bold">APG</div>
              <div className="font-extrabold text-ink">{hoveredPlayer.apg.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-muted font-bold">STOCKS</div>
              <div className="font-extrabold text-ink">{hoveredPlayer.stockPg.toFixed(1)}</div>
            </div>
          </div>

          {/* Active Road to Next Tier */}
          <div className="mt-2.5 border-t border-black/[0.06] pt-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-court-ink">
              <span>Road to Tier {hoveredPlayer.targetTier}</span>
              <span>{hoveredPlayer.roadProgressPct}%</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-black text-ink">
              <span>{hoveredPlayer.targetEmoji}</span>
              <span>{hoveredPlayer.targetTitle}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
              <div
                className="h-full rounded-full bg-court-ink transition-all duration-300"
                style={{ width: `${Math.max(6, hoveredPlayer.roadProgressPct)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10px] font-medium text-court-ink leading-tight">
              🎯 {hoveredPlayer.deltaSummary}
            </div>
          </div>

          <div className="mt-2 text-[9px] font-bold text-muted text-center italic">
            Click dot to inspect full evolution path
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* HTML DESCRIPTION CARD FOR HOVERED ARCHETYPE NODE            */}
      {/* ----------------------------------------------------------- */}
      {hoveredNodeId && !hoveredPlayer && nodeTooltipStyle && (
        <div
          className="glass-pop absolute z-50 w-72 rounded-3xl p-4 pointer-events-none"
          style={nodeTooltipStyle}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl select-none" aria-hidden>
              {SKILL_TREE_NODES[hoveredNodeId].emoji}
            </span>
            <div className="min-w-0">
              <div className="font-extrabold text-xs text-stone-900 leading-tight truncate">
                {SKILL_TREE_NODES[hoveredNodeId].title}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-court-ink">
                {SKILL_TREE_NODES[hoveredNodeId].pillarLabel}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] font-medium text-stone-700 leading-relaxed">
            {SKILL_TREE_NODES[hoveredNodeId].summary}
          </p>
          <div className="mt-2.5 border-t border-black/[0.08] pt-2 space-y-1 text-left">
            <div className="text-[10px] font-black uppercase tracking-wider text-stone-900">
              Requirements:
            </div>
            {SKILL_TREE_NODES[hoveredNodeId].requirements.map((r, i) => (
              <div key={i} className="text-[10.5px] font-semibold text-stone-800 flex items-start gap-1.5 leading-snug">
                <span className="text-court-ink font-black">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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

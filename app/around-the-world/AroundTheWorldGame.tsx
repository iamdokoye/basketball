"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/app/components/Avatar";
import {
  type CourtSpot,
  type ShootingGame,
  type ShootingGameMode,
  DEFAULT_COURT_SPOTS,
  createShootingGame,
  handleShotMake,
  handleShotMiss,
  handleSaveSpot,
  handleChanceShot,
} from "@/lib/shootingGame";
import { playSwish, playClang, playBuzzer, playWhistle } from "@/lib/courtAudio";
import type { Player } from "@/lib/queries";

const STORAGE_KEY = "pickup_around_the_world_v1";

export function AroundTheWorldGame({ allPlayers }: { allPlayers: Player[] }) {
  const [game, setGame] = useState<ShootingGame | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Setup state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>(() => {
    const active = allPlayers.filter((p) => !p.archived);
    return active.slice(0, 4).map((p) => p.id);
  });
  const [mode, setMode] = useState<ShootingGameMode>("classic_chance");
  const [penalty, setPenalty] = useState<"reset_to_start" | "back_one">("reset_to_start");
  const [keepShooting, setKeepShooting] = useState<boolean>(true);
  const [spots, setSpots] = useState<CourtSpot[]>(DEFAULT_COURT_SPOTS);
  const [customSpotName, setCustomSpotName] = useState("");

  // Persist game state
  function updateGame(nextGame: ShootingGame | null) {
    setGame(nextGame);
    try {
      if (nextGame) localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGame));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function startNewGame() {
    if (selectedPlayerIds.length === 0) return;
    const participants = selectedPlayerIds
      .map((id) => allPlayers.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p))
      .map((p) => ({ id: p.id, name: p.name }));

    const newGame = createShootingGame({
      title: "Around the World Shootout",
      mode,
      chancePenalty: penalty,
      keepShootingOnMake: keepShooting,
      spots,
      players: participants,
    });
    playWhistle();
    updateGame(newGame);
  }

  function resetGame() {
    if (confirm("Reset current Around the World game?")) {
      updateGame(null);
    }
  }

  function onMake() {
    if (!game) return;
    playSwish();
    const next = handleShotMake(game);
    if (next.status === "finished") {
      playBuzzer();
    }
    updateGame(next);
  }

  function onMiss() {
    if (!game) return;
    playClang();
    const next = handleShotMiss(game);
    updateGame(next);
  }

  function onSave() {
    if (!game) return;
    const next = handleSaveSpot(game);
    updateGame(next);
  }

  function onChance(made: boolean) {
    if (!game) return;
    if (made) {
      playSwish();
      const next = handleChanceShot(game, true);
      if (next.status === "finished") playBuzzer();
      updateGame(next);
    } else {
      playClang();
      const next = handleChanceShot(game, false);
      updateGame(next);
    }
  }

  // Add custom spot
  function addSpot() {
    if (!customSpotName.trim()) return;
    const newSpot: CourtSpot = {
      id: `spot-${Date.now()}`,
      name: customSpotName.trim(),
      short: customSpotName.trim().slice(0, 5).toUpperCase(),
      x: 50,
      y: 50,
      type: "custom",
    };
    setSpots((prev) => [...prev, newSpot]);
    setCustomSpotName("");
  }

  function removeSpot(id: string) {
    if (spots.length <= 2) return;
    setSpots((prev) => prev.filter((s) => s.id !== id));
  }

  function resetSpotsToDefault() {
    setSpots(DEFAULT_COURT_SPOTS);
  }

  // ----------------------------------------------------
  // SETUP VIEW
  // ----------------------------------------------------
  if (!game) {
    return (
      <div className="space-y-6">
        <div className="space-y-1 px-1">
          <div className="label text-court-ink">Shooting Drill &amp; Mini-Game</div>
          <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
            Around the World 🌍
          </h1>
          <p className="text-sm text-muted">
            Players take turns advancing through spots around the court. Hit your shot to move forward;
            first to complete the circuit wins the crown!
          </p>
        </div>

        {/* Game Mode Selection */}
        <div className="glass-1 space-y-4 rounded-3xl p-5 sm:p-6">
          <div className="label text-xs">1. Select Game Mode</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("classic_chance")}
              className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition ${
                mode === "classic_chance"
                  ? "border-court-ink bg-court-soft/20 ring-2 ring-court-soft/40"
                  : "border-black/10 bg-white/60 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-ink">
                  Classic (Chance It or Save)
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Default High-Stakes
                </span>
              </div>
              <p className="text-xs text-muted">
                When you miss, choose to <strong>Save</strong> your spot or take a high-risk{" "}
                <strong>Chance Shot</strong>. If you miss the chance, you drop back!
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("steady_stay")}
              className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition ${
                mode === "steady_stay"
                  ? "border-court-ink bg-court-soft/20 ring-2 ring-court-soft/40"
                  : "border-black/10 bg-white/60 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-ink">
                  Stay on Miss (No Penalty)
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Steady Practice
                </span>
              </div>
              <p className="text-xs text-muted">
                Pure spot progression. If you miss, you simply <strong>stay at your spot</strong> with
                no penalty and wait for your next turn. First to finish wins!
              </p>
            </button>
          </div>

          {mode === "classic_chance" && (
            <div className="rounded-2xl bg-black/[0.03] p-3 text-xs">
              <span className="font-bold text-ink">Chance penalty:</span>
              <div className="mt-2 flex gap-4">
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted hover:text-ink">
                  <input
                    type="radio"
                    name="penalty"
                    checked={penalty === "reset_to_start"}
                    onChange={() => setPenalty("reset_to_start")}
                    className="accent-court-ink"
                  />
                  Reset back to Spot #1 (Ruthless playground rule)
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted hover:text-ink">
                  <input
                    type="radio"
                    name="penalty"
                    checked={penalty === "back_one"}
                    onChange={() => setPenalty("back_one")}
                    className="accent-court-ink"
                  />
                  Demote back 1 spot (Friendly)
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/50 p-3">
            <div>
              <div className="text-xs font-bold text-ink">Keep shooting on make</div>
              <div className="text-[11px] text-muted">
                If enabled, a player who hits a shot shoots from the next spot immediately until a miss.
              </div>
            </div>
            <input
              type="checkbox"
              checked={keepShooting}
              onChange={(e) => setKeepShooting(e.target.checked)}
              className="h-5 w-5 rounded-md accent-court-ink"
            />
          </div>
        </div>

        {/* Players Selection */}
        <div className="glass-1 space-y-4 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="label text-xs">2. Select Shooters ({selectedPlayerIds.length})</div>
            <button
              type="button"
              onClick={() => {
                const active = allPlayers.filter((p) => !p.archived);
                setSelectedPlayerIds(
                  selectedPlayerIds.length === active.length ? [] : active.map((p) => p.id)
                );
              }}
              className="text-xs font-bold text-court-ink hover:underline"
            >
              {selectedPlayerIds.length === allPlayers.filter((p) => !p.archived).length
                ? "Deselect All"
                : "Select All Active"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {allPlayers
              .filter((p) => !p.archived)
              .map((p) => {
                const isSelected = selectedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlayerIds((prev) =>
                        isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      );
                    }}
                    className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition ${
                      isSelected
                        ? "border-court-ink bg-court-soft/20 font-bold text-court-ink"
                        : "border-black/5 bg-white/70 hover:bg-white text-ink"
                    }`}
                  >
                    <Avatar name={p.name} size="sm" />
                    <span className="truncate text-xs">{p.name}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Court Spots Config / Preview */}
        <div className="glass-1 space-y-4 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="label text-xs">3. Court Positions ({spots.length} Spots)</div>
              <p className="text-xs text-muted">
                Order of spots players must sink shots from to win Around the World.
              </p>
            </div>
            <button
              type="button"
              onClick={resetSpotsToDefault}
              className="text-xs font-semibold text-muted hover:text-ink hover:underline"
            >
              Reset to Default (8 Spots)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {spots.map((spot, idx) => (
              <div
                key={spot.id}
                className="group relative flex items-center justify-between rounded-xl border border-black/8 bg-white/80 p-2.5 text-xs font-bold shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-court-ink/10 text-[10px] font-black text-court-ink">
                    {idx + 1}
                  </span>
                  <span className="truncate">{spot.name}</span>
                </div>
                {spots.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeSpot(spot.id)}
                    title="Remove spot"
                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customSpotName}
              onChange={(e) => setCustomSpotName(e.target.value)}
              placeholder="Add custom court position (e.g., Deep Logo 3, Bank Shot)..."
              onKeyDown={(e) => e.key === "Enter" && addSpot()}
              className="flex-1 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold focus:border-court-ink focus:outline-hidden"
            />
            <button
              type="button"
              onClick={addSpot}
              className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-95"
            >
              + Add Spot
            </button>
          </div>
        </div>

        {/* Start Button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={selectedPlayerIds.length === 0}
            onClick={startNewGame}
            className="w-full sm:w-auto min-w-[260px] rounded-full bg-court-ink px-8 py-3.5 text-base font-extrabold text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            Start Around the World Game →
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ACTIVE GAMEPLAY VIEW
  // ----------------------------------------------------
  const activePlayer = game.players[game.activePlayerIndex];
  const activeSpot =
    activePlayer && activePlayer.currentSpotIndex < game.spots.length
      ? game.spots[activePlayer.currentSpotIndex]
      : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="label text-court-ink">
            {game.mode === "classic_chance" ? "Classic Shootout (Chance / Save)" : "Stay on Miss (No Penalty)"}
          </div>
          <h1 className="text-[28px] font-extrabold leading-[34px] tracking-tight">
            Around the World 🌍
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetGame}
            className="rounded-full bg-black/[0.06] px-3.5 py-1.5 text-xs font-bold text-muted transition hover:bg-black/10 hover:text-ink active:scale-95"
          >
            {game.status === "finished" ? "New Game" : "Reset"}
          </button>
        </div>
      </div>

      {/* Winner Banner if Finished */}
      {game.status === "finished" && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 p-6 text-center shadow-lg">
          <div className="mx-auto mb-2 text-5xl">👑 🏆 🏀</div>
          <div className="label text-xs text-amber-800">Around the World Champion</div>
          <h2 className="text-3xl font-black tracking-tight text-ink">
            {game.players.find((p) => p.id === game.winnerId)?.name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            Completed all {game.spots.length} court spots first!
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={startNewGame}
              className="rounded-full bg-court-ink px-6 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:opacity-90 active:scale-95"
            >
              Play Rematch
            </button>
            <button
              type="button"
              onClick={() => updateGame(null)}
              className="rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-ink shadow-xs transition hover:bg-black/5"
            >
              Change Setup
            </button>
          </div>
        </div>
      )}

      {/* Main Play Area: Active Shooter & Action Deck */}
      {game.status === "playing" && activePlayer && activeSpot && (
        <div className="glass-2 relative overflow-hidden rounded-3xl border border-court-soft/40 p-5 sm:p-6 shadow-sm">
          {/* Header with Turn Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4">
            <div className="flex items-center gap-3">
              <Avatar name={activePlayer.name} size="lg" tone="ink" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-court-ink px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Up to Shoot
                  </span>
                  {activePlayer.streak > 1 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      🔥 {activePlayer.streak} in a row
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-ink">
                  {activePlayer.name}
                </h2>
              </div>
            </div>

            {/* Target Spot Info */}
            <div className="rounded-2xl bg-white/90 px-4 py-2 text-right shadow-2xs">
              <div className="label text-[10px] text-court-ink">Current Target</div>
              <div className="text-lg font-black text-ink">
                Spot #{activePlayer.currentSpotIndex + 1}: {activeSpot.name}
              </div>
              <div className="text-[11px] font-semibold text-muted">
                {game.spots.length - activePlayer.currentSpotIndex} spots remaining to win
              </div>
            </div>
          </div>

          {/* Action Deck: Make / Miss vs Chance / Save */}
          <div className="pt-5">
            {game.chancePending ? (
              /* High Stakes Chance Decision */
              <div className="space-y-4 rounded-2xl bg-gradient-to-b from-rose-500/10 to-amber-500/10 p-5 text-center border border-rose-200">
                <div className="mx-auto text-3xl">⚠️ 🎲</div>
                <div>
                  <h3 className="text-lg font-black text-rose-900">
                    Shot Missed! Will you Chance It or Save?
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    <strong>Save:</strong> Keep your spot and pass the turn. <br />
                    <strong>Chance It:</strong> Shoot right now. If you make it, you advance! If you miss, you get{" "}
                    {game.chancePenalty === "reset_to_start" ? "sent back to Spot #1!" : "knocked back 1 spot!"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  <button
                    type="button"
                    onClick={onSave}
                    className="flex flex-col items-center justify-center rounded-2xl bg-white/95 p-3.5 shadow-sm transition hover:bg-white active:scale-95"
                  >
                    <span className="text-sm font-extrabold text-ink">🛡️ Save Spot</span>
                    <span className="text-[10px] text-muted">Keep position safely</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChance(true)}
                    className="flex flex-col items-center justify-center rounded-2xl bg-emerald-600 p-3.5 text-white shadow-md transition hover:bg-emerald-500 active:scale-95"
                  >
                    <span className="text-sm font-black">🎯 Chanced &amp; MADE!</span>
                    <span className="text-[10px] text-white/80">Advance to next spot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChance(false)}
                    className="flex flex-col items-center justify-center rounded-2xl bg-rose-600 p-3.5 text-white shadow-md transition hover:bg-rose-500 active:scale-95"
                  >
                    <span className="text-sm font-black">❌ Chanced &amp; MISSED</span>
                    <span className="text-[10px] text-white/80">
                      {game.chancePenalty === "reset_to_start" ? "Drop to Spot 1" : "Drop back 1 spot"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Shot Buttons */
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={onMake}
                  className="group flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-600 p-5 text-white shadow-md transition hover:bg-emerald-500 active:scale-95"
                >
                  <span className="text-2xl transition group-hover:scale-110">🏀 🎯</span>
                  <span className="text-lg font-black tracking-tight">MAKE SHOT</span>
                  <span className="text-xs text-white/80">
                    Advance to Spot #{activePlayer.currentSpotIndex + 2}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onMiss}
                  className="group flex flex-col items-center justify-center gap-1 rounded-2xl bg-rose-600 p-5 text-white shadow-md transition hover:bg-rose-500 active:scale-95"
                >
                  <span className="text-2xl transition group-hover:scale-110">❌ 🧱</span>
                  <span className="text-lg font-black tracking-tight">MISS</span>
                  <span className="text-xs text-white/80">
                    {game.mode === "classic_chance" ? "Chance or Save decision" : "Stay at current spot"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive 2D Half-Court Map */}
      <div className="glass-1 space-y-3 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="label text-xs">Court Progression Map</div>
            <h3 className="text-base font-extrabold text-ink">Around the World Circuit</h3>
          </div>
          <div className="text-xs font-semibold text-muted">
            {game.spots.length} designated spots
          </div>
        </div>

        {/* Half-Court SVG Visual */}
        <div className="relative mx-auto aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-[#e8be89] shadow-inner">
          {/* Court Wood Texture & Lines */}
          <svg
            viewBox="0 0 100 70"
            className="absolute inset-0 h-full w-full stroke-court-lines/40"
            fill="none"
            strokeWidth="0.8"
          >
            {/* Baseline */}
            <line x1="0" y1="70" x2="100" y2="70" strokeWidth="1.2" stroke="#8c5826" />
            {/* Key / Paint */}
            <rect x="36" y="38" width="28" height="32" fill="#d99f66" stroke="#8c5826" strokeWidth="0.9" />
            {/* Free Throw Circle */}
            <circle cx="50" cy="38" r="14" stroke="#8c5826" strokeDasharray="2,2" />
            {/* 3-Point Arc */}
            <path
              d="M 12 70 L 12 56 A 40 40 0 0 1 88 56 L 88 70"
              stroke="#8c5826"
              strokeWidth="1"
            />
            {/* Backboard & Rim */}
            <line x1="42" y1="67" x2="58" y2="67" stroke="#333" strokeWidth="1.5" />
            <circle cx="50" cy="64" r="3.2" stroke="#e04e26" strokeWidth="1.2" fill="#e04e26/20" />
          </svg>

          {/* Spots Plotted on Court */}
          {game.spots.map((spot, idx) => {
            // Find which players are currently at this spot
            const playersAtSpot = game.players.filter((p) => p.currentSpotIndex === idx);
            const isTargetForActive =
              activePlayer && activePlayer.currentSpotIndex === idx;

            // Map standard court coordinates
            const posX = spot.x ?? (15 + (idx * 70) / (game.spots.length - 1));
            const posY = spot.y ?? 50;

            return (
              <div
                key={spot.id}
                style={{ left: `${posX}%`, top: `${posY}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                {/* Spot Pin / Marker */}
                <div
                  className={`relative grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full text-xs font-black shadow-md transition-all ${
                    isTargetForActive
                      ? "bg-court-ink text-white ring-4 ring-court-ink/40 scale-125 z-20 animate-pulse"
                      : playersAtSpot.length > 0
                      ? "bg-ink text-white ring-2 ring-white z-10"
                      : "bg-white/90 text-ink/70 ring-1 ring-black/20"
                  }`}
                  title={`${spot.name} (#${idx + 1})`}
                >
                  {idx + 1}
                </div>

                {/* Spot Label */}
                <span className="mt-1 hidden sm:block whitespace-nowrap rounded-md bg-black/60 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-xs">
                  {spot.short}
                </span>

                {/* Players stationed at this spot */}
                {playersAtSpot.length > 0 && (
                  <div className="absolute -top-7 flex -space-x-1.5 z-30">
                    {playersAtSpot.map((p) => (
                      <span
                        key={p.id}
                        title={`${p.name} is at Spot #${idx + 1}`}
                        className="rounded-full ring-1 ring-white shadow-xs"
                      >
                        <Avatar name={p.name} size="sm" tone={p.id === activePlayer?.id ? "ink" : "soft"} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Leaderboard & Progress Ladder */}
      <div className="glass-1 space-y-3 rounded-3xl p-5 sm:p-6">
        <div className="label text-xs">Shooter Standings &amp; Progression</div>
        <div className="space-y-2">
          {game.players.map((p, idx) => {
            const isTurn = game.activePlayerIndex === idx && game.status === "playing";
            const isWinner = p.id === game.winnerId;
            const pct = Math.min(100, Math.round((p.currentSpotIndex / game.spots.length) * 100));
            const fgPct = p.attempts > 0 ? Math.round((p.makes / p.attempts) * 100) : 0;

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-3 transition ${
                  isTurn
                    ? "border-court-ink bg-court-soft/15 ring-2 ring-court-soft/30"
                    : isWinner
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-black/5 bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={p.name} size="sm" tone={isTurn ? "ink" : "soft"} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-ink">{p.name}</span>
                        {isTurn && (
                          <span className="rounded-full bg-court-ink px-1.5 py-0.2 text-[9px] font-black uppercase text-white">
                            Turn
                          </span>
                        )}
                        {isWinner && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-800">
                            👑 Champion
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        {p.currentSpotIndex >= game.spots.length ? (
                          <span className="font-bold text-emerald-700">Finished All Spots!</span>
                        ) : (
                          <>
                            At Spot #{p.currentSpotIndex + 1}:{" "}
                            <span className="font-semibold text-ink">
                              {game.spots[p.currentSpotIndex]?.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black tabular text-ink">
                      {p.currentSpotIndex} / {game.spots.length} Spots
                    </div>
                    <div className="text-[10px] text-muted">
                      {p.makes}/{p.attempts} FG ({fgPct}%)
                      {game.mode === "classic_chance" && p.chancesTaken > 0 && (
                        <span> · {p.chancesTaken - p.chancesFailed}/{p.chancesTaken} Chance</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isWinner ? "bg-amber-500" : isTurn ? "bg-court-ink" : "bg-black/40"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Shot-by-Shot Log */}
      <div className="glass-1 space-y-2 rounded-3xl p-5">
        <div className="label text-xs">Live Court Action</div>
        <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {game.logs.map((log, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                log.type === "win"
                  ? "bg-amber-500/20 text-amber-900 font-bold"
                  : log.type === "chance_make"
                  ? "bg-emerald-500/15 text-emerald-800 font-semibold"
                  : log.type === "chance_fail"
                  ? "bg-rose-500/15 text-rose-800 font-semibold"
                  : "bg-white/60 text-ink"
              }`}
            >
              {log.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

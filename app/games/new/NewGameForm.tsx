"use client";

import { useRef, useState, useTransition } from "react";
import { createGame } from "@/lib/actions";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import {
  balanceTeams,
  fairness,
  randomizeTeams,
  type RandomMatchupFlavor,
} from "@/lib/balance";
import { playDiceRoll } from "@/lib/courtAudio";

type Assign = { team: "A" | "B"; seq: number };

/** Players on court per side. The first 3 picked for each team start; the rest are bench. */
const STARTERS = 3;

type ModeId = "first" | "winby2";
type GameFormat = "target" | "timed";

const TIMED_PRESETS = [
  {
    minutes: 10,
    quarters: 4,
    title: "10 min / Q",
    subtitle: "FIBA Standard · 40 min",
  },
  {
    minutes: 12,
    quarters: 4,
    title: "12 min / Q",
    subtitle: "NBA Standard · 48 min",
  },
  {
    minutes: 15,
    quarters: 4,
    title: "15 min / Q",
    subtitle: "Long Quarters · 60 min",
  },
  {
    minutes: 5,
    quarters: 4,
    title: "5 min / Q",
    subtitle: "Sprint Quarters · 20 min",
  },
];

/** First-to-target is the default: the game ends the moment a team reaches the score. */
const MODES: {
  id: ModeId;
  winBy: number;
  title: (t: number) => string;
  hint: (t: number) => string;
}[] = [
  {
    id: "first",
    winBy: 1,
    title: (t) => `First to ${t}`,
    hint: (t) => `Ends as soon as a team reaches ${t}`,
  },
  {
    id: "winby2",
    winBy: 2,
    title: () => "Win by 2",
    hint: (t) => `Reach ${t} and lead by 2`,
  },
];

export default function NewGameForm({
  players,
  strengths,
  initialA = [],
  initialB = [],
}: {
  players: { id: number; name: string; injured?: boolean }[];
  /** Player id -> strength (rating and win rate, from past games), for balancing. */
  strengths: Record<number, number>;
  initialA?: number[];
  initialB?: number[];
}) {
  const [assign, setAssign] = useState<Record<number, Assign | undefined>>(() => {
    const init: Record<number, Assign | undefined> = {};
    let count = 0;
    for (const id of initialA) init[id] = { team: "A", seq: ++count };
    for (const id of initialB) init[id] = { team: "B", seq: ++count };
    return init;
  });
  const seq = useRef(initialA.length + initialB.length);
  const [format, setFormat] = useState<GameFormat>("target");
  const [quarterMinutes, setQuarterMinutes] = useState(10);
  const [quarterCount, setQuarterCount] = useState(4);
  const [target, setTarget] = useState(20);
  const [mode, setMode] = useState<ModeId>("first");
  const winBy = MODES.find((m) => m.id === mode)!.winBy;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  type Arrangement =
    | { mode: "balanced"; gap: number }
    | {
        mode: "random";
        gap: number;
        avgA: number;
        avgB: number;
        commentary: string;
        matchupFlavor: RandomMatchupFlavor;
        rollCount: number;
      };

  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const rollCountRef = useRef(0);

  const teamOf = (t: "A" | "B") =>
    players
      .filter((p) => assign[p.id]?.team === t)
      .sort((a, b) => assign[a.id]!.seq - assign[b.id]!.seq);
  const a = teamOf("A");
  const b = teamOf("B");

  /** Everyone currently picked (on either team) is "playing"; split them into fair teams. */
  function balance() {
    const playing = players.filter((p) => assign[p.id]).map((p) => p.id);
    const split = balanceTeams(playing, (id) => strengths[id] ?? 0);
    if (!split) return;
    const next: Record<number, Assign | undefined> = {};
    // Strongest first, so the best players on each side are the starters.
    for (const id of split.A) next[id] = { team: "A", seq: ++seq.current };
    for (const id of split.B) next[id] = { team: "B", seq: ++seq.current };
    setAssign(next);
    setArrangement({ mode: "balanced", gap: split.gap });
  }

  /** Randomly arranges the selected players into Team A and Team B with randomized starters. */
  function randomize() {
    const playing = players.filter((p) => assign[p.id]).map((p) => p.id);
    const split = randomizeTeams(playing, (id) => strengths[id] ?? 0);
    if (!split) return;

    rollCountRef.current += 1;
    setIsRolling(true);
    playDiceRoll();
    setTimeout(() => setIsRolling(false), 450);

    const next: Record<number, Assign | undefined> = {};
    for (const id of split.A) next[id] = { team: "A", seq: ++seq.current };
    for (const id of split.B) next[id] = { team: "B", seq: ++seq.current };
    setAssign(next);
    setArrangement({
      mode: "random",
      gap: split.gap,
      avgA: split.avgA,
      avgB: split.avgB,
      commentary: split.commentary,
      matchupFlavor: split.matchupFlavor,
      rollCount: rollCountRef.current,
    });
  }

  function selectAll() {
    const next: Record<number, Assign | undefined> = {};
    let count = 0;
    for (const p of players) {
      if (!p.injured) {
        next[p.id] = { team: "A", seq: ++count };
      }
    }
    seq.current = count;
    setAssign(next);
    setArrangement(null);
  }

  function clearAll() {
    setAssign({});
    setArrangement(null);
  }

  function cycle(id: number) {
    setArrangement(null);
    setAssign((cur) => {
      const now = cur[id]?.team;
      const next = now === undefined ? "A" : now === "A" ? "B" : undefined;
      return {
        ...cur,
        [id]: next ? { team: next, seq: ++seq.current } : undefined,
      };
    });
  }

  function role(id: number): "Starter" | "Bench" | null {
    const t = assign[id]?.team;
    if (!t) return null;
    return teamOf(t).findIndex((p) => p.id === id) < STARTERS
      ? "Starter"
      : "Bench";
  }

  function start() {
    setError(null);
    const payload = (["A", "B"] as const).flatMap((t) =>
      teamOf(t).map((p, i) => ({ id: p.id, team: t, starter: i < STARTERS })),
    );
    startTransition(async () => {
      try {
        // On success the action redirects; it only returns when something is wrong.
        const res = await createGame({
          players: payload,
          target: format === "timed" ? 0 : target,
          winBy: format === "timed" ? 1 : winBy,
          gameType: format,
          quarterMinutes,
          quarterCount,
        });
        if (res && !res.ok) setError(res.error);
      } catch (e) {
        // A redirect is thrown as a control-flow error; let Next handle it.
        if (typeof e === "object" && e !== null && "digest" in e) throw e;
        setError(
          "Couldn't start the game. Check that each team has players and try again.",
        );
      }
    });
  }

  const ready = a.length > 0 && b.length > 0;

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-muted">
        Tap a player to cycle <b className="text-court-ink">Team A</b> →{" "}
        <b className="text-away-dark">Team B</b> → out. The first {STARTERS} on
        each team start; anyone after that begins on the bench. Or pick
        everyone playing and let us balance or randomize the squads.
      </p>

      {/* Balancing & Randomized Arrangement Controls */}
      <div className="glass-1 space-y-3 rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={balance}
            disabled={a.length + b.length < 2}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-95 disabled:opacity-40 ${
              arrangement?.mode === "balanced"
                ? "bg-sub text-white shadow-xs"
                : "bg-sub/10 text-sub ring-1 ring-sub/25 hover:bg-sub/20"
            }`}
          >
            ⚖ {arrangement?.mode === "balanced" ? "Re-Balance" : "Balance teams"}
          </button>

          <button
            type="button"
            onClick={randomize}
            disabled={a.length + b.length < 2}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5 ${
              arrangement?.mode === "random"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 hover:bg-amber-500/20"
            }`}
          >
            <span className={isRolling ? "animate-spin inline-block" : ""}>🎲</span>
            {arrangement?.mode === "random"
              ? `Roll Again (#${arrangement.rollCount})`
              : "Randomize"}
          </button>
        </div>

        {/* Arrangement Feedback & Fun Commentary */}
        <div className="text-xs">
          {arrangement?.mode === "balanced" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-sub/15 px-2 py-0.5 font-bold text-sub">
                {fairness(arrangement.gap)}
              </span>
              <span className="text-muted">
                Strength gap <b className="text-ink">{arrangement.gap.toFixed(2)}</b>. Starters assigned by rating. Re-balance for another fair split.
              </span>
            </div>
          )}

          {arrangement?.mode === "random" && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-bold text-amber-800">
                  🎲 {arrangement.matchupFlavor}
                </span>
                <span className="text-muted">
                  Rating gap: <b className="text-ink">{arrangement.gap.toFixed(2)} pts</b>
                  {arrangement.avgA !== arrangement.avgB && (
                    <span className="ml-1 text-[11px] font-semibold text-ink">
                      ({arrangement.avgA > arrangement.avgB ? "Team A favored" : "Team B favored"})
                    </span>
                  )}
                </span>
                <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  Starters drawn randomly
                </span>
              </div>
              <p className="font-semibold text-ink italic">
                &ldquo;{arrangement.commentary}&rdquo;
              </p>
            </div>
          )}

          {!arrangement && (
            <p className="font-semibold text-muted" role="status">
              {a.length + b.length < 2
                ? "Pick at least two players to balance or randomize teams."
                : `${a.length + b.length} players selected. Balance by rating or roll the dice for pure streetball chaos!`}
            </p>
          )}
        </div>
      </div>

      {/* Player Pool Header with Select All / Clear */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">
          Player Pool ({a.length + b.length} selected)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-semibold text-court-ink hover:underline"
          >
            Select all active
          </button>
          <span className="text-muted/40">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-muted hover:text-ink"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => {
          const t = assign[p.id]?.team;
          const r = role(p.id);
          return (
            <button
              key={p.id}
              onClick={() => cycle(p.id)}
              className={`flex min-h-14 items-center gap-2 rounded-2xl px-3 py-2.5 text-left font-semibold transition active:scale-[0.98] ${
                t === "A"
                  ? "glass-1 !border-court !bg-court/20 text-ink"
                  : t === "B"
                    ? "glass-1 !border-away !bg-away/20 text-ink"
                    : "glass-1"
              }`}
            >
              <Avatar id={p.id} name={p.name} size="sm" />
              <div className="min-w-0 flex-1 truncate">
                <span className="truncate">{shortName(p.name)}</span>
                {p.injured && <span className="ml-1 inline-block"><InjuredBadge size="sm" /></span>}
              </div>
              {t && (
                <span
                  className={`text-right text-[10px] font-bold uppercase leading-tight ${t === "A" ? "text-court-ink" : "text-away-dark"}`}
                >
                  {t}
                  <br />
                  {r}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="glass-1 space-y-4 rounded-2xl p-4">
        {/* Game Format Selector: Target Score vs Timed Game */}
        <div>
          <span className="label text-muted">Game format</span>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.05] p-1">
            <button
              type="button"
              onClick={() => setFormat("target")}
              className={`rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
                format === "target"
                  ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              🎯 Target Score
            </button>
            <button
              type="button"
              onClick={() => setFormat("timed")}
              className={`rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
                format === "timed"
                  ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                  : "text-muted hover:text-ink"
              }`}
            >
              ⏱️ Timed Quarters
            </button>
          </div>
        </div>

        {format === "target" ? (
          <>
            <label className="label block text-muted">
              Play to
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
              />
            </label>

            <fieldset>
              <legend className="label text-muted">Game mode</legend>
              <div
                role="radiogroup"
                className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.05] p-1"
              >
                {MODES.map((m) => {
                  const selected = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMode(m.id)}
                      className={`rounded-xl px-3 py-2.5 text-left transition ${
                        selected
                          ? "bg-white shadow-sm ring-1 ring-black/5"
                          : "text-muted"
                      }`}
                    >
                      <div className="text-sm font-bold">{m.title(target)}</div>
                      <div className="text-[11px] font-semibold leading-snug text-muted">
                        {m.hint(target)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="label text-muted">Quarter length</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {TIMED_PRESETS.map((p) => {
                  const selected =
                    quarterMinutes === p.minutes && quarterCount === p.quarters;
                  return (
                    <button
                      key={p.minutes}
                      type="button"
                      onClick={() => {
                        setQuarterMinutes(p.minutes);
                        setQuarterCount(p.quarters);
                      }}
                      className={`rounded-xl p-2.5 text-left transition ${
                        selected
                          ? "bg-court-ink text-white shadow-sm"
                          : "bg-white/60 text-ink ring-1 ring-black/5 hover:bg-white"
                      }`}
                    >
                      <div className="text-sm font-bold">{p.title}</div>
                      <div
                        className={`text-[11px] font-semibold leading-snug ${
                          selected ? "text-white/80" : "text-muted"
                        }`}
                      >
                        {p.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="label block text-muted">
                Minutes per Quarter
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={quarterMinutes}
                  onChange={(e) =>
                    setQuarterMinutes(
                      Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                    )
                  }
                  className="mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
                />
              </label>

              <label className="label block text-muted">
                Number of Quarters
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={8}
                  value={quarterCount}
                  onChange={(e) =>
                    setQuarterCount(
                      Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                    )
                  }
                  className="mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
                />
              </label>
            </div>

            <div className="rounded-xl bg-court-soft/20 p-3 text-xs text-muted">
              <div className="font-bold text-court-ink">
                🏀 {quarterCount} Quarters × {quarterMinutes} Minutes ={" "}
                {quarterCount * quarterMinutes} Minutes total play
              </div>
              <div className="mt-1 leading-relaxed">
                Includes quarter countdowns, official buzzer at 0:00, buzzer-beater detection, team timeouts, and 24s shot clock assistant.
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
          {error}
        </p>
      )}

      <button
        onClick={start}
        disabled={!ready || pending}
        className="h-14 w-full rounded-full bg-ink text-base font-semibold text-paper shadow-md transition active:scale-[0.99] disabled:opacity-40"
      >
        {pending ? "Starting…" : `Tip off · ${a.length} vs ${b.length}`}
      </button>
    </div>
  );
}

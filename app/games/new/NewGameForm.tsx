"use client";

import { useRef, useState, useTransition } from "react";
import { createGame } from "@/lib/actions";
import { Avatar, shortName } from "@/app/components/Avatar";

type Assign = { team: "A" | "B"; seq: number };

/** Players on court per side. The first 3 picked for each team start; the rest are bench. */
const STARTERS = 3;

export default function NewGameForm({ players }: { players: { id: number; name: string }[] }) {
  const [assign, setAssign] = useState<Record<number, Assign | undefined>>({});
  const seq = useRef(0);
  const [target, setTarget] = useState(20);
  const [winBy, setWinBy] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const teamOf = (t: "A" | "B") =>
    players
      .filter((p) => assign[p.id]?.team === t)
      .sort((a, b) => assign[a.id]!.seq - assign[b.id]!.seq);
  const a = teamOf("A");
  const b = teamOf("B");

  function cycle(id: number) {
    setAssign((cur) => {
      const now = cur[id]?.team;
      const next = now === undefined ? "A" : now === "A" ? "B" : undefined;
      return { ...cur, [id]: next ? { team: next, seq: ++seq.current } : undefined };
    });
  }

  function role(id: number): "Starter" | "Bench" | null {
    const t = assign[id]?.team;
    if (!t) return null;
    return teamOf(t).findIndex((p) => p.id === id) < STARTERS ? "Starter" : "Bench";
  }

  function start() {
    setError(null);
    const payload = (["A", "B"] as const).flatMap((t) =>
      teamOf(t).map((p, i) => ({ id: p.id, team: t, starter: i < STARTERS })),
    );
    startTransition(async () => {
      try {
        await createGame({ players: payload, target, winBy });
      } catch {
        // On success the action redirects, so reaching here means it failed.
        setError("Couldn't start the game. Check that each team has players and try again.");
      }
    });
  }

  const ready = a.length > 0 && b.length > 0;

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-muted">
        Tap a player to cycle <b className="text-court-ink">Team A</b> → <b className="text-away-dark">Team B</b> → out.
        The first {STARTERS} on each team start; anyone after that begins on the bench.
      </p>
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
              <span className="min-w-0 flex-1 truncate">{shortName(p.name)}</span>
              {t && (
                <span className={`text-right text-[10px] font-bold uppercase leading-tight ${t === "A" ? "text-court-ink" : "text-away-dark"}`}>
                  {t}
                  <br />
                  {r}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="glass-1 grid grid-cols-2 gap-3 rounded-2xl p-4">
        <label className="label text-muted">
          Play to
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
          />
        </label>
        <label className="label text-muted">
          Win by
          <select
            value={winBy}
            onChange={(e) => setWinBy(Number(e.target.value))}
            className="mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>

      {error && <p className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">{error}</p>}

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

"use client";

import { useRef, useState, useTransition } from "react";
import { createGame } from "@/lib/actions";
import { Avatar } from "@/app/components/Avatar";

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
      <p className="text-sm text-stone-500">
        Tap a player to cycle <b className="text-court">Team A</b> → <b className="text-away">Team B</b> → out.
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
              className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left font-bold ring-1 transition active:scale-[0.98] ${
                t === "A"
                  ? "bg-court text-white ring-court"
                  : t === "B"
                    ? "bg-away text-white ring-away"
                    : "bg-white text-stone-700 ring-stone-200"
              }`}
            >
              <Avatar id={p.id} name={p.name} size="sm" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {t && (
                <span className="text-right text-[10px] font-bold uppercase leading-tight opacity-90">
                  {t}
                  <br />
                  {r}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <label className="text-sm font-bold">
          Play to
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-base"
          />
        </label>
        <label className="text-sm font-bold">
          Win by
          <select
            value={winBy}
            onChange={(e) => setWinBy(Number(e.target.value))}
            className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-base"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>

      {error && <p className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}

      <button
        onClick={start}
        disabled={!ready || pending}
        className="w-full rounded-full bg-court py-4 text-base font-black text-white shadow-md active:bg-court-dark disabled:opacity-40"
      >
        {pending ? "Starting…" : `Tip off · ${a.length} vs ${b.length}`}
      </button>
    </div>
  );
}

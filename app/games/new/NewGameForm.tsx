"use client";

import { useRef, useState, useTransition } from "react";
import { createGame } from "@/lib/actions";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import { balanceTeams, fairness } from "@/lib/balance";

type Assign = { team: "A" | "B"; seq: number };

/** Players on court per side. The first 3 picked for each team start; the rest are bench. */
const STARTERS = 3;

type ModeId = "first" | "winby2";

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
  const [target, setTarget] = useState(20);
  const [mode, setMode] = useState<ModeId>("first");
  const winBy = MODES.find((m) => m.id === mode)!.winBy;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [balanced, setBalanced] = useState<{ gap: number } | null>(null);

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
    setBalanced({ gap: split.gap });
  }

  function cycle(id: number) {
    setBalanced(null);
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
        const res = await createGame({ players: payload, target, winBy });
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
        each team start; anyone after that begins on the bench. Or tap everyone
        who&apos;s playing and let us balance the teams.
      </p>

      <div className="glass-1 flex items-center gap-3 rounded-2xl p-3">
        <button
          type="button"
          onClick={balance}
          disabled={a.length + b.length < 2}
          className="h-11 shrink-0 rounded-full bg-sub/10 px-4 text-sm font-semibold text-sub ring-1 ring-sub/25 active:scale-95 disabled:opacity-40"
        >
          ⚖ {balanced ? "Shuffle" : "Balance teams"}
        </button>
        <p
          className="min-w-0 flex-1 text-xs font-semibold text-muted"
          role="status"
        >
          {balanced ? (
            <>
              <span className="text-ink">{fairness(balanced.gap)}</span> ·
              strength gap {balanced.gap.toFixed(2)}. Shuffle for another fair
              split.
            </>
          ) : a.length + b.length < 2 ? (
            "Pick at least two players first."
          ) : (
            `Splits the ${a.length + b.length} picked players using ratings and win rates.`
          )}
        </p>
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

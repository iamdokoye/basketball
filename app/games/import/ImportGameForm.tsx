"use client";

import { useState, useTransition } from "react";
import { importGame } from "@/lib/actions";
import { PlayerStatCard, ScoreBar } from "@/app/components/StatEditor";
import { emptyTotals, pointsOf, type Totals } from "@/lib/import";

type Row = { id: number; team: "A" | "B"; totals: Totals };

const inputCls =
  "mt-1 block h-12 w-full rounded-xl border border-white/80 bg-white/60 px-3 text-base font-semibold normal-case tracking-normal text-ink shadow-inner outline-none focus:ring-2 focus:ring-court";

export default function ImportGameForm({
  players,
  defaultDate,
}: {
  players: { id: number; name: string }[];
  defaultDate: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("08:00");
  const [minutes, setMinutes] = useState(25);
  const [target, setTarget] = useState(20);
  const [winBy, setWinBy] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "";
  const free = players.filter((p) => !rows.some((r) => r.id === p.id));
  const score = { A: 0, B: 0 };
  for (const r of rows) score[r.team] += pointsOf(r.totals);
  const ready =
    rows.some((r) => r.team === "A") &&
    rows.some((r) => r.team === "B") &&
    score.A !== score.B;

  const update = (id: number, totals: Totals) =>
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, totals } : r)));

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        // On success the action redirects to the new game; it only returns when something is wrong.
        const res = await importGame({
          date,
          time,
          minutes,
          target,
          winBy,
          players: rows.map((r) => ({ ...r })),
        });
        if (res && !res.ok) setError(res.error);
      } catch (e) {
        // A redirect is thrown as a control-flow error; let Next handle it.
        if (typeof e === "object" && e !== null && "digest" in e) throw e;
        setError("Couldn't save the game. Try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-muted">
        For a game that was tracked somewhere else. Type each player&apos;s
        totals and we build the game from them: every number comes out exactly,
        but the order and timing of plays are made up, and everyone counts as
        on court the whole game.
      </p>

      <div className="glass-1 grid grid-cols-2 gap-3 rounded-2xl p-4">
        <label className="label block text-muted">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="label block text-muted">
          Start time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="label block text-muted">
          Length (minutes)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={minutes}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="label block text-muted">
          Played to
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={target}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setTarget(Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="label col-span-2 block text-muted">
          Win by
          <select
            value={winBy}
            onChange={(e) => setWinBy(Number(e.target.value))}
            className={inputCls}
          >
            <option value={1}>1 (first to {target})</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>

      <ScoreBar a={score.A} b={score.B} />

      {(["A", "B"] as const).map((team) => {
        const teamRows = rows.filter((r) => r.team === team);
        return (
          <section key={team} className="space-y-2">
            <h2
              className={`label px-1 ${team === "A" ? "text-court-ink" : "text-away-dark"}`}
            >
              Team {team}
            </h2>
            {teamRows.length > 0 && (
              <ul className="space-y-2">
                {teamRows.map((r) => (
                  <PlayerStatCard
                    key={r.id}
                    name={nameOf(r.id)}
                    team={team}
                    totals={r.totals}
                    onChange={(t) => update(r.id, t)}
                    onRemove={() =>
                      setRows((cur) => cur.filter((x) => x.id !== r.id))
                    }
                  />
                ))}
              </ul>
            )}
            <select
              aria-label={`Add a player to Team ${team}`}
              value=""
              disabled={free.length === 0 || rows.length >= 12}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id)
                  setRows((cur) => [
                    ...cur,
                    { id, team, totals: emptyTotals() },
                  ]);
              }}
              className="glass-1 h-12 w-full rounded-2xl px-3 text-sm font-semibold text-muted disabled:opacity-40"
            >
              <option value="">+ Add a player to Team {team}</option>
              {free.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </section>
        );
      })}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss"
        >
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={!ready || pending}
        className="h-14 w-full rounded-full bg-ink text-base font-semibold text-paper shadow-md transition active:scale-[0.99] disabled:opacity-40"
      >
        {pending
          ? "Saving…"
          : `Save game · ${score.A} – ${score.B}`}
      </button>
    </div>
  );
}

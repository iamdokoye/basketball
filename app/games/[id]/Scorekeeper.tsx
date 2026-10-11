"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishGame, recordGroup, undoGroup } from "@/lib/actions";
import {
  boxScore,
  describeGroup,
  gameResult,
  onCourt,
  teamScores,
  type EventType,
  type GameEvent,
  type RosterEntry,
  type Team,
} from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";

type Ev = { playerId: number; type: EventType };

type Option = { label: string; hint?: string; tone?: "good" | "bad" | "neutral" | "sub"; onPick: () => void };
type Section = { heading?: string; cols: 1 | 2 | 3; options: Option[] };
type Sheet = { title: string; subtitle?: string; player?: RosterEntry; sections: Section[] };

const TONES = {
  good: "bg-emerald-600 text-white active:bg-emerald-700",
  bad: "bg-rose-50 text-rose-800 ring-1 ring-rose-200 active:bg-rose-100",
  neutral: "bg-stone-100 text-stone-900 active:bg-stone-200",
  sub: "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200 active:bg-indigo-100",
};

/** Timestamp for a new event; only ever called from tap handlers. */
const eventTime = () => Date.now();

const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const TEAM_STYLE = {
  A: { bar: "bg-court", text: "text-court", ring: "active:ring-court", label: "Team A" },
  B: { bar: "bg-away", text: "text-away", ring: "active:ring-away", label: "Team B" },
} as const;

export default function Scorekeeper({
  gameId,
  roster,
  initialEvents,
  startMs,
  target,
  winBy,
}: {
  gameId: number;
  roster: RosterEntry[];
  initialEvents: GameEvent[];
  startMs: number;
  target: number;
  winBy: number;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<GameEvent[]>(initialEvents);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [, startTransition] = useTransition();

  const lines = useMemo(() => boxScore(roster, events, startMs), [roster, events, startMs]);
  const court = useMemo(() => onCourt(roster, events), [roster, events]);
  const score = teamScores(lines);
  const result = gameResult(score, { target, winBy });
  const nameOf = (id: number) => roster.find((p) => p.id === id)?.name ?? "?";

  const active = (t: Team) => roster.filter((p) => p.team === t && court.has(p.id));
  const bench = (t: Team) => roster.filter((p) => p.team === t && !court.has(p.id));
  const opponents = (p: RosterEntry) => active(p.team === "A" ? "B" : "A");
  const mates = (p: RosterEntry) => active(p.team).filter((m) => m.id !== p.id);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, GameEvent[]>();
    for (const e of events) {
      if (!map.has(e.grp)) {
        map.set(e.grp, []);
        order.push(e.grp);
      }
      map.get(e.grp)!.push(e);
    }
    return order.map((grp) => ({ grp, events: map.get(grp)! }));
  }, [events]);

  function commit(evs: Ev[]) {
    const grp = crypto.randomUUID();
    const at = eventTime();
    navigator.vibrate?.(12);
    setSheet(null);
    setError(null);
    setEvents((cur) => [...cur, ...evs.map((e) => ({ ...e, grp, at }))]);
    startTransition(async () => {
      try {
        await recordGroup(gameId, grp, at, evs);
      } catch {
        setEvents((cur) => cur.filter((e) => e.grp !== grp));
        setError("Couldn't save that play. Check your connection and try again.");
      }
    });
  }

  function removeGroup(grp: string) {
    const removed = events.filter((e) => e.grp === grp);
    setEvents((cur) => cur.filter((e) => e.grp !== grp));
    startTransition(async () => {
      try {
        await undoGroup(gameId, grp);
      } catch {
        setEvents((cur) => [...cur, ...removed].sort((a, b) => a.at - b.at));
        setError("Couldn't undo. Check your connection and try again.");
      }
    });
  }

  // ---- Flows ---------------------------------------------------------------

  function reboundStep(shooter: RosterEntry, miss: Ev[]) {
    setSheet({
      title: "Who got the rebound?",
      sections: [
        {
          heading: "Offensive rebound",
          cols: 3,
          options: active(shooter.team).map((p) => ({
            label: p.name,
            onPick: () => commit([...miss, { playerId: p.id, type: "OREB" }]),
          })),
        },
        {
          heading: "Defensive rebound",
          cols: 3,
          options: opponents(shooter).map((p) => ({
            label: p.name,
            onPick: () => commit([...miss, { playerId: p.id, type: "DREB" }]),
          })),
        },
        { cols: 1, options: [{ label: "No rebound / out of bounds", onPick: () => commit(miss) }] },
      ],
    });
  }

  function makeStep(p: RosterEntry, shot: 2 | 3) {
    const make: Ev = { playerId: p.id, type: shot === 3 ? "MAKE3" : "MAKE2" };
    setSheet({
      title: `${p.name} hit a ${shot}`,
      subtitle: "Who assisted?",
      player: p,
      sections: [
        {
          cols: 2,
          options: [
            ...mates(p).map((m) => ({
              label: m.name,
              onPick: () => commit([make, { playerId: m.id, type: "AST" as const }]),
            })),
            { label: "Unassisted", tone: "neutral" as const, onPick: () => commit([make]) },
          ],
        },
      ],
    });
  }

  function missStep(p: RosterEntry, shot: 2 | 3, extra: Ev[] = []) {
    reboundStep(p, [{ playerId: p.id, type: shot === 3 ? "MISS3" : "MISS2" }, ...extra]);
  }

  function stealStep(p: RosterEntry) {
    const steal: Ev = { playerId: p.id, type: "STL" };
    setSheet({
      title: `${p.name} steal`,
      subtitle: "Whose ball was it?",
      player: p,
      sections: [
        {
          cols: 2,
          options: [
            ...opponents(p).map((o) => ({
              label: o.name,
              onPick: () => commit([steal, { playerId: o.id, type: "TOV" as const }]),
            })),
            { label: "Skip", tone: "neutral" as const, onPick: () => commit([steal]) },
          ],
        },
      ],
    });
  }

  function blockStep(p: RosterEntry) {
    const block: Ev = { playerId: p.id, type: "BLK" };
    setSheet({
      title: `${p.name} block`,
      subtitle: "Whose shot was it?",
      player: p,
      sections: [
        {
          cols: 2,
          options: opponents(p).map((shooter) => ({
            label: shooter.name,
            onPick: () =>
              setSheet({
                title: `${shooter.name}'s blocked shot`,
                subtitle: "Was it a 2 or a 3?",
                player: shooter,
                sections: [
                  {
                    cols: 2,
                    options: [
                      { label: "2-pointer", onPick: () => missStep(shooter, 2, [block]) },
                      { label: "3-pointer", onPick: () => missStep(shooter, 3, [block]) },
                    ],
                  },
                ],
              }),
          })),
        },
      ],
    });
  }

  function subOutStep(p: RosterEntry) {
    setSheet({
      title: `Sub out ${p.name}`,
      subtitle: "Who's coming in?",
      player: p,
      sections: [
        {
          cols: 2,
          options: bench(p.team).map((b) => ({
            label: b.name,
            tone: "sub" as const,
            onPick: () =>
              commit([
                { playerId: p.id, type: "SUB_OUT" },
                { playerId: b.id, type: "SUB_IN" },
              ]),
          })),
        },
      ],
    });
  }

  function subInStep(b: RosterEntry) {
    setSheet({
      title: `${b.name} checks in`,
      subtitle: "Who's coming out?",
      player: b,
      sections: [
        {
          cols: 2,
          options: active(b.team).map((p) => ({
            label: p.name,
            tone: "sub" as const,
            onPick: () =>
              commit([
                { playerId: p.id, type: "SUB_OUT" },
                { playerId: b.id, type: "SUB_IN" },
              ]),
          })),
        },
      ],
    });
  }

  function playerSheet(p: RosterEntry) {
    const solo = (type: EventType): (() => void) => () => commit([{ playerId: p.id, type }]);
    const l = lines.find((x) => x.playerId === p.id)!;
    setSheet({
      title: p.name,
      subtitle: `${l.pts} pts · ${l.reb} reb · ${l.ast} ast · ${l.pf} pf`,
      player: p,
      sections: [
        {
          heading: "Shooting",
          cols: 2,
          options: [
            { label: "Made 2", hint: "+2", tone: "good", onPick: () => makeStep(p, 2) },
            { label: "Made 3", hint: "+3", tone: "good", onPick: () => makeStep(p, 3) },
            { label: "Missed 2", tone: "bad", onPick: () => missStep(p, 2) },
            { label: "Missed 3", tone: "bad", onPick: () => missStep(p, 3) },
          ],
        },
        {
          heading: "Free throws",
          cols: 2,
          options: [
            { label: "FT made", hint: "+1", tone: "good", onPick: solo("MAKE_FT") },
            { label: "FT missed", tone: "bad", onPick: solo("MISS_FT") },
          ],
        },
        {
          heading: "Defense",
          cols: 3,
          options: [
            { label: "Steal", onPick: () => stealStep(p) },
            { label: "Block", onPick: () => blockStep(p) },
            { label: "Deflection", onPick: solo("DEFL") },
          ],
        },
        {
          heading: "Other",
          cols: 3,
          options: [
            { label: "Off. reb", onPick: solo("OREB") },
            { label: "Def. reb", onPick: solo("DREB") },
            { label: "Assist", onPick: solo("AST") },
            { label: "Turnover", tone: "bad", onPick: solo("TOV") },
            { label: "Foul", tone: "bad", onPick: solo("FOUL") },
          ],
        },
        ...(bench(p.team).length > 0
          ? [
              {
                heading: "Substitution",
                cols: 1 as const,
                options: [{ label: "Sub out…", tone: "sub" as const, onPick: () => subOutStep(p) }],
              },
            ]
          : []),
      ],
    });
  }

  function finish() {
    startTransition(async () => {
      await finishGame(gameId);
      router.refresh();
    });
  }

  const last = groups[groups.length - 1];

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-paper/95 px-4 pb-2 pt-1 backdrop-blur">
        <div className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            {(["A", "B"] as const).map((t) => (
              <div
                key={t}
                className={`relative px-4 py-3 ${t === "B" ? "order-3 text-right" : "order-1"}`}
              >
                <span className={`absolute inset-y-0 ${t === "A" ? "left-0" : "right-0"} w-1.5 ${TEAM_STYLE[t].bar}`} />
                <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
                  {TEAM_STYLE[t].label}
                </div>
                <div key={score[t]} className="pop tabular text-6xl font-black leading-none">
                  {score[t]}
                </div>
              </div>
            ))}
            <div className="order-2 flex flex-col items-center justify-center px-1 text-[11px] font-semibold text-stone-400">
              <span>to {target}</span>
              {winBy > 1 && <span>win by {winBy}</span>}
            </div>
          </div>
        </div>
      </div>

      {result.over && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-600 p-4 text-white">
          <div>
            <div className="font-black">Team {result.winner} wins!</div>
            <div className="text-sm text-emerald-100">Check the log, then lock it in.</div>
          </div>
          <button
            onClick={finish}
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-700 active:bg-emerald-50"
          >
            Finish game
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-rose-100 p-3 text-sm font-medium text-rose-900">
          {error}
        </div>
      )}

      {/* On-court cards + bench */}
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className="space-y-2">
            {active(t).map((p) => {
              const l = lines.find((x) => x.playerId === p.id)!;
              return (
                <button
                  key={p.id}
                  onClick={() => playerSheet(p)}
                  className={`w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-stone-200 active:ring-2 ${TEAM_STYLE[t].ring}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar id={p.id} name={p.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                    <span key={l.pts} className="pop tabular text-2xl font-black">
                      {l.pts}
                    </span>
                  </div>
                  <div className="tabular mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-medium text-stone-500">
                    <span>
                      FG {l.fgm}/{l.fga}
                    </span>
                    {l.fta > 0 && (
                      <span>
                        FT {l.ftm}/{l.fta}
                      </span>
                    )}
                    <span>{l.reb} reb</span>
                    <span>{l.ast} ast</span>
                    <span>{l.stl} stl</span>
                    <span>{l.blk} blk</span>
                    {l.tov > 0 && <span>{l.tov} to</span>}
                    {l.pf > 0 && (
                      <span className={l.pf >= 4 ? "font-bold text-rose-600" : ""}>{l.pf} pf</span>
                    )}
                  </div>
                </button>
              );
            })}
            {bench(t).length > 0 && (
              <div className="rounded-2xl bg-stone-200/60 p-2">
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Bench · tap to sub in
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bench(t).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => subInStep(b)}
                      className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold ring-1 ring-stone-300 active:bg-indigo-50"
                    >
                      <Avatar id={b.id} name={b.name} size="sm" />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Play log */}
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setShowLog((s) => !s)} className="text-sm font-bold text-stone-600">
            Play log ({groups.length}) {showLog ? "▲" : "▼"}
          </button>
          <button
            disabled={!last}
            onClick={() => last && removeGroup(last.grp)}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-white disabled:opacity-30"
          >
            ↶ Undo last
          </button>
        </div>
        {!showLog && last && (
          <p className="mt-2 text-sm text-stone-500">Last: {describeGroup(last.events, nameOf)}</p>
        )}
        {showLog && (
          <ol className="mt-2 divide-y divide-stone-100">
            {[...groups].reverse().map((g) => (
              <li key={g.grp} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{describeGroup(g.events, nameOf)}</span>
                <button
                  onClick={() => removeGroup(g.grp)}
                  aria-label="Delete this play"
                  className="shrink-0 rounded-full px-2 py-1 text-rose-700 active:bg-rose-100"
                >
                  ✕
                </button>
              </li>
            ))}
            {groups.length === 0 && <li className="py-2 text-sm text-stone-400">No plays yet.</li>}
          </ol>
        )}
      </div>

      {!result.over && (
        <button
          onClick={() => {
            if (confirm("End the game now? Use this if you stopped before the target score.")) finish();
          }}
          className="w-full rounded-xl py-2 text-sm font-semibold text-stone-500 active:bg-stone-200"
        >
          End game early
        </button>
      )}

      {/* Action sheet */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-label={sheet.title}
            onClick={(e) => e.stopPropagation()}
            className="sheet-up mx-auto max-h-[88vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              {sheet.player && <Avatar id={sheet.player.id} name={sheet.player.name} />}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black leading-tight">{sheet.title}</h2>
                {sheet.subtitle && <p className="text-sm font-medium text-stone-500">{sheet.subtitle}</p>}
              </div>
              <button
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="rounded-full px-3 py-1 text-stone-500 active:bg-stone-100"
              >
                ✕
              </button>
            </div>
            {sheet.sections.map((s, i) => (
              <div key={i}>
                {s.heading && (
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400">
                    {s.heading}
                  </div>
                )}
                <div className={`grid gap-2 ${COLS[s.cols]}`}>
                  {s.options.map((o) => (
                    <button
                      key={o.label}
                      onClick={o.onPick}
                      className={`min-h-14 rounded-xl px-3 py-3 text-base font-bold ${TONES[o.tone ?? "neutral"]}`}
                    >
                      {o.label}
                      {o.hint && <span className="ml-1 text-sm font-semibold opacity-80">{o.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

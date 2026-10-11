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
import { Avatar, shortName } from "@/app/components/Avatar";

type Ev = { playerId: number; type: EventType };

type Option = { label: string; hint?: string; tone?: "good" | "bad" | "neutral" | "sub"; onPick: () => void };
type Section = { heading?: string; cols: 1 | 2 | 3; options: Option[] };
type Sheet = { title: string; subtitle?: string; player?: RosterEntry; sections: Section[] };

const TONES = {
  good: "bg-win/15 text-emerald-800 ring-1 ring-win/30 active:bg-win/25",
  bad: "bg-white/60 text-loss ring-1 ring-black/5 active:bg-loss/10",
  neutral: "bg-white/60 text-ink ring-1 ring-black/5 active:bg-white",
  sub: "bg-sub/10 text-sub ring-1 ring-sub/25 active:bg-sub/20",
};

/** Timestamp for a new event; only ever called from tap handlers. */
const eventTime = () => Date.now();

const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const TEAM_STYLE = {
  A: { bar: "bg-court-soft", text: "text-court-ink", ring: "active:ring-court", label: "Team A" },
  B: { bar: "bg-away-soft", text: "text-away-dark", ring: "active:ring-away", label: "Team B" },
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
      <div className="sticky top-[72px] z-10 -mx-4 px-4 pb-2 pt-1">
        <div className="glass-3 overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            {(["A", "B"] as const).map((t) => (
              <div
                key={t}
                className={`relative px-4 py-3 ${t === "B" ? "order-3 text-right" : "order-1"}`}
              >
                <span className={`absolute inset-y-0 ${t === "A" ? "left-0" : "right-0"} w-1 ${TEAM_STYLE[t].bar}`} />
                <div className="label text-muted">
                  {TEAM_STYLE[t].label}
                </div>
                <div key={score[t]} className="pop tabular text-[64px] font-extrabold leading-none tracking-tighter">
                  {score[t]}
                </div>
              </div>
            ))}
            <div className="order-2 flex flex-col items-center justify-center px-1 text-[11px] font-semibold text-muted">
              <span>to {target}</span>
              {winBy > 1 && <span>win by {winBy}</span>}
            </div>
          </div>
        </div>
      </div>

      {result.over && (
        <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl !bg-win/15 p-4">
          <div>
            <div className="font-extrabold text-emerald-900">Team {result.winner} wins!</div>
            <div className="text-sm text-muted">Check the log, then lock it in.</div>
          </div>
          <button
            onClick={finish}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper active:scale-95"
          >
            Finish game
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
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
                  className={`glass-1 w-full rounded-2xl p-3 text-left transition-transform active:scale-[0.98] active:ring-2 ${TEAM_STYLE[t].ring}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar id={p.id} name={p.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-bold">{shortName(p.name)}</span>
                    <span key={l.pts} className="pop tabular text-2xl font-extrabold tracking-tight">
                      {l.pts}
                    </span>
                  </div>
                  <div className="tabular mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-muted">
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
                      <span className={l.pf >= 4 ? "font-bold text-loss" : ""}>{l.pf} pf</span>
                    )}
                  </div>
                </button>
              );
            })}
            {bench(t).length > 0 && (
              <div className="rounded-2xl bg-black/[0.04] p-2">
                <div className="label mb-1 px-1 text-[10px] text-muted">
                  Bench · tap to sub in
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bench(t).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => subInStep(b)}
                      className="flex items-center gap-1.5 rounded-full bg-white/70 py-1 pl-1 pr-3 text-sm font-semibold ring-1 ring-black/5 active:bg-sub/10"
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
      <div className="glass-1 rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setShowLog((s) => !s)} className="text-sm font-semibold text-muted">
            Play log ({groups.length}) {showLog ? "▲" : "▼"}
          </button>
          <button
            disabled={!last}
            onClick={() => last && removeGroup(last.grp)}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-30"
          >
            ↶ Undo last
          </button>
        </div>
        {!showLog && last && (
          <p className="mt-2 text-sm text-muted">Last: {describeGroup(last.events, nameOf)}</p>
        )}
        {showLog && (
          <ol className="mt-2 divide-y divide-black/[0.06]">
            {[...groups].reverse().map((g) => (
              <li key={g.grp} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{describeGroup(g.events, nameOf)}</span>
                <button
                  onClick={() => removeGroup(g.grp)}
                  aria-label="Delete this play"
                  className="shrink-0 rounded-full px-2 py-1 text-loss active:bg-loss/10"
                >
                  ✕
                </button>
              </li>
            ))}
            {groups.length === 0 && <li className="py-2 text-sm text-muted">No plays yet.</li>}
          </ol>
        )}
      </div>

      {!result.over && (
        <button
          onClick={() => {
            if (confirm("End the game now? Use this if you stopped before the target score.")) finish();
          }}
          className="w-full rounded-xl py-2 text-sm font-semibold text-muted active:bg-black/5"
        >
          End game early
        </button>
      )}

      {/* Action sheet */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/25 backdrop-blur-sm" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-label={sheet.title}
            onClick={(e) => e.stopPropagation()}
            className="glass-3 sheet-up mx-auto max-h-[88vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-[28px] p-4 pb-8"
          >
            <div className="flex items-center gap-3">
              {sheet.player && <Avatar id={sheet.player.id} name={sheet.player.name} />}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-extrabold leading-tight tracking-tight">{sheet.title}</h2>
                {sheet.subtitle && <p className="text-sm font-semibold text-muted">{sheet.subtitle}</p>}
              </div>
              <button
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="rounded-full px-3 py-1 text-muted active:bg-black/5"
              >
                ✕
              </button>
            </div>
            {sheet.sections.map((s, i) => (
              <div key={i}>
                {s.heading && (
                  <div className="label mb-1.5 text-muted">
                    {s.heading}
                  </div>
                )}
                <div className={`grid gap-2 ${COLS[s.cols]}`}>
                  {s.options.map((o) => (
                    <button
                      key={o.label}
                      onClick={o.onPick}
                      className={`min-h-14 rounded-xl px-3 py-3 text-base font-semibold transition-transform active:scale-[0.98] ${TONES[o.tone ?? "neutral"]}`}
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

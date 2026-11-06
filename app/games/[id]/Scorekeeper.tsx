"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addLatePlayer, finishGame } from "@/lib/actions";
import { useGameSync } from "./useGameSync";
import {
  buildClock,
  elapsedNow,
  FIBA,
  formatClock,
  formatCountdown,
  getQuarterInfo,
  isBuzzerBeater,
  timeoutRemaining,
  timeoutStatus,
} from "@/lib/clock";
import {
  boxScore,
  describeGroup,
  gameResult,
  onCourt,
  teamScores,
  type EventType,
  type GameEvent,
  type RosterEntry,
  type ShotZoneId,
  type Team,
} from "@/lib/stats";
import { Avatar, shortName } from "@/app/components/Avatar";
import { PlayerPicker } from "@/app/components/PlayerPicker";
import { Countdown } from "@/app/components/Countdown";
import { VoiceEntry } from "./VoiceEntry";
import { ActionPad, type PadAction } from "./ActionPad";
import { FollowUp, SavedToast, type ChipGroup } from "./FollowUp";
import { useScoreMode } from "./scoreMode";
import { SCORE_MODES, type ScoreMode } from "./scoreModeShared";
import { CourtAudioControls } from "@/app/components/CourtAudio";
import { LiveMomentumMeter } from "@/app/components/LiveMomentumMeter";
import { LiveWinProbability } from "@/app/components/LiveWinProbability";
import { MiniCourtShotPad } from "@/app/components/MiniCourtShotPad";
import {
  playBuzzer,
  playCheer,
  playClang,
  playOnFireSound,
  playSwish,
  playWhistle,
} from "@/lib/courtAudio";
import { detectOnFirePlayers } from "@/lib/momentum";
import { buildPossession, readShotClock, type Possession } from "@/lib/possession";

type Ev = {
  playerId: number;
  type: EventType;
  team?: Team;
  /** Only on a ZONE event: where the shot was taken from. */
  zone?: ShotZoneId;
};

type Option = {
  label: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral" | "sub";
  onPick: () => void;
};
type Section = {
  heading?: string;
  /** Shown instead of the options when none can be picked (e.g. a team out of timeouts). */
  note?: string;
  cols: 1 | 2 | 3;
  options: Option[];
};
type Sheet = {
  title: string;
  subtitle?: string;
  player?: RosterEntry;
  sections: Section[];
};

/** A play that was just saved and can still take one more detail (who assisted, who rebounded...). */
type FollowState = {
  grp: string;
  kind: "assist" | "rebound" | "stealFrom" | "blockShot";
  /** The player the follow-up is about: the scorer, the shooter who missed, the stealer or the blocker. */
  playerId: number;
};

const TONES = {
  good: "bg-win/15 text-emerald-800 ring-1 ring-win/30 active:bg-win/25",
  bad: "bg-white/60 text-loss ring-1 ring-black/5 active:bg-loss/10",
  neutral: "bg-white/60 text-ink ring-1 ring-black/5 active:bg-white",
  sub: "bg-sub/10 text-sub ring-1 ring-sub/25 active:bg-sub/20",
};

/** Players per side on the court in this league's 3v3. A team with fewer can take a late arrival without anyone coming out. */
const ON_COURT = 3;

const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const TEAM_STYLE = {
  A: {
    bar: "bg-court-soft",
    text: "text-court-ink",
    ring: "active:ring-court",
    label: "Team A",
  },
  B: {
    bar: "bg-away-soft",
    text: "text-away-dark",
    ring: "active:ring-away",
    label: "Team B",
  },
} as const;

/** One line under the shot clock saying who has the ball (or why nobody does). */
function possessionLabel(team: Team | null, phase: Possession["phase"], clockCutOff: boolean): string {
  if (team) return `${TEAM_STYLE[team].label} ball${clockCutOff ? " · clock off" : ""}`;
  if (phase === "loose") return "Loose ball · awaiting rebound";
  if (phase === "freeThrows") return "Free throws";
  return "Tap who has the ball";
}

export default function Scorekeeper({
  gameId,
  roster: initialRoster,
  players: leaguePlayers = [],
  initialEvents,
  startMs,
  target,
  winBy,
  gameType = "target",
  quarterMinutes = 10,
  quarterCount = 4,
  readOnly = false,
  spectating = false,
  windowLabel = "",
  opensAt = null,
  serverNow = 0,
  initialMode = "quick",
}: {
  gameId: number;
  /** Everyone in the game when the page loaded. Late arrivals are added on top (see useGameSync). */
  roster: RosterEntry[];
  /** Every active player in the league, for adding someone who arrives late. */
  players?: { id: number; name: string }[];
  initialEvents: GameEvent[];
  startMs: number;
  target: number;
  winBy: number;
  gameType?: "target" | "timed";
  quarterMinutes?: number;
  quarterCount?: number;
  /** Spectator mode: nothing is tappable and the page follows the live game. */
  readOnly?: boolean;
  /** Opened on purpose to watch (not because scoring is closed): offers a way back to scoring. */
  spectating?: boolean;
  windowLabel?: string;
  /** Epoch ms when scoring next opens (view-only banner countdown). */
  opensAt?: number | null;
  serverNow?: number;
  /** The scoring style saved on this phone, read from a cookie by the server. */
  initialMode?: ScoreMode;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [mode, setMode] = useScoreMode(initialMode);
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [padSel, setPadSel] = useState<number | null>(null);
  /** Plays a spoken or typed sentence saved without asking, kept for the Undo message. */
  const [saved, setSaved] = useState<{ text: string; grps: string[] } | null>(null);
  const [finishing, startFinish] = useTransition();
  // Plays are saved in the background (queued if the phone loses signal), and the server's copy
  // is polled so plays recorded on another phone show up here too. Paused while a menu is open.
  const sync = useGameSync({
    gameId,
    initialEvents,
    initialRoster,
    paused: sheet !== null || voiceOpen,
    onFinished: () => router.refresh(),
  });
  const events = sync.events;
  const roster = sync.roster;
  const error = localError ?? sync.error;

  const lines = useMemo(
    () => boxScore(roster, events, startMs),
    [roster, events, startMs],
  );
  const court = useMemo(() => onCourt(roster, events), [roster, events]);
  const clock = useMemo(
    () => buildClock(events, startMs, roster),
    [events, startMs, roster],
  );
  // Redraw a few times a second while the clock or a timeout is counting.
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!clock.running && !clock.activeTimeout) return;
    const id = setInterval(() => redraw((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [clock.running, clock.activeTimeout]);
  // Keep the screen on while someone is scoring, so the phone doesn't lock between plays.
  useEffect(() => {
    if (readOnly || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (stopped) void l.release();
        else lock = l;
      } catch {
        /* not allowed here (low battery, or not a secure page): the screen just follows the phone's setting */
      }
    };
    void acquire();
    // The lock is dropped when the page is hidden; take it again on return.
    const back = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", back);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", back);
      void lock?.release();
    };
  }, [readOnly]);

  const nowMs = sync.now();
  const timeoutsBy = (t: Team) =>
    clock.timeouts.filter((x) => x.team === t).length;
  const score = teamScores(lines);
  const isTied = score.A === score.B;

  const quarterInfo = useMemo(
    () =>
      gameType === "timed"
        ? getQuarterInfo(clock, nowMs, quarterMinutes, quarterCount, isTied)
        : null,
    [gameType, clock, nowMs, quarterMinutes, quarterCount, isTied],
  );

  const result = useMemo(
    () =>
      gameResult(
        score,
        { target, winBy, gameType, quarterMinutes, quarterCount },
        quarterInfo?.isGameEnded,
      ),
    [
      score,
      target,
      winBy,
      gameType,
      quarterMinutes,
      quarterCount,
      quarterInfo?.isGameEnded,
    ],
  );
  const [shotPadShooter, setShotPadShooter] = useState<RosterEntry | null>(null);
  /** FIBA timeout allowance for a team right now (timed games only). */
  const timeoutFor = (t: Team) =>
    gameType === "timed" && quarterInfo
      ? timeoutStatus(clock, t, quarterInfo, quarterMinutes, quarterCount)
      : null;

  // Keep the break countdown ticking while a break is on, and blow the whistle when it runs out.
  const breakOn = (quarterInfo?.breakMs ?? 0) > 0 && !result.over;
  const breakLeftMs = quarterInfo?.breakRemainingMs ?? 0;
  const [, redrawBreak] = useState(0);
  useEffect(() => {
    if (!breakOn || breakLeftMs <= 0) return;
    const id = setInterval(() => redrawBreak((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [breakOn, breakLeftMs]);
  const breakWasOn = useRef(false);
  useEffect(() => {
    if (breakOn && breakLeftMs === 0 && breakWasOn.current && !readOnly) playWhistle();
    breakWasOn.current = breakOn && breakLeftMs > 0;
  }, [breakOn, breakLeftMs, readOnly]);

  const [buzzerBeaterAlert, setBuzzerBeaterAlert] = useState<string | null>(null);
  // Who has the ball and the shot clock come from the saved plays, so they survive a reload and
  // spectators see them too. The toggle is just whether this phone shows the panel.
  const [showShotClock, setShowShotClock] = useState(gameType === "timed");
  const possession = useMemo(
    () =>
      buildPossession(
        events,
        roster,
        clock,
        gameType === "timed" ? { quarterMinutes, quarterCount } : undefined,
      ),
    [events, roster, clock, gameType, quarterMinutes, quarterCount],
  );
  const shot = readShotClock(
    possession,
    clock,
    nowMs,
    gameType === "timed" ? quarterInfo?.quarterRemainingMs : undefined,
  );

  const onFirePlayers = useMemo(
    () => detectOnFirePlayers(events, roster, 2),
    [events, roster],
  );
  const onFireSet = useMemo(
    () => new Set(onFirePlayers.map((p) => p.playerId)),
    [onFirePlayers],
  );

  // Play buzzer when game ends
  const prevIsOver = useRef(result.over);
  useEffect(() => {
    if (result.over && !prevIsOver.current) {
      playBuzzer();
    }
    prevIsOver.current = result.over;
  }, [result.over]);

  // End of quarter buzzer sound and auto-pause
  const prevQuarterEnded = useRef(false);
  useEffect(() => {
    if (
      quarterInfo?.isQuarterEnded &&
      !prevQuarterEnded.current &&
      clock.running
    ) {
      playBuzzer();
      if (!readOnly) {
        // Stamp the pause at the buzzer itself, not at the next redraw, so no time leaks into the next quarter.
        sync.add(
          [{ playerId: 0, type: "PAUSE" }],
          quarterInfo.boundaryWallMs ?? undefined,
        );
      }
    }
    prevQuarterEnded.current = Boolean(quarterInfo?.isQuarterEnded);
  }, [quarterInfo, clock.running, readOnly, sync]);

  // Warning whistle on timeout reaching 10 seconds
  const warnedTimeoutRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clock.activeTimeout) {
      warnedTimeoutRef.current = null;
      return;
    }
    const left = timeoutRemaining(clock.activeTimeout, nowMs);
    if (
      left <= 10 &&
      left > 8 &&
      warnedTimeoutRef.current !== clock.activeTimeout.grp
    ) {
      warnedTimeoutRef.current = clock.activeTimeout.grp;
      playWhistle();
    }
  }, [clock.activeTimeout, nowMs]);

  // Buzz once when the shot clock runs out (not for every redraw, and not again until the next reset).
  const violationKey = shot.violation ? `${possession.atGameMs}:${possession.team}` : null;
  const buzzedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!violationKey) {
      buzzedFor.current = null;
      return;
    }
    if (buzzedFor.current === violationKey) return;
    buzzedFor.current = violationKey;
    if (showShotClock && !readOnly) playBuzzer();
  }, [violationKey, showShotClock, readOnly]);

  // Play on fire flame whoosh when a new player catches fire
  const prevOnFireCount = useRef(onFirePlayers.length);
  useEffect(() => {
    if (onFirePlayers.length > prevOnFireCount.current) {
      playOnFireSound();
    }
    prevOnFireCount.current = onFirePlayers.length;
  }, [onFirePlayers.length]);

  const nameOf = (id: number) => roster.find((p) => p.id === id)?.name ?? "?";

  const active = (t: Team) =>
    roster.filter((p) => p.team === t && court.has(p.id));
  const bench = (t: Team) =>
    roster.filter((p) => p.team === t && !court.has(p.id));
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

  // A miss with no rebound yet: lets a spoken "Joe rebounds" be read as offensive or defensive.
  const lastMissTeam = useMemo(() => {
    const g = groups[groups.length - 1];
    const miss = g?.events.find((e) => e.type === "MISS2" || e.type === "MISS3");
    if (!g || !miss || g.events.some((e) => e.type === "OREB" || e.type === "DREB" || e.type === "OOB"))
      return null;
    return roster.find((p) => p.id === miss.playerId)?.team ?? null;
  }, [groups, roster]);

  function commit(evs: Ev[]): string {
    // Timed games follow the FIBA timeout allowances (also for timeouts said by voice).
    for (const e of evs) {
      if (e.type !== "TIMEOUT") continue;
      const team = e.team ?? roster.find((p) => p.id === e.playerId)?.team;
      const status = team ? timeoutFor(team) : null;
      if (status && !status.allowed) {
        setSheet(null);
        setLocalError(`Team ${team}: ${status.reason}.`);
        return "";
      }
    }
    navigator.vibrate?.(12);
    setSheet(null);
    setLocalError(null);
    setFollow(null);
    setSaved(null);

    // Audio SFX feedback
    if (evs.some((e) => e.type === "MAKE2" || e.type === "MAKE3")) {
      playSwish();

      // Check for Buzzer Beater!
      if (quarterInfo && isBuzzerBeater(quarterInfo.quarterRemainingMs)) {
        playBuzzer();
        playCheer();
        const shooterId =
          evs.find((e) => e.type === "MAKE2" || e.type === "MAKE3")?.playerId ?? 0;
        const shooterName = shortName(nameOf(shooterId));
        const shotType = evs.some((e) => e.type === "MAKE3") ? "3PT" : "2PT";
        const remFmt = formatCountdown(quarterInfo.quarterRemainingMs);
        setBuzzerBeaterAlert(
          `🚨 ${shooterName} hits the ${shotType} BUZZER BEATER with ${remFmt} left in ${quarterInfo.quarterLabel}!`,
        );
        setTimeout(() => setBuzzerBeaterAlert(null), 6000);
      }
    } else if (evs.some((e) => e.type === "MISS2" || e.type === "MISS3")) {
      playClang();
    }

    return sync.add(evs);
  }

  const clockPlay = (type: "PAUSE" | "RESUME") =>
    commit([{ playerId: 0, type }]);

  function removeGroup(grp: string) {
    setLocalError(null);
    sync.remove(grp);
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
        {
          cols: 1,
          options: [
            {
              label: "Out of bounds",
              onPick: () => commit([...miss, { playerId: shooter.id, type: "OOB" }]),
            },
            { label: "Skip (not sure)", tone: "neutral" as const, onPick: () => commit(miss) },
          ],
        },
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
              onPick: () =>
                commit([make, { playerId: m.id, type: "AST" as const }]),
            })),
            {
              label: "Unassisted",
              tone: "neutral" as const,
              onPick: () => commit([make]),
            },
          ],
        },
      ],
    });
  }

  function missStep(p: RosterEntry, shot: 2 | 3, extra: Ev[] = []) {
    reboundStep(p, [
      { playerId: p.id, type: shot === 3 ? "MISS3" : "MISS2" },
      ...extra,
    ]);
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
              onPick: () =>
                commit([steal, { playerId: o.id, type: "TOV" as const }]),
            })),
            {
              label: "Skip",
              tone: "neutral" as const,
              onPick: () => commit([steal]),
            },
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
                      {
                        label: "2-pointer",
                        onPick: () => missStep(shooter, 2, [block]),
                      },
                      {
                        label: "3-pointer",
                        onPick: () => missStep(shooter, 3, [block]),
                      },
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
          options: [
            // Short-handed (someone left, or the team started with two): just join, no one comes out.
            ...(active(b.team).length < ON_COURT
              ? [
                  {
                    label: "Join the court",
                    hint: "no one out",
                    tone: "good" as const,
                    onPick: () => commit([{ playerId: b.id, type: "SUB_IN" }]),
                  },
                ]
              : []),
            ...active(b.team).map((p) => ({
              label: p.name,
              tone: "sub" as const,
              onPick: () =>
                commit([
                  { playerId: p.id, type: "SUB_OUT" },
                  { playerId: b.id, type: "SUB_IN" },
                ]),
            })),
          ],
        },
      ],
    });
  }

  /** Shot clock ran out: charge the turnover to a player on the team that had the ball. */
  function violationStep() {
    const side = (t: Team) => ({
      heading: `${TEAM_STYLE[t].label} had the ball`,
      cols: 2 as const,
      options: active(t).map((p) => ({
        label: shortName(p.name),
        tone: "bad" as const,
        onPick: () => commit([{ playerId: p.id, type: "TOV" }]),
      })),
    });
    const team = possession.team;
    setSheet({
      title: "Shot clock violation",
      subtitle: team ? "Who had it? (Turnover)" : "Which team had the ball? (Turnover)",
      sections: team ? [side(team)] : [side("A"), side("B")],
    });
  }

  function timeoutStep() {
    playWhistle();
    const side = (t: Team) => {
      const status = timeoutFor(t);
      return {
      heading: status
        ? `${TEAM_STYLE[t].label} · ${status.left} of ${status.limit} left (${status.scope})`
        : TEAM_STYLE[t].label,
      note: status && !status.allowed ? (status.reason ?? undefined) : undefined,
      cols: 2 as const,
      options: status && !status.allowed ? [] : [
        {
          label: `${TEAM_STYLE[t].label} called it`,
          tone: "sub" as const,
          onPick: () => commit([{ playerId: 0, type: "TIMEOUT", team: t }]),
        },
        ...active(t).map((p) => ({
          label: shortName(p.name),
          onPick: () =>
            commit([{ playerId: p.id, type: "TIMEOUT" as const, team: t }]),
        })),
      ],
      };
    };
    setSheet({
      title: "Timeout",
      subtitle: "Who called it?",
      sections: [side("A"), side("B")],
    });
  }

  function playerSheet(p: RosterEntry) {
    const solo =
      (type: EventType): (() => void) =>
      () =>
        commit([{ playerId: p.id, type }]);
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
            {
              label: "Made 2",
              hint: "+2",
              tone: "good",
              onPick: () => makeStep(p, 2),
            },
            {
              label: "Made 3",
              hint: "+3",
              tone: "good",
              onPick: () => makeStep(p, 3),
            },
            { label: "Missed 2", tone: "bad", onPick: () => missStep(p, 2) },
            { label: "Missed 3", tone: "bad", onPick: () => missStep(p, 3) },
          ],
        },
        {
          heading: "Free throws",
          cols: 2,
          options: [
            {
              label: "FT made",
              hint: "+1",
              tone: "good",
              onPick: solo("MAKE_FT"),
            },
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
                options: [
                  {
                    label: "Sub out…",
                    tone: "sub" as const,
                    onPick: () => subOutStep(p),
                  },
                ],
              },
            ]
          : []),
      ],
    });
  }

  // ---- Quick and Pad flows: save the play first, add the detail after ---------------------

  const dismissFollow = useCallback(() => setFollow(null), []);
  const dismissSaved = useCallback(() => setSaved(null), []);

  /**
   * A shot is saved at once; a chip strip then offers the assist (made) or the rebound (missed).
   * When it came from the court pad, the zone rides along in the same group, so undo removes it
   * and every phone gets it through the normal poll.
   */
  function quickShot(
    p: RosterEntry,
    type: "MAKE2" | "MAKE3" | "MISS2" | "MISS3",
    zone?: ShotZoneId,
  ) {
    const evs: Ev[] = [{ playerId: p.id, type }];
    if (zone) evs.push({ playerId: p.id, type: "ZONE", zone });
    const grp = commit(evs);
    setFollow({
      grp,
      kind: type.startsWith("MAKE") ? "assist" : "rebound",
      playerId: p.id,
    });
  }

  function quickSolo(p: RosterEntry, type: EventType) {
    commit([{ playerId: p.id, type }]);
  }

  function quickSteal(p: RosterEntry) {
    const grp = commit([{ playerId: p.id, type: "STL" }]);
    setFollow({ grp, kind: "stealFrom", playerId: p.id });
  }

  function quickBlock(p: RosterEntry) {
    const grp = commit([{ playerId: p.id, type: "BLK" }]);
    setFollow({ grp, kind: "blockShot", playerId: p.id });
  }

  /**
   * Adds events to the play that was just saved. A saved group can't be appended to, so the play is
   * swapped for a copy that carries the extra events (same time, same place in the log). It is
   * only ever the latest play, so nothing recorded in between can be reordered.
   */
  function attach(extra: Ev[], next?: (grp: string) => FollowState | null) {
    const g = groups[groups.length - 1];
    if (!follow || !g || g.grp !== follow.grp) return setFollow(null);
    navigator.vibrate?.(12);
    const base: Ev[] = g.events.map((e) => ({
      playerId: e.playerId,
      type: e.type,
      ...(e.team ? { team: e.team } : {}),
      ...(e.zone ? { zone: e.zone } : {}),
    }));
    sync.remove(g.grp);
    const grp = sync.add([...base, ...extra], g.events[0].at);
    setFollow(next ? next(grp) : null);
  }

  /** What the strip offers for the current follow-up, or null when there is nothing to pick. */
  function followView(f: FollowState): { title: string; groups: ChipGroup[] } | null {
    const p = roster.find((r) => r.id === f.playerId);
    if (!p) return null;
    const who = shortName(p.name);
    const chipsFor = (list: RosterEntry[], type: EventType, tone?: "good") =>
      list.map((m) => ({
        key: `${type}-${m.id}`,
        label: shortName(m.name),
        tone,
        onPick: () => attach([{ playerId: m.id, type }]),
      }));
    let out: { title: string; groups: ChipGroup[] };
    switch (f.kind) {
      case "assist":
        out = {
          title: `${who} scored · assist?`,
          groups: [{ chips: chipsFor(mates(p), "AST", "good") }],
        };
        break;
      case "rebound":
        out = {
          title: `${who} missed · rebound?`,
          groups: [
            { heading: "Off", chips: chipsFor(active(p.team), "OREB") },
            { heading: "Def", chips: chipsFor(opponents(p), "DREB") },
            {
              chips: [
                {
                  key: "OOB",
                  label: "Out of bounds",
                  tone: "bad" as const,
                  onPick: () => attach([{ playerId: p.id, type: "OOB" }]),
                },
              ],
            },
          ],
        };
        break;
      case "stealFrom":
        out = {
          title: `${who} steal · whose ball?`,
          groups: [{ chips: chipsFor(opponents(p), "TOV") }],
        };
        break;
      case "blockShot":
        out = {
          title: `${who} block · whose shot?`,
          groups: opponents(p).map((o) => ({
            heading: shortName(o.name),
            chips: ([2, 3] as const).map((n) => ({
              key: `blk-${o.id}-${n}`,
              label: `Missed ${n}`,
              onPick: () =>
                attach(
                  [{ playerId: o.id, type: n === 3 ? "MISS3" : "MISS2" }],
                  (grp) => ({ grp, kind: "rebound", playerId: o.id }),
                ),
            })),
          })),
        };
        break;
    }
    return out.groups.some((g) => g.chips.length > 0) ? out : null;
  }

  // ---- Late arrivals -------------------------------------------------------------------------

  const [lateBusy, setLateBusy] = useState(false);

  /** Adds someone to this game (an existing player, or a new name) and offers to check them in. */
  async function addLate(team: Team, who: { playerId?: number; name?: string }) {
    setLateBusy(true);
    setLocalError(null);
    try {
      const res = await addLatePlayer({ gameId, team, ...who });
      if (!res.ok) return setLocalError(res.error);
      const entry: RosterEntry = {
        id: res.player.id,
        name: res.player.name,
        team,
        starter: false,
        nicknames: res.player.nicknames,
      };
      sync.addToRoster(entry);
      // They're on the bench now. Ask who comes out (or let them join a short team); closing leaves them on the bench.
      subInStep(entry);
    } catch {
      setLocalError("Couldn't add the player. Check the connection and try again.");
    } finally {
      setLateBusy(false);
    }
  }

  function finish() {
    // Plays still waiting to be sent would be refused once the game is finished, so wait for them.
    if (sync.pending > 0) {
      setLocalError("Still saving plays. Try again in a moment.");
      return;
    }
    startFinish(async () => {
      const res = await finishGame(gameId);
      if (!res.ok) setLocalError(res.error);
      else router.refresh();
    });
  }

  const last = groups[groups.length - 1];

  // Spectators always see the plain cards. Scorers get the style they picked on this phone.
  const view = readOnly ? "classic" : mode;
  // The follow-up only belongs to the latest play: another play, an undo or a delete clears it.
  const followNow = follow && last?.grp === follow.grp ? followView(follow) : null;
  const padPlayer =
    roster.find((p) => p.id === padSel && court.has(p.id)) ?? null;

  // The scoring-style switch and the voice box. In Pad mode they sit below the tiles so the fixed
  // action bar doesn't cover the players.
  const controls = (
    <>
      {!readOnly && (
        <div className="space-y-1.5">
          <div
            role="radiogroup"
            aria-label="Scoring style"
            className="grid grid-cols-3 gap-1 rounded-2xl bg-black/[0.05] p-1"
          >
            {SCORE_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setFollow(null);
                }}
                className={`h-10 rounded-xl text-sm font-bold transition ${
                  mode === m.id
                    ? "bg-white shadow-sm ring-1 ring-black/5"
                    : "text-muted"
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
          <p className="px-1 text-xs font-medium text-muted">
            {SCORE_MODES.find((m) => m.id === mode)?.hint}
          </p>
        </div>
      )}

      {!readOnly && (
        <VoiceEntry
          roster={roster}
          court={court}
          lastMissTeam={lastMissTeam}
          lastPlay={last ? describeGroup(last.events, nameOf) : null}
          onCommit={commit}
          onSaved={setSaved}
          onUndo={() => last && removeGroup(last.grp)}
          onOpenChange={setVoiceOpen}
        />
      )}
    </>
  );

  const padActions: PadAction[] = [
    { key: "m2", label: "+2", tone: "good", onPress: () => padPlayer && quickShot(padPlayer, "MAKE2") },
    { key: "m3", label: "+3", tone: "good", onPress: () => padPlayer && quickShot(padPlayer, "MAKE3") },
    { key: "x2", label: "Miss 2", tone: "bad", onPress: () => padPlayer && quickShot(padPlayer, "MISS2") },
    { key: "x3", label: "Miss 3", tone: "bad", onPress: () => padPlayer && quickShot(padPlayer, "MISS3") },
    { key: "ftm", label: "FT +1", tone: "good", onPress: () => padPlayer && quickSolo(padPlayer, "MAKE_FT") },
    { key: "ftx", label: "FT miss", tone: "bad", onPress: () => padPlayer && quickSolo(padPlayer, "MISS_FT") },
    { key: "oreb", label: "Off reb", tone: "neutral", onPress: () => padPlayer && quickSolo(padPlayer, "OREB") },
    { key: "dreb", label: "Def reb", tone: "neutral", onPress: () => padPlayer && quickSolo(padPlayer, "DREB") },
    { key: "ast", label: "Assist", tone: "neutral", onPress: () => padPlayer && quickSolo(padPlayer, "AST") },
    { key: "stl", label: "Steal", tone: "neutral", onPress: () => padPlayer && quickSteal(padPlayer) },
    { key: "blk", label: "Block", tone: "neutral", onPress: () => padPlayer && quickBlock(padPlayer) },
    { key: "tov", label: "Turnover", tone: "bad", onPress: () => padPlayer && quickSolo(padPlayer, "TOV") },
    { key: "pf", label: "Foul", tone: "bad", onPress: () => padPlayer && quickSolo(padPlayer, "FOUL") },
    { key: "defl", label: "Deflect", tone: "neutral", onPress: () => padPlayer && quickSolo(padPlayer, "DEFL") },
    { key: "sub", label: "Sub out…", tone: "sub", onPress: () => padPlayer && bench(padPlayer.team).length > 0 && subOutStep(padPlayer) },
    { key: "undo", label: "↶ Undo", tone: "neutral", needsPlayer: false, onPress: () => last && removeGroup(last.grp) },
  ];

  return (
    <div
      className={`space-y-4 ${view === "pad" ? "pb-[26rem]" : view === "quick" ? "pb-44" : ""}`}
    >
      {/* Buzzer Beater Celebration Alert */}
      {buzzerBeaterAlert && (
        <div className="glass-1 animate-pulse rounded-2xl border-2 border-amber-400 bg-amber-500/20 p-3 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-950">
                  Buzzer Beater!
                </div>
                <div className="text-xs font-bold text-amber-900">
                  {buzzerBeaterAlert}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBuzzerBeaterAlert(null)}
              className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-amber-950 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="sticky top-[calc(var(--header-h)+8px)] z-10 -mx-4 px-4 pb-2 pt-1">
        <div className="glass-3 overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            {(["A", "B"] as const).map((t) => (
              <div
                key={t}
                className={`relative px-4 py-3 ${t === "B" ? "order-3 text-right" : "order-1"}`}
              >
                <span
                  className={`absolute inset-y-0 ${t === "A" ? "left-0" : "right-0"} w-1 ${TEAM_STYLE[t].bar}`}
                />
                <div className="label text-muted">{TEAM_STYLE[t].label}</div>
                <div
                  key={score[t]}
                  className="pop tabular text-[64px] font-extrabold leading-none tracking-tighter"
                >
                  {score[t]}
                </div>
              </div>
            ))}
            <div className="order-2 flex flex-col items-center justify-center px-1 text-[11px] font-semibold text-muted">
              {gameType === "timed" ? (
                <>
                  <span className="rounded-full bg-court-soft/50 px-2 py-0.5 text-xs font-extrabold text-court-ink">
                    {quarterInfo?.quarterLabel ?? "Q1"}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted">
                    {quarterMinutes}m / Q
                  </span>
                </>
              ) : (
                <>
                  <span>{winBy > 1 ? `to ${target}` : `first to ${target}`}</span>
                  {winBy > 1 && <span>win by {winBy}</span>}
                </>
              )}
            </div>
          </div>

          {/* Quarter tracker pills for timed games */}
          {gameType === "timed" && quarterInfo && (
            <div className="hairline flex items-center justify-between border-t bg-black/[0.02] px-4 py-1.5">
              <div className="flex items-center gap-1">
                {Array.from({ length: quarterCount }, (_, i) => i + 1).map((q) => {
                  const isCurrent = quarterInfo.quarter === q;
                  const isPast = quarterInfo.quarter > q;
                  return (
                    <span
                      key={q}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        isCurrent
                          ? "bg-court-ink text-white shadow-xs"
                          : isPast
                            ? "bg-black/[0.08] text-muted"
                            : "bg-black/[0.04] text-muted/60"
                      }`}
                    >
                      Q{q}
                    </span>
                  );
                })}
                {quarterInfo.isOvertime && (
                  <span className="animate-pulse rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    {quarterInfo.quarterLabel}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-muted">
                {quarterInfo.isOvertime
                  ? "Overtime"
                  : `Quarter ${quarterInfo.quarter} of ${quarterCount}`}
              </span>
            </div>
          )}

          {/* Game clock and timeouts */}
          <div className="hairline flex items-center justify-between gap-3 border-t px-4 py-2.5">
            {clock.activeTimeout ? (
              <div className="min-w-0">
                <div className="label text-sub">
                  Timeout
                  {clock.activeTimeout.team
                    ? ` · Team ${clock.activeTimeout.team}`
                    : ""}
                </div>
                <div className="flex items-baseline gap-2">
                  {(() => {
                    const left = timeoutRemaining(clock.activeTimeout, nowMs);
                    return (
                      <span
                        className={`tabular text-2xl font-extrabold leading-7 ${left < 0 ? "text-loss" : "text-sub"}`}
                      >
                        {left >= 0
                          ? formatClock(left * 1000)
                          : `+${formatClock(-left * 1000)}`}
                      </span>
                    );
                  })()}
                  {clock.activeTimeout.playerId > 0 && (
                    <span className="truncate text-xs font-semibold text-muted">
                      called by{" "}
                      {shortName(nameOf(clock.activeTimeout.playerId))}
                    </span>
                  )}
                </div>
              </div>
            ) : gameType === "timed" && quarterInfo ? (
              <div className="min-w-0">
                <div className="label flex items-center gap-1.5 whitespace-nowrap text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      clock.running
                        ? "animate-pulse bg-win"
                        : clock.started
                          ? "bg-court-soft"
                          : "bg-stone-400"
                    }`}
                  />
                  {quarterInfo.quarterLabel} Countdown
                  {quarterInfo.isQuarterEnded
                    ? " · Ended"
                    : clock.running
                      ? " · Live"
                      : " · Paused"}
                </div>
                <div
                  className={`tabular text-2xl font-extrabold leading-7 ${
                    quarterInfo.quarterRemainingMs <= 10000 &&
                    quarterInfo.quarterRemainingMs > 0
                      ? "animate-pulse text-loss"
                      : quarterInfo.quarterRemainingMs <= 60000
                        ? "text-amber-600"
                        : "text-ink"
                  }`}
                >
                  {formatCountdown(quarterInfo.quarterRemainingMs)}
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="label flex items-center gap-1.5 whitespace-nowrap text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      clock.running
                        ? "animate-pulse bg-win"
                        : clock.started
                          ? "bg-court-soft"
                          : "bg-stone-400"
                    }`}
                  />
                  {clock.running
                    ? "Game clock"
                    : clock.started
                      ? "Clock paused"
                      : "Clock not started"}
                </div>
                <div className="tabular text-2xl font-extrabold leading-7">
                  {formatClock(elapsedNow(clock, nowMs))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {gameType === "timed" && quarterInfo ? (
                <span className="tabular mr-0.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-muted">
                  TO left {timeoutFor("A")?.left ?? 0}–{timeoutFor("B")?.left ?? 0}
                </span>
              ) : (
                (timeoutsBy("A") > 0 || timeoutsBy("B") > 0) && (
                  <span className="tabular mr-0.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-muted">
                    TO {timeoutsBy("A")}–{timeoutsBy("B")}
                  </span>
                )
              )}
              {!readOnly &&
                (clock.activeTimeout ? (
                  <button
                    onClick={() => clockPlay("RESUME")}
                    className="h-10 whitespace-nowrap rounded-full bg-ink px-3.5 text-sm font-semibold text-paper active:scale-95"
                  >
                    Resume play
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        clockPlay(clock.running ? "PAUSE" : "RESUME")
                      }
                      className="h-10 whitespace-nowrap rounded-full bg-ink px-3.5 text-sm font-semibold text-paper active:scale-95"
                    >
                      {clock.running
                        ? "Pause"
                        : clock.started
                          ? "Resume"
                          : "Start"}
                    </button>
                    <button
                      onClick={timeoutStep}
                      className="h-10 whitespace-nowrap rounded-full bg-sub/10 px-3 text-sm font-semibold text-sub ring-1 ring-sub/25 active:scale-95"
                    >
                      Timeout
                    </button>
                  </>
                ))}
            </div>
          </div>

          {/* End of Quarter / Break banner */}
          {gameType === "timed" &&
            quarterInfo?.isQuarterEnded &&
            !result.over &&
            !readOnly && (
              <div className="hairline flex items-center justify-between gap-2 border-t bg-amber-500/10 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-900">
                    🔔 {quarterInfo.quarterLabel} Expired!
                  </div>
                  <div className="text-[11px] text-amber-800">
                    {quarterInfo.quarter < quarterCount
                      ? `Ready for Quarter ${quarterInfo.quarter + 1}`
                      : isTied
                        ? "Regulation tied! Overtime ready"
                        : "Regulation finished!"}
                  </div>
                  {quarterInfo.breakMs > 0 && (
                    <div className="tabular text-[11px] font-bold text-amber-900">
                      {quarterInfo.breakMs === FIBA.halftimeBreakMs
                        ? "Halftime"
                        : "Break"}{" "}
                      {quarterInfo.breakRemainingMs > 0
                        ? formatClock(quarterInfo.breakRemainingMs)
                        : "over"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => clockPlay("RESUME")}
                  className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95"
                >
                  {quarterInfo.quarter < quarterCount
                    ? `Start Q${quarterInfo.quarter + 1} ▶`
                    : isTied
                      ? "Start Overtime ▶"
                      : "Resume Play"}
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Court Soundboard & Controls */}
      <div className="flex items-center justify-between px-1">
        <CourtAudioControls />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowShotClock(!showShotClock)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
              showShotClock
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-black/[0.06] text-muted hover:text-ink"
            }`}
          >
            <span>⏱️ 24s</span>
            <span className="text-[9px]">{showShotClock ? "▲" : "▼"}</span>
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                setShotPadShooter(shotPadShooter ? null : active("A")[0] || null)
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                shotPadShooter
                  ? "bg-court-ink text-white shadow-xs"
                  : "bg-black/[0.06] text-muted hover:text-ink"
              }`}
            >
              <span>🗺️ Court Shot</span>
              <span className="text-[10px]">{shotPadShooter ? "▲" : "▼"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Shot clock and possession (worked out from the plays) */}
      {showShotClock && (
        <div className="glass-2 space-y-2 rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-bold text-muted">Shot clock</span>
              <span
                className={`tabular text-2xl font-black ${
                  shot.violation
                    ? "text-loss"
                    : shot.sec !== null && shot.sec <= 5
                      ? "animate-pulse text-loss"
                      : shot.sec === null
                        ? "text-muted"
                        : "text-ink"
                }`}
              >
                {shot.sec === null ? "--" : `${shot.sec}s`}
              </span>
              {shot.violation && (
                <span className="text-xs font-bold text-loss">VIOLATION!</span>
              )}
            </div>
            <div className="min-w-0 truncate text-right text-xs font-bold text-ink">
              {possessionLabel(possession.team, possession.phase, shot.sec === null && possession.startSec !== null)}
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(["A", "B"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => commit([{ playerId: 0, type: "POSS", team: t }])}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold active:scale-95 ${
                    possession.team === t
                      ? "bg-court-ink text-white"
                      : "bg-black/[0.06] text-ink"
                  }`}
                  title="Give this team the ball with a fresh 24s"
                >
                  Ball: {TEAM_STYLE[t].label}
                </button>
              ))}
              <button
                type="button"
                onClick={violationStep}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 active:scale-95 ${
                  shot.violation
                    ? "animate-pulse bg-loss text-white ring-loss"
                    : "bg-loss/10 text-loss ring-loss/20"
                }`}
              >
                Violation (TO)
              </button>
            </div>
          )}
          <p className="text-[11px] leading-tight text-muted">
            FIBA: 24s to shoot, 14s after an offensive rebound or a defensive foul. It follows the plays
            you log, stops with the game clock, and switches off when less than 24s is left in the period.
          </p>
        </div>
      )}

      {/* Mini Court Shot Pad (when open) */}
      {!readOnly && shotPadShooter && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-bold text-muted">Shooter:</span>
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {[...active("A"), ...active("B")].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setShotPadShooter(p)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                    shotPadShooter.id === p.id
                      ? "bg-ink text-paper"
                      : "bg-black/[0.05] text-muted hover:text-ink"
                  }`}
                >
                  {shortName(p.name)}
                </button>
              ))}
            </div>
          </div>
          <MiniCourtShotPad
            shooterName={shotPadShooter.name}
            onRecordShot={(zone, made, pts) => {
              const type =
                pts === 3
                  ? made
                    ? "MAKE3"
                    : "MISS3"
                  : made
                    ? "MAKE2"
                    : "MISS2";
              quickShot(shotPadShooter, type, zone);
            }}
          />
        </div>
      )}

      {/* Live Win Probability & Draw Tension Meter */}
      <LiveWinProbability
        scoreA={score.A}
        scoreB={score.B}
        target={target}
        winBy={winBy}
        gameType={gameType}
        quarterMinutes={quarterMinutes}
        quarterCount={quarterCount}
        elapsedSec={Math.floor(elapsedNow(clock, nowMs) / 1000)}
        isGameOver={result.over}
        startMs={startMs}
        events={events}
        roster={roster}
        teamNames={{ A: TEAM_STYLE.A.label, B: TEAM_STYLE.B.label }}
      />

      {/* Live Momentum & On Fire Meter */}
      <LiveMomentumMeter
        events={events}
        roster={roster}
        teamNames={{ A: TEAM_STYLE.A.label, B: TEAM_STYLE.B.label }}
      />

      {readOnly && (
        <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5">
          <div className="min-w-0">
            <div className="text-sm font-bold">
              {spectating ? "Spectating" : "View only"}
            </div>
            <div className="text-xs text-muted">
              Following live.{" "}
              {spectating ? (
                <>Scores update by themselves.</>
              ) : opensAt ? (
                <>
                  Scoring opens in{" "}
                  <Countdown target={opensAt} serverNow={serverNow} compact /> (
                  {windowLabel}).
                </>
              ) : (
                <>Scoring opens {windowLabel}.</>
              )}
            </div>
          </div>
          <Link
            href={spectating ? `/games/${gameId}` : "/admin"}
            className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-muted active:scale-95"
          >
            {spectating ? "Stop watching" : "Admin"}
          </Link>
        </div>
      )}

      {result.over && (
        <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl !bg-win/15 p-4">
          <div>
            <div className="font-extrabold text-emerald-900">
              Team {result.winner} wins!
            </div>
            <div className="text-sm text-muted">
              Check the log, then lock it in.
            </div>
          </div>
          {!readOnly && (
            <button
              onClick={finish}
              disabled={finishing || sync.pending > 0}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper active:scale-95 disabled:opacity-60"
            >
              {finishing
                ? "Finishing…"
                : sync.pending > 0
                  ? "Saving plays…"
                  : "Finish game"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss"
        >
          <span>{error}</span>
          <button
            onClick={() => {
              setLocalError(null);
              sync.clearError();
            }}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded-full px-2 py-1 active:bg-loss/10"
          >
            ✕
          </button>
        </div>
      )}

      {/* Save status: plays are sent in the background and wait here if the signal drops. */}
      {(!readOnly || sync.state === "offline") && (
        <div role="status" className="-mt-1 flex justify-end px-1">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              sync.state === "offline"
                ? "bg-loss/10 text-loss"
                : "bg-black/[0.05] text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                sync.state === "offline"
                  ? "bg-loss"
                  : sync.state === "saving"
                    ? "animate-pulse bg-court-soft"
                    : "bg-win"
              }`}
            />
            {sync.state === "offline"
              ? sync.pending > 0
                ? `Offline · ${sync.pending} ${sync.pending === 1 ? "play" : "plays"} waiting to send`
                : "Offline · reconnecting"
              : sync.state === "saving"
                ? `Saving ${sync.pending}…`
                : readOnly
                  ? "Live"
                  : "All saved"}
          </span>
        </div>
      )}

      {view !== "pad" && controls}

      {/* On-court cards + bench */}
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className="space-y-2">
            {active(t).map((p) => {
              const l = lines.find((x) => x.playerId === p.id)!;
              const header = (
                <div className="flex items-center gap-2">
                  <Avatar id={p.id} name={p.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {shortName(p.name)}
                  </span>
                  {onFireSet.has(p.id) && (
                    <span
                      title="On Fire (hot streak)"
                      className="inline-flex items-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black text-rose-700 animate-pulse"
                    >
                      🔥
                    </span>
                  )}
                  <span
                    key={l.pts}
                    className="pop tabular text-2xl font-extrabold tracking-tight"
                  >
                    {l.pts}
                  </span>
                </div>
              );
              const stats = (
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
                    <span className={l.pf >= 4 ? "font-bold text-loss" : ""}>
                      {l.pf} pf
                    </span>
                  )}
                </div>
              );

              // Quick: the shot buttons are on the card, one tap each. The name opens the full menu.
              if (view === "quick") {
                return (
                  <div key={p.id} className="glass-1 rounded-2xl p-3">
                    <button
                      onClick={() => playerSheet(p)}
                      aria-label={`${p.name}: all actions`}
                      className="block w-full text-left active:opacity-70"
                    >
                      {header}
                      {stats}
                    </button>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ["MAKE2", "+2", "good"],
                          ["MAKE3", "+3", "good"],
                          ["MISS2", "Miss 2", "bad"],
                          ["MISS3", "Miss 3", "bad"],
                        ] as const
                      ).map(([type, label, tone]) => (
                        <button
                          key={type}
                          onClick={() => quickShot(p, type)}
                          aria-label={`${p.name} ${label}`}
                          className={`h-12 rounded-xl text-sm font-extrabold transition-transform active:scale-95 ${TONES[tone]}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Pad: tap a player once to select them; the action bar at the bottom does the rest.
              if (view === "pad") {
                const picked = padPlayer?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPadSel(p.id)}
                    aria-pressed={picked}
                    className={`glass-1 w-full rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                      picked
                        ? t === "A"
                          ? "!border-court !bg-court/20 ring-2 ring-court"
                          : "!border-away !bg-away/20 ring-2 ring-away"
                        : ""
                    }`}
                  >
                    {header}
                    {stats}
                  </button>
                );
              }

              return (
                <button
                  key={p.id}
                  onClick={() => !readOnly && playerSheet(p)}
                  aria-disabled={readOnly}
                  className={`glass-1 w-full rounded-2xl p-3 text-left ${
                    readOnly
                      ? "cursor-default"
                      : `transition-transform active:scale-[0.98] active:ring-2 ${TEAM_STYLE[t].ring}`
                  }`}
                >
                  {header}
                  {stats}
                </button>
              );
            })}
            {!readOnly && (
              <PlayerPicker
                label={TEAM_STYLE[t].label}
                accent={t === "A" ? "court" : "away"}
                buttonLabel="Late arrival"
                title={`Late arrival · ${TEAM_STYLE[t].label}`}
                compact
                busy={lateBusy}
                options={leaguePlayers.filter(
                  (lp) => !roster.some((r) => r.id === lp.id),
                )}
                onPick={(playerId) => void addLate(t, { playerId })}
                onCreate={(name) => void addLate(t, { name })}
              />
            )}
            {bench(t).length > 0 && (
              <div className="rounded-2xl bg-black/[0.04] p-2">
                <div className="label mb-1 px-1 text-[10px] text-muted">
                  {readOnly ? "Bench" : "Bench · tap to sub in"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bench(t).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => !readOnly && subInStep(b)}
                      aria-disabled={readOnly}
                      className={`flex items-center gap-1.5 rounded-full bg-white/70 py-1 pl-1 pr-3 text-sm font-semibold ring-1 ring-black/5 ${
                        readOnly ? "cursor-default" : "active:bg-sub/10"
                      }`}
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
          <button
            onClick={() => setShowLog((s) => !s)}
            className="text-sm font-semibold text-muted"
          >
            Play log ({groups.length}) {showLog ? "▲" : "▼"}
          </button>
          {!readOnly && (
            <button
              disabled={!last}
              onClick={() => last && removeGroup(last.grp)}
              className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-30"
            >
              ↶ Undo last
            </button>
          )}
        </div>
        {!showLog && last && (
          <p className="mt-2 text-sm text-muted">
            Last: {describeGroup(last.events, nameOf)}
          </p>
        )}
        {showLog && (
          <ol className="mt-2 divide-y divide-black/[0.06]">
            {[...groups].reverse().map((g) => (
              <li
                key={g.grp}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span>{describeGroup(g.events, nameOf)}</span>
                {!readOnly && (
                  <button
                    onClick={() => removeGroup(g.grp)}
                    aria-label="Delete this play"
                    className="shrink-0 rounded-full px-2 py-1 text-loss active:bg-loss/10"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
            {groups.length === 0 && (
              <li className="py-2 text-sm text-muted">No plays yet.</li>
            )}
          </ol>
        )}
      </div>

      {view === "pad" && controls}

      {!result.over && !readOnly && (
        <button
          onClick={() => {
            if (
              confirm(
                gameType === "timed"
                  ? "End the game now? Use this if you called the game before all quarters were finished."
                  : "End the game now? Use this if you stopped before the target score.",
              )
            )
              finish();
          }}
          className="w-full rounded-xl py-2 text-sm font-semibold text-muted active:bg-black/5"
        >
          End game early
        </button>
      )}

      {/* Follow-up chips and (in Pad) the action bar sit in the thumb zone, above the bottom nav. */}
      {!readOnly && (view === "pad" || followNow || saved) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-3xl px-4 md:bottom-4">
          <div className="pointer-events-auto space-y-2">
            {saved && (
              <SavedToast
                stamp={saved.grps.join("")}
                text={saved.text}
                onUndo={() => {
                  saved.grps.forEach(removeGroup);
                  setSaved(null);
                }}
                onDismiss={dismissSaved}
              />
            )}
            {follow && followNow && (
              <FollowUp
                stamp={follow.grp}
                title={followNow.title}
                groups={followNow.groups}
                sticky={follow.kind === "rebound"}
                onDismiss={dismissFollow}
              />
            )}
            {view === "pad" && (
              <ActionPad player={padPlayer} actions={padActions} />
            )}
          </div>
        </div>
      )}

      {/* Action sheet */}
      {sheet && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/25 backdrop-blur-sm"
          onClick={() => setSheet(null)}
        >
          <div
            role="dialog"
            aria-label={sheet.title}
            onClick={(e) => e.stopPropagation()}
            className="glass-3 sheet-up mx-auto max-h-[88vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-[28px] p-4 pb-8"
          >
            <div className="flex items-center gap-3">
              {sheet.player && (
                <Avatar id={sheet.player.id} name={sheet.player.name} />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-extrabold leading-tight tracking-tight">
                  {sheet.title}
                </h2>
                {sheet.subtitle && (
                  <p className="text-sm font-semibold text-muted">
                    {sheet.subtitle}
                  </p>
                )}
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
                  <div className="label mb-1.5 text-muted">{s.heading}</div>
                )}
                {s.note && (
                  <div className="rounded-xl bg-black/[0.04] px-3 py-3 text-sm font-semibold text-muted">
                    {s.note}
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
                      {o.hint && (
                        <span className="ml-1 text-sm font-semibold opacity-80">
                          {o.hint}
                        </span>
                      )}
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

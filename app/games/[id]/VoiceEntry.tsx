"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { RosterEntry, Team } from "@/lib/stats";
import {
  buildPlay,
  parseVoice,
  playNeeds,
  setNeed,
  short,
  type Draft,
  type Play,
  type VoiceContext,
} from "@/lib/voice";

// Hold the mic and say a play ("Daniel scores 2, assisted by Joe") or type it. Either way the text goes
// through the same parser (lib/voice.ts) and the scorekeeper confirms what it understood before
// anything is recorded.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed":
    "The microphone is blocked. Allow it for this site in the browser settings.",
  "service-not-allowed":
    "Speech recognition isn't allowed here. You can still type the play.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs an internet connection.",
  "no-speech": "Didn't hear anything. Hold the mic and speak.",
};

// ---- nicknames, kept on this phone ---------------------------------------------------------

const NICK_KEY = "pl-nicknames-v1";
const nickListeners = new Set<() => void>();
const readNicks = () => {
  try {
    return localStorage.getItem(NICK_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const subscribeNicks = (cb: () => void) => {
  nickListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    nickListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
function writeNicks(list: { alias: string; id: number }[]) {
  try {
    localStorage.setItem(NICK_KEY, JSON.stringify(list));
  } catch {
    /* private mode or blocked storage: nicknames just won't stick */
  }
  nickListeners.forEach((cb) => cb());
}

type Draftset = { heard: string; plays: Play[]; unparsed: string[] };

export function VoiceEntry({
  roster,
  court,
  lastMissTeam,
  lastPlay,
  onCommit,
  onUndo,
  onOpenChange,
}: {
  roster: RosterEntry[];
  court: Set<number>;
  /** Team of the last shot that was missed with no rebound yet. */
  lastMissTeam: Team | null;
  /** Wording of the most recent play (what "undo" would remove), or null if there is none. */
  lastPlay: string | null;
  onCommit: (events: Draft[]) => void;
  onUndo: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => recognitionCtor() !== null,
    () => false,
  );
  const nickRaw = useSyncExternalStore(subscribeNicks, readNicks, () => "[]");
  const aliases = useMemo(() => {
    try {
      const v = JSON.parse(nickRaw);
      return Array.isArray(v)
        ? (v as { alias: string; id: number }[]).filter(
            (a) => typeof a.alias === "string" && Number.isFinite(a.id),
          )
        : [];
    } catch {
      return [];
    }
  }, [nickRaw]);

  const ctx: VoiceContext = useMemo(
    () => ({
      players: roster.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        onCourt: court.has(p.id),
      })),
      aliases,
      lastMissTeam,
    }),
    [roster, court, aliases, lastMissTeam],
  );

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draftset | null>(null);
  const [reread, setReread] = useState("");
  const [showNicks, setShowNicks] = useState(false);
  const [nickName, setNickName] = useState("");
  const [nickId, setNickId] = useState<number>(roster[0]?.id ?? 0);

  const rec = useRef<Recognition | null>(null);
  const heard = useRef("");
  const failed = useRef(false);
  const retryEnglish = useRef(false);

  function open(d: Draftset | null) {
    setDraft(d);
    onOpenChange(d !== null);
  }

  function handleText(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const parsed = parseVoice(t, ctx);
    if (parsed.plays.length === 0) {
      setNote(
        `Couldn't make a play out of "${t}". Try "Daniel scores 2, assisted by Joe".`,
      );
      return;
    }
    setNote(null);
    setReread(t);
    open({ heard: t, plays: parsed.plays, unparsed: parsed.unparsed });
  }

  function startListening(lang: string = navigator.language || "en-US") {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    heard.current = "";
    failed.current = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++)
        t += e.results[i][0].transcript + " ";
      heard.current = t.trim();
      setLive(heard.current);
    };
    r.onerror = (e) => {
      failed.current = true;
      if (e.error === "aborted") return;
      // An unsupported phone language: try plain English once instead of failing.
      if (e.error === "language-not-supported" && lang !== "en-US") {
        retryEnglish.current = true;
        return;
      }
      const iphoneApp =
        /iPhone|iPad|iPod/.test(navigator.userAgent) &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as { standalone?: boolean }).standalone === true);
      setNote(
        `${SPEECH_ERRORS[e.error] ?? "Speech recognition failed."} (${e.error})` +
          (iphoneApp
            ? " Voice often doesn't work in the iPhone Home Screen app. Open the site in Safari instead, or tap the mic on your keyboard in the box below."
            : " You can type the play instead."),
      );
    };
    r.onend = () => {
      rec.current = null;
      if (retryEnglish.current) {
        retryEnglish.current = false;
        startListening("en-US");
        return;
      }
      setListening(false);
      setLive("");
      if (heard.current) handleText(heard.current);
      else if (!failed.current)
        setNote("Didn't catch that. Hold the mic and speak.");
    };
    rec.current = r;
    setNote(null);
    setListening(true);
    navigator.vibrate?.(8);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
    }
  }

  const stopListening = () => rec.current?.stop();

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    handleText(text);
    setText("");
  }

  // ---- confirm sheet ----------------------------------------------------------------------

  const rows = (draft?.plays ?? []).map((p) => {
    const needs = playNeeds(p, ctx);
    const built = needs.length ? null : buildPlay(p, ctx);
    const isUndo = p.kind === "undo";
    return {
      p,
      needs,
      built,
      summary: isUndo
        ? `Undo: ${lastPlay ?? "nothing to undo"}`
        : built?.summary,
      errors: [
        ...(built?.errors ?? []),
        ...(isUndo && !lastPlay ? ["There's no play to undo."] : []),
      ],
      warnings: built?.warnings ?? [],
    };
  });
  const onlyUndo = rows.length === 1 && rows[0].p.kind === "undo";
  const ready =
    rows.length > 0 &&
    rows.every((r) => r.needs.length === 0 && r.errors.length === 0);

  function patch(i: number, next: Play) {
    if (!draft) return;
    setDraft({
      ...draft,
      plays: draft.plays.map((p, k) => (k === i ? next : p)),
    });
  }
  function drop(i: number) {
    if (!draft) return;
    const plays = draft.plays.filter((_, k) => k !== i);
    if (plays.length === 0) open(null);
    else setDraft({ ...draft, plays });
  }
  function confirm() {
    if (!draft || !ready) return;
    for (const r of rows) {
      if (r.p.kind === "undo") onUndo();
      else if (r.built) onCommit(r.built.events);
    }
    open(null);
    setNote(null);
  }

  // ---- nicknames --------------------------------------------------------------------------

  function addNick(e: React.FormEvent) {
    e.preventDefault();
    const alias = nickName.trim();
    if (!alias || !nickId) return;
    writeNicks([
      ...aliases.filter((a) => a.alias.toLowerCase() !== alias.toLowerCase()),
      { alias, id: nickId },
    ]);
    setNickName("");
  }
  const nameOf = (id: number) =>
    short(roster.find((p) => p.id === id)?.name ?? "?");

  return (
    <div className="glass-1 space-y-2 rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        {supported && (
          <button
            type="button"
            aria-label={
              listening ? "Listening. Release to finish" : "Hold to talk"
            }
            aria-pressed={listening}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              startListening();
            }}
            onPointerUp={stopListening}
            onPointerCancel={stopListening}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                if (!e.repeat) (rec.current ? stopListening : startListening)();
              }
            }}
            className={`flex h-12 w-full shrink-0 touch-none select-none items-center justify-center gap-2 sm:h-11 sm:w-auto whitespace-nowrap rounded-full px-4 text-sm font-semibold [-webkit-touch-callout:none] ${
              listening
                ? "scale-105 bg-loss text-white"
                : "bg-ink text-paper active:scale-95"
            } transition-transform`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            {listening ? "Listening…" : "Hold to talk"}
          </button>
        )}
        <form
          onSubmit={submitTyped}
          className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or type: Daniel scores 2, assist Joe"
            aria-label="Type a play"
            enterKeyHint="send"
            className="h-11 min-w-0 flex-1 rounded-full bg-white/70 px-4 text-sm ring-1 ring-black/5 placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-court"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-11 shrink-0 rounded-full bg-black/[0.06] px-4 text-sm font-semibold active:scale-95 disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>

      {listening && (
        <p className="px-1 text-sm font-semibold text-loss" aria-live="polite">
          {live ? `“${live}”` : "Speak now…"}
        </p>
      )}
      {note && !listening && (
        <p role="status" className="px-1 text-sm font-semibold text-muted">
          {note}
        </p>
      )}
      {!supported && (
        <p className="px-1 text-xs text-muted">
          Voice isn&apos;t available in this browser (Chrome on Android works
          best). You can still type plays.
        </p>
      )}

      <div className="px-1">
        <button
          type="button"
          onClick={() => setShowNicks((s) => !s)}
          className="text-xs font-semibold text-muted"
        >
          Nicknames {aliases.length > 0 ? `(${aliases.length})` : ""}{" "}
          {showNicks ? "▲" : "▼"}
        </button>
        {showNicks && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted">
              What people call each other out loud. Saved on this phone only.
            </p>
            <form
              onSubmit={addNick}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                value={nickName}
                onChange={(e) => setNickName(e.target.value)}
                placeholder="Nickname"
                aria-label="Nickname"
                maxLength={20}
                className="h-9 w-32 rounded-full bg-white/70 px-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-court"
              />
              <span className="text-xs text-muted">is</span>
              <select
                value={nickId}
                onChange={(e) => setNickId(Number(e.target.value))}
                aria-label="Player"
                className="h-9 rounded-full bg-white/70 px-3 text-sm ring-1 ring-black/5"
              >
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!nickName.trim()}
                className="h-9 rounded-full bg-black/[0.06] px-3 text-sm font-semibold disabled:opacity-40"
              >
                Save
              </button>
            </form>
            {aliases.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {aliases.map((a) => (
                  <li
                    key={a.alias}
                    className="flex items-center gap-1 rounded-full bg-white/70 py-1 pl-3 pr-1 text-xs font-semibold ring-1 ring-black/5"
                  >
                    {a.alias} → {nameOf(a.id)}
                    <button
                      type="button"
                      aria-label={`Remove ${a.alias}`}
                      onClick={() =>
                        writeNicks(aliases.filter((x) => x.alias !== a.alias))
                      }
                      className="rounded-full px-1.5 text-loss active:bg-loss/10"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {draft &&
        // Portaled: the glass card's backdrop-filter would otherwise trap a fixed sheet inside it.
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-end bg-ink/25 backdrop-blur-sm"
            onClick={() => open(null)}
          >
            <div
              role="dialog"
              aria-label="Confirm plays"
              onClick={(e) => e.stopPropagation()}
              className="glass-3 sheet-up mx-auto max-h-[88vh] w-full max-w-3xl space-y-3 overflow-y-auto rounded-t-[28px] p-4 pb-8"
            >
              <div className="flex items-center gap-3">
                <h2 className="min-w-0 flex-1 text-lg font-extrabold leading-tight tracking-tight">
                  {onlyUndo
                    ? "Undo the last play?"
                    : rows.length === 1
                      ? "Record this play?"
                      : `Record these ${rows.length} plays?`}
                </h2>
                <button
                  onClick={() => open(null)}
                  aria-label="Close"
                  className="rounded-full px-3 py-1 text-muted active:bg-black/5"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseVoice(reread, ctx);
                  if (parsed.plays.length)
                    setDraft({
                      heard: reread.trim(),
                      plays: parsed.plays,
                      unparsed: parsed.unparsed,
                    });
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={reread}
                  onChange={(e) => setReread(e.target.value)}
                  aria-label="What was heard"
                  className="h-10 min-w-0 flex-1 rounded-full bg-white/70 px-4 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-court"
                />
                <button
                  type="submit"
                  disabled={reread.trim() === draft.heard}
                  className="h-10 shrink-0 rounded-full bg-black/[0.06] px-4 text-sm font-semibold active:scale-95 disabled:opacity-40"
                >
                  Re-read
                </button>
              </form>

              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className="rounded-2xl bg-white/60 p-3 ring-1 ring-black/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {r.needs.length > 0 ? (
                          <>
                            <div className="text-sm font-bold">
                              {r.needs[0].label}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {r.needs[0].options.map((o) => (
                                <button
                                  key={o.value}
                                  onClick={() =>
                                    patch(
                                      i,
                                      setNeed(r.p, r.needs[0].id, o.value),
                                    )
                                  }
                                  className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-black/10 active:scale-95"
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="font-bold">{r.summary}</div>
                        )}
                        {r.errors.map((m) => (
                          <p
                            key={m}
                            className="mt-1 text-sm font-semibold text-loss"
                          >
                            {m}
                          </p>
                        ))}
                        {r.warnings.map((m) => (
                          <p
                            key={m}
                            className="mt-1 text-sm font-semibold text-sub"
                          >
                            {m}
                          </p>
                        ))}
                      </div>
                      <button
                        onClick={() => drop(i)}
                        aria-label="Remove this play"
                        className="shrink-0 rounded-full px-2 py-1 text-loss active:bg-loss/10"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {draft.unparsed.length > 0 && (
                <p className="text-sm text-muted">
                  Skipped, didn&apos;t understand:{" "}
                  {draft.unparsed.map((u) => `“${u}”`).join(", ")}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => open(null)}
                  className="min-h-12 rounded-xl bg-white/60 text-base font-semibold ring-1 ring-black/5 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={!ready}
                  className="min-h-12 rounded-xl bg-ink text-base font-semibold text-paper active:scale-[0.98] disabled:opacity-40"
                >
                  {onlyUndo
                    ? "Undo"
                    : rows.length === 1
                      ? "Record"
                      : `Record ${rows.length}`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

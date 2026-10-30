"use client";

import { useState } from "react";
import {
  isAudioMuted,
  setAudioMuted,
  playBuzzer,
  playCheer,
  playClang,
  playOnFireSound,
  playSwish,
  playWhistle,
} from "@/lib/courtAudio";

export function CourtAudioControls() {
  const [muted, setMuted] = useState<boolean>(() => isAudioMuted());
  const [open, setOpen] = useState(false);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-full bg-black/[0.06] p-1">
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? "Unmute court audio" : "Mute court audio"}
          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
            muted ? "text-muted hover:text-ink" : "bg-court-ink text-white shadow-xs"
          }`}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="px-2 py-1 text-[11px] font-bold text-muted hover:text-ink"
        >
          SFX {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="glass-2 absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl p-2.5 shadow-xl border border-black/10 space-y-1.5 animate-in fade-in duration-150">
          <div className="label px-1 text-[10px] text-muted">Court Soundboard</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={playSwish}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              🏀 Swish
            </button>
            <button
              type="button"
              onClick={playClang}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              🔔 Clang
            </button>
            <button
              type="button"
              onClick={playBuzzer}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              🚨 Buzzer
            </button>
            <button
              type="button"
              onClick={playOnFireSound}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              🔥 On Fire
            </button>
            <button
              type="button"
              onClick={playCheer}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              🎉 Cheer
            </button>
            <button
              type="button"
              onClick={playWhistle}
              className="rounded-xl bg-white/70 p-2 hover:bg-white text-left transition"
            >
              📢 Whistle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

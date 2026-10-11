"use client";

import { useState, useSyncExternalStore } from "react";

/** Recap preview with Share (the phone's share sheet, e.g. WhatsApp) and Copy. */
export function ShareRecap({ text, gameId }: { text: string; gameId: number }) {
  // navigator.share only exists in some browsers. The server render says "no", then the browser corrects it.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const full = () => `${text}\n\n${window.location.origin}/games/${gameId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 2500);
  }

  async function share() {
    try {
      await navigator.share({ text: full() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // they closed the sheet
      await copy();
    }
  }

  return (
    <section className="glass-1 space-y-3 rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="label">Game recap</h2>
        <span role="status" className="text-xs font-semibold text-muted">
          {status === "copied" && "Copied to clipboard"}
          {status === "failed" && "Couldn't copy. Select the text instead."}
        </span>
      </div>
      <pre className="whitespace-pre-wrap rounded-2xl bg-white/55 p-3 font-sans text-[13px] leading-relaxed ring-1 ring-black/5">
        {text}
      </pre>
      <div className="flex gap-2">
        {canShare && (
          <button
            onClick={share}
            className="h-11 flex-1 rounded-full bg-ink text-sm font-semibold text-paper active:scale-[0.98]"
          >
            Share
          </button>
        )}
        <button
          onClick={copy}
          className={`h-11 flex-1 rounded-full text-sm font-semibold active:scale-[0.98] ${
            canShare ? "glass-1" : "bg-ink text-paper"
          }`}
        >
          Copy recap
        </button>
      </div>
      <p className="text-[11px] font-medium text-muted">
        The link to the full box score is added when you share or copy.
      </p>
    </section>
  );
}

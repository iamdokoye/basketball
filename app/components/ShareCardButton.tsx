"use client";

import { useState, useSyncExternalStore } from "react";

/** Share (the phone's share sheet, e.g. WhatsApp) or copy a card as text, with a link to the cards page. */
export function ShareCardButton({ text, path }: { text: string; path: string }) {
  // navigator.share only exists in some browsers; the server render says "no" and the browser corrects it.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const [copied, setCopied] = useState(false);
  const full = () => `${text}\n${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing else to do */
    }
  }
  async function share() {
    try {
      await navigator.share({ text: full() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <button
      type="button"
      onClick={canShare ? share : copy}
      aria-label={canShare ? "Share this card" : "Copy this card"}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper active:scale-95"
    >
      {copied ? (
        <span aria-hidden className="text-xs font-extrabold">
          ✓
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
      )}
      <span className="sr-only">{copied ? "Copied" : canShare ? "Share" : "Copy"}</span>
    </button>
  );
}

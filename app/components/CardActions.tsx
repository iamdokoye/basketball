"use client";

import { useState } from "react";
import { cardText, type AwardCardData } from "@/lib/cards";
import { cardFileName, renderCardPng } from "./cardImage";

type Busy = null | "save" | "share";

const icon = {
  className: "h-4 w-4",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/**
 * Save the card as a picture, or share it. Sharing sends the picture itself when the phone allows it
 * (WhatsApp, Instagram...), otherwise the text and a link, otherwise it copies the text.
 */
export function CardActions({ card, sharePath }: { card: AwardCardData; sharePath: string }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);

  const say = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(null), 2200);
  };
  const link = () => `${window.location.origin}${sharePath}`;

  async function save() {
    setBusy("save");
    try {
      const blob = await renderCardPng(card);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cardFileName(card);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      say("Saved");
    } catch {
      say("Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    const text = `${cardText(card)}\n${link()}`;
    try {
      let blob: Blob | null = null;
      try {
        blob = await renderCardPng(card);
      } catch {
        /* fall back to text below */
      }
      const file = blob ? new File([blob], cardFileName(card), { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        say("Copied");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        try {
          await navigator.clipboard.writeText(text);
          say("Copied");
        } catch {
          say("Couldn't share");
        }
      }
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper active:scale-95 disabled:opacity-50";
  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={save}
        disabled={busy !== null}
        aria-label="Save this card as a picture"
        className={btn}
      >
        <svg {...icon}>
          <path d="M12 4v11M8 11l4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      </button>
      <button
        type="button"
        onClick={share}
        disabled={busy !== null}
        aria-label="Share this card"
        className={btn}
      >
        <svg {...icon}>
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
      </button>
      {note && (
        <span
          role="status"
          className="absolute -top-8 right-0 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper shadow"
        >
          {note}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import {
  boxScoreFileName,
  renderBoxScorePng,
  type BoxScoreImageData,
} from "./boxScoreImage";

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
 * Save or share the finished game as a picture. Sharing sends the PNG itself when the phone can
 * (WhatsApp, Instagram…), the text and a link when it can't, and copies the text as a last resort.
 */
export function ShareBoxScore({
  data,
  text,
  path,
}: {
  data: BoxScoreImageData;
  /** Recap text, used when pictures can't be shared. */
  text: string;
  path: string;
}) {
  // Server render says "no", then the browser corrects it.
  const canShareFiles = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);

  const say = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(null), 2400);
  };
  const link = () => `${window.location.origin}${path}`;

  async function save() {
    setBusy("save");
    try {
      const blob = await renderBoxScorePng(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = boxScoreFileName(data);
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
    const full = `${text}\n${link()}`;
    try {
      let blob: Blob | null = null;
      try {
        blob = await renderBoxScorePng(data);
      } catch {
        /* fall back to text */
      }
      const file = blob
        ? new File([blob], boxScoreFileName(data), { type: "image/png" })
        : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: full });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ text: full });
      } else {
        await navigator.clipboard.writeText(full);
        say("Copied");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        try {
          await navigator.clipboard.writeText(full);
          say("Copied");
        } catch {
          say("Couldn't share");
        }
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5">
      <div className="min-w-0">
        <div className="label text-[10px] text-muted">Box score picture</div>
        <div className="text-sm font-semibold leading-5">
          1080 × 1350, made for the group chat
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          aria-label="Save the box score as a picture"
          className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-bold text-paper active:scale-95 disabled:opacity-50"
        >
          <svg {...icon}>
            <path d="M12 4v11M8 11l4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
          Save
        </button>
        {canShareFiles && (
          <button
            type="button"
            onClick={share}
            disabled={busy !== null}
            aria-label="Share the box score as a picture"
            className="flex h-10 items-center gap-1.5 rounded-full bg-court px-3.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
          >
            <svg {...icon}>
              <path d="M12 15V4M8 8l4-4 4 4" />
              <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
            </svg>
            Share
          </button>
        )}
        {note && (
          <span
            role="status"
            className="absolute -top-8 right-0 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper shadow"
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

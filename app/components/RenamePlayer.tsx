"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { renamePlayer } from "@/lib/actions";

type Submit = (next: string) => string | null | Promise<string | null>;

/**
 * "Rename" button that opens a small glass dialog. `onSubmit` returns an error
 * message to keep the dialog open, or null to accept. It may be async (the
 * dialog shows "Saving…") or sync (the dialog closes instantly, which is what
 * lets callers apply the change optimistically).
 */
export function RenamePlayer({
  name,
  onSubmit,
  className = "",
  disabled = false,
}: {
  name: string;
  onSubmit: Submit;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.select();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function show() {
    setValue(name);
    setError(null);
    setOpen(true);
  }

  function save() {
    const next = value.trim();
    if (next === name) return setOpen(false);
    setError(null);
    startTransition(async () => {
      const err = await onSubmit(next);
      if (err) setError(err);
      else setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={show} disabled={disabled} className={`${className} disabled:opacity-40`}>
        Rename
      </button>
      {/* Portal: an ancestor with backdrop-filter would otherwise become the containing block for this fixed overlay. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/25 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <form
              role="dialog"
              aria-label={`Rename ${name}`}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="glass-3 sheet-up w-full max-w-sm space-y-4 rounded-3xl p-5"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Rename player</h2>
                <p className="text-sm text-muted">Updates every game and stat for {name}.</p>
              </div>
              <input
                ref={input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={40}
                required
                autoFocus
                aria-label="Player name"
                className="h-12 w-full rounded-xl border border-white/80 bg-white/60 px-4 text-base font-semibold text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
              />
              {error && (
                <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-12 flex-1 rounded-full bg-white/60 text-sm font-semibold ring-1 ring-black/5 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  disabled={pending || !value.trim()}
                  className="h-12 flex-1 rounded-full bg-ink text-sm font-semibold text-paper active:scale-[0.98] disabled:opacity-40"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Rename button that saves straight to the server (used where there is no local list to update). */
export function RenamePlayerButton({
  playerId,
  name,
  className,
}: {
  playerId: number;
  name: string;
  className?: string;
}) {
  return (
    <RenamePlayer
      name={name}
      className={className}
      onSubmit={async (next) => {
        const res = await renamePlayer(playerId, next);
        return res.ok ? null : res.error;
      }}
    />
  );
}

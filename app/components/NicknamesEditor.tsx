"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { setNicknames } from "@/lib/actions";
import { MAX_NICKNAMES, MAX_NICKNAME_LENGTH } from "@/lib/nicknames";

type Submit = (next: string[]) => string | null | Promise<string | null>;

/**
 * "Nicknames" button that opens a small glass dialog to add and remove a player's nicknames.
 * `onSubmit` returns an error message to keep the dialog open, or null to accept.
 */
export function NicknamesEditor({
  name,
  nicknames,
  onSubmit,
  className = "",
  disabled = false,
}: {
  name: string;
  nicknames: string[];
  onSubmit: Submit;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(nicknames);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function show() {
    setList(nicknames);
    setDraft("");
    setError(null);
    setOpen(true);
  }

  /** Moves what's typed into the list; returns the new list. */
  function withDraft(): string[] {
    const nick = draft.replace(/\s+/g, " ").trim();
    if (!nick || list.some((n) => n.toLowerCase() === nick.toLowerCase()))
      return list;
    return [...list, nick];
  }

  function add() {
    setList(withDraft());
    setDraft("");
    setError(null);
  }

  function save() {
    const next = withDraft();
    setError(null);
    startTransition(async () => {
      const err = await onSubmit(next);
      if (err) setError(err);
      else setOpen(false);
    });
  }

  const full = list.length >= MAX_NICKNAMES;

  return (
    <>
      <button
        type="button"
        onClick={show}
        disabled={disabled}
        className={`${className} disabled:opacity-40`}
      >
        Nicknames
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
              aria-label={`Nicknames for ${name}`}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="glass-3 sheet-up w-full max-w-sm space-y-4 rounded-3xl p-5"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  Nicknames
                </h2>
                <p className="text-sm text-muted">
                  What people call {name} out loud. Voice entry recognises these
                  when scoring.
                </p>
              </div>

              {list.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {list.map((n) => (
                    <li
                      key={n}
                      className="flex items-center gap-1 rounded-full bg-white/70 py-1.5 pl-3.5 pr-1.5 text-sm font-semibold ring-1 ring-black/5"
                    >
                      {n}
                      <button
                        type="button"
                        aria-label={`Remove ${n}`}
                        onClick={() => setList(list.filter((x) => x !== n))}
                        className="rounded-full px-2 text-loss active:bg-loss/10"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!full && (
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (draft.trim()) add();
                        else save();
                      }
                    }}
                    maxLength={MAX_NICKNAME_LENGTH}
                    autoFocus
                    autoComplete="off"
                    placeholder="Add a nickname"
                    aria-label="Nickname"
                    className="h-12 min-w-0 flex-1 rounded-xl border border-white/80 bg-white/60 px-4 text-base font-semibold text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
                  />
                  <button
                    type="button"
                    onClick={add}
                    disabled={!draft.trim()}
                    className="h-12 rounded-xl bg-black/[0.06] px-4 text-sm font-semibold active:scale-95 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )}
              {full && (
                <p className="text-xs text-muted">
                  That&apos;s the limit of {MAX_NICKNAMES} nicknames.
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss"
                >
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
                  disabled={pending}
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

/** Nicknames button that saves straight to the server (used where there is no local list to update). */
export function NicknamesButton({
  playerId,
  name,
  nicknames,
  className,
}: {
  playerId: number;
  name: string;
  nicknames: string[];
  className?: string;
}) {
  return (
    <NicknamesEditor
      name={name}
      nicknames={nicknames}
      className={className}
      onSubmit={async (next) => {
        const res = await setNicknames(playerId, next);
        return res.ok ? null : res.error;
      }}
    />
  );
}

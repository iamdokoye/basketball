"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/app/components/Avatar";

type Option = { id: number; name: string };

/**
 * "Add a player" control: a button that opens a sheet with a search box and the players still
 * available. Replaces a native <select>, which can't be searched, shows no avatars and looks different on
 * every phone. Keyboard: type to filter, Up/Down to move, Enter to pick, Esc to close.
 */
export function PlayerPicker({
  label,
  accent,
  options,
  onPick,
  disabledReason,
}: {
  /** Shown on the button and as the sheet's title, e.g. "Team A". */
  label: string;
  accent: "court" | "away";
  options: Option[];
  onPick: (id: number) => void;
  /** When set, the button is disabled and shows this instead of the prompt. */
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const active = Math.min(cursor, Math.max(0, shown.length - 1));

  function show() {
    setQuery("");
    setCursor(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function pick(o: Option) {
    setOpen(false);
    onPick(o.id);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    // Don't pop the on-screen keyboard open on a phone; a mouse or keyboard user can type straight away.
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(shown.length - 1, active + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, active - 1));
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    }
  }

  const dot = accent === "court" ? "bg-court" : "bg-away";
  const disabled = Boolean(disabledReason) || options.length === 0;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        disabled={disabled}
        aria-haspopup="dialog"
        className="glass-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
      >
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0 flex-1 truncate">
          {disabledReason ?? (options.length === 0 ? "Everyone is added" : `Add a player to ${label}`)}
        </span>
        {!disabled && (
          <span className="tabular rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-bold text-muted">
            {options.length}
          </span>
        )}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Portal: an ancestor with backdrop-filter would otherwise become the containing block for this fixed overlay. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Add a player to ${label}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKey}
              className="glass-3 sheet-up flex max-h-[80dvh] w-full max-w-md flex-col gap-3 rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  Add to {label}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="-mr-1 grid h-9 w-9 place-items-center rounded-full text-muted active:bg-black/5"
                >
                  ✕
                </button>
              </div>

              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                type="search"
                inputMode="search"
                enterKeyHint="done"
                autoComplete="off"
                placeholder="Search players"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-list`}
                aria-activedescendant={shown[active] ? `${id}-opt-${shown[active].id}` : undefined}
                aria-label="Search players"
                className="h-12 w-full shrink-0 rounded-xl border border-white/80 bg-white/60 px-4 text-base font-semibold text-ink shadow-inner outline-none placeholder:font-medium placeholder:text-muted focus:ring-2 focus:ring-court"
              />

              {shown.length === 0 ? (
                <p className="rounded-2xl bg-black/[0.04] p-5 text-center text-sm text-muted">
                  No player matches &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                <ul
                  ref={list}
                  id={`${id}-list`}
                  role="listbox"
                  aria-label="Players"
                  className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-1"
                >
                  {shown.map((o, i) => (
                    <li
                      key={o.id}
                      id={`${id}-opt-${o.id}`}
                      role="option"
                      aria-selected={i === active}
                      onPointerMove={() => i !== active && setCursor(i)}
                      onClick={() => pick(o)}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 font-semibold transition-colors ${
                        i === active ? "bg-white shadow-sm ring-1 ring-black/5" : ""
                      }`}
                    >
                      <Avatar id={o.id} name={o.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

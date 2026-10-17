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
  buttonLabel,
  title,
  onCreate,
  compact = false,
  busy = false,
}: {
  /** Shown on the button and as the sheet's title, e.g. "Team A". */
  label: string;
  accent: "court" | "away";
  options: Option[];
  onPick: (id: number) => void;
  /** When set, the button is disabled and shows this instead of the prompt. */
  disabledReason?: string;
  /** Replaces the default button text ("Add a player to {label}"). */
  buttonLabel?: string;
  /** Replaces the default sheet title ("Add to {label}"). */
  title?: string;
  /** When given, typing a name that isn't in the list offers to add it as a new player. */
  onCreate?: (name: string) => void;
  compact?: boolean;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  type Item = { kind: "player"; o: Option } | { kind: "create"; name: string };
  const shown: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    const items: Item[] = found.map((o) => ({ kind: "player", o }));
    // A name that matches nobody exactly can be added as a new player (a guest who isn't in the league yet).
    const exact = options.some((o) => o.name.toLowerCase() === q);
    if (onCreate && q && !exact) items.push({ kind: "create", name: query.trim() });
    return items;
  }, [options, query, onCreate]);
  const active = Math.min(cursor, Math.max(0, shown.length - 1));
  const itemKey = (it: Item) => (it.kind === "player" ? `p${it.o.id}` : "create");

  function show() {
    setQuery("");
    setCursor(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function pick(it: Item) {
    setOpen(false);
    if (it.kind === "player") onPick(it.o.id);
    else onCreate?.(it.name);
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
  const disabled = Boolean(disabledReason) || busy || (options.length === 0 && !onCreate);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        disabled={disabled}
        aria-haspopup="dialog"
        className={`glass-1 flex w-full items-center gap-3 rounded-2xl px-3.5 text-left font-semibold transition active:scale-[0.99] disabled:opacity-50 ${compact ? "h-10 text-xs" : "h-12 text-sm"}`}
      >
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0 flex-1 truncate">
          {busy
            ? "Adding…"
            : (disabledReason ??
              buttonLabel ??
              (options.length === 0 ? "Everyone is added" : `Add a player to ${label}`))}
        </span>
        {!disabled && !buttonLabel && (
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
              aria-label={title ?? `Add a player to ${label}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKey}
              className="glass-3 sheet-up flex max-h-[80dvh] w-full max-w-md flex-col gap-3 rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  {title ?? `Add to ${label}`}
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
                placeholder={onCreate ? "Search, or type a new name" : "Search players"}
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-list`}
                aria-activedescendant={shown[active] ? `${id}-opt-${itemKey(shown[active])}` : undefined}
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
                  {shown.map((it, i) => (
                    <li
                      key={itemKey(it)}
                      id={`${id}-opt-${itemKey(it)}`}
                      role="option"
                      aria-selected={i === active}
                      onPointerMove={() => i !== active && setCursor(i)}
                      onClick={() => pick(it)}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 font-semibold transition-colors ${
                        i === active ? "bg-white shadow-sm ring-1 ring-black/5" : ""
                      }`}
                    >
                      {it.kind === "player" ? (
                        <>
                          <Avatar id={it.o.id} name={it.o.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{it.o.name}</span>
                        </>
                      ) : (
                        <>
                          <span
                            aria-hidden
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sub/15 text-sm font-extrabold text-sub"
                          >
                            +
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            Add &ldquo;{it.name}&rdquo; as a new player
                          </span>
                        </>
                      )}
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

"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "pl-install-dismissed";
const noop = () => () => {};

type InstallPrompt = Event & { prompt: () => Promise<void> };

function useStore<T>(
  subscribe: (cb: () => void) => () => void,
  get: () => T,
  server: T,
): T {
  return useSyncExternalStore(subscribe, get, () => server);
}

/**
 * "Add to Home Screen" tip. Android/Chrome gets a real Install button; iPhone Safari gets the
 * Share-menu steps. Hidden once installed, and after it's dismissed.
 */
export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  const standalone = useStore(
    noop,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    true,
  );
  const isIos = useStore(
    noop,
    () => /iPhone|iPad|iPod/.test(navigator.userAgent),
    false,
  );
  const dismissed = useStore(
    (cb) => {
      window.addEventListener("pl-install-dismiss", cb);
      return () => window.removeEventListener("pl-install-dismiss", cb);
    },
    () => {
      try {
        return localStorage.getItem(KEY) === "1";
      } catch {
        return false;
      }
    },
    true,
  );

  // Chrome offers the install prompt as an event; keep it so our button can trigger it.
  useStore(
    (cb) => {
      const h = (e: Event) => {
        e.preventDefault();
        setPrompt(e as InstallPrompt);
        cb();
      };
      window.addEventListener("beforeinstallprompt", h);
      return () => window.removeEventListener("beforeinstallprompt", h);
    },
    () => null,
    null,
  );

  if (standalone || dismissed || (!prompt && !isIos)) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("pl-install-dismiss"));
  }

  return (
    <div className="glass-1 flex items-start gap-3 rounded-2xl p-3.5">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-court-soft text-white"
        aria-hidden
      >
        🏀
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">Add to Home Screen</div>
        <p className="text-xs font-medium text-muted">
          {prompt
            ? "Full-screen scoring, one tap from your phone."
            : "Tap the Share button in Safari, then “Add to Home Screen”, for full-screen scoring."}
        </p>
        {prompt && (
          <button
            onClick={async () => {
              await prompt.prompt();
              setPrompt(null);
            }}
            className="mt-2 h-9 rounded-full bg-ink px-4 text-xs font-semibold text-paper active:scale-95"
          >
            Install
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="-m-1 rounded-full px-2 py-1 text-muted active:bg-black/5"
      >
        ✕
      </button>
    </div>
  );
}

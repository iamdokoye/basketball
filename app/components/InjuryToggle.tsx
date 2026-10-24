"use client";

import { useState, useTransition } from "react";
import { setPlayerInjured } from "@/lib/actions";

export function InjuryToggle({
  playerId,
  injured: initialInjured,
  name,
  className = "",
  compact = false,
  onToggle,
}: {
  playerId: number;
  injured: boolean;
  name: string;
  className?: string;
  compact?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const [injured, setInjured] = useState(initialInjured);
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !injured;
    setInjured(next);
    onToggle?.(next);
    startTransition(async () => {
      const res = await setPlayerInjured(playerId, next);
      if (!res.ok) {
        // Revert on error
        setInjured(!next);
        onToggle?.(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={playerId < 0 || pending}
      aria-label={injured ? `Mark ${name} as active` : `Mark ${name} as injured`}
      className={`tabular inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 ${className}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${injured ? "bg-rose-500" : "bg-emerald-500"}`}
        aria-hidden
      />
      {compact ? (
        injured ? "INJ" : "Active"
      ) : (
        injured ? "Mark Active" : "Mark Injured"
      )}
      {pending && <span className="text-[10px] opacity-60">…</span>}
    </button>
  );
}

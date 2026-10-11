"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const two = (n: number) => String(n).padStart(2, "0");

export function formatRemaining(ms: number, compact = false): string {
  const { d, h, m, s } = parts(ms);
  if (d > 0) return compact ? `${d}d ${h}h` : `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m${compact ? "" : ` ${two(s)}s`}`;
  return `${m}m ${two(s)}s`;
}

/**
 * Live countdown to `target` (epoch ms). It measures against the server's clock
 * (`serverNow`) so a wrong phone clock can't show the wrong time, and it refreshes
 * the page when it reaches zero so the UI flips between open and closed by itself.
 */
export function Countdown({
  target,
  serverNow,
  compact = false,
  className = "",
}: {
  target: number;
  serverNow: number;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  // Start from the server's clock so the first client render matches the server HTML.
  const [now, setNow] = useState(serverNow);
  const offset = useRef<number | null>(null);

  useEffect(() => {
    offset.current = serverNow - Date.now();
    const tick = () => setNow(Date.now() + (offset.current ?? 0));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverNow]);

  const remaining = target - now;

  useEffect(() => {
    if (remaining > 0) return;
    // Zero reached: ask the server again (retry shortly in case its clock is a beat behind).
    router.refresh();
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [remaining > 0, router]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`tabular ${className}`} suppressHydrationWarning>
      {remaining > 0 ? formatRemaining(remaining, compact) : "now"}
    </span>
  );
}

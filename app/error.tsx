"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown inside the normal layout when a page fails to render (usually the database being briefly
 * unreachable from the server). `retry()` re-renders the segment without a full reload.
 */
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Goes to the server logs (or the browser console in development).
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error
      ? (error as Error & { digest?: string }).digest
      : undefined;

  return (
    <div className="mx-auto max-w-md space-y-5 py-10">
      <div className="glass-2 space-y-4 rounded-3xl p-6 text-center">
        <div className="text-4xl" aria-hidden>
          🏀
        </div>
        <h1 className="text-[26px] font-extrabold leading-8 tracking-tight">
          We lost the ball
        </h1>
        <p className="text-sm text-muted">
          Something went wrong loading this page. The league server may be
          briefly unreachable — check your signal and try again.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-full bg-ink text-sm font-semibold text-paper active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="grid h-11 place-items-center rounded-full glass-1 text-sm font-semibold active:scale-[0.98]"
          >
            Back to Home
          </Link>
        </div>
        {digest && (
          <p className="text-[11px] font-medium text-muted">
            If it keeps happening, send this code:{" "}
            <span className="font-mono">{digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}

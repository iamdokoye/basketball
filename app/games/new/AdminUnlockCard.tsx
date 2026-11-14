"use client";

import { useActionState } from "react";
import Link from "next/link";
import { adminLogin } from "@/lib/actions";
import { Countdown } from "@/app/components/Countdown";

export function AdminUnlockCard({
  returnTo,
  opensAt,
  windowLabel,
  serverNow,
  adminConfigured,
}: {
  returnTo: string;
  opensAt: number | null;
  windowLabel: string;
  serverNow: number;
  adminConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(adminLogin, undefined);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="glass-1 space-y-4 rounded-3xl p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-2xl shadow-inner">
          👑
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight">Admin Late Game Unlock</h2>
          <p className="text-xs text-muted">
            League scoring is currently outside regular open hours ({windowLabel}).
          </p>
        </div>

        {opensAt && (
          <div className="rounded-2xl bg-black/[0.04] p-3">
            <div className="text-[11px] font-semibold text-muted">Next regular window opens in</div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-ink">
              <Countdown target={opensAt} serverNow={serverNow} />
            </div>
          </div>
        )}

        {adminConfigured ? (
          <form action={action} className="space-y-3 pt-2 text-left">
            <input type="hidden" name="returnTo" value={returnTo} />
            <div>
              <label className="label mb-1 block text-muted" htmlFor="admin-unlock-password">
                Admin Password
              </label>
              <input
                id="admin-unlock-password"
                name="password"
                type="password"
                required
                autoFocus
                placeholder="Enter password to authorize…"
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-white/80 bg-white/60 px-4 text-base font-semibold text-ink shadow-inner outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-court"
              />
            </div>
            {state?.error && (
              <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
                {state.error}
              </p>
            )}
            <button
              disabled={pending}
              className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper shadow-md transition active:scale-[0.99] disabled:opacity-50"
            >
              {pending ? "Unlocking…" : "Unlock & Start Late Game"}
            </button>
          </form>
        ) : (
          <p className="rounded-xl bg-loss/10 p-3 text-xs font-semibold text-loss">
            Admin access is not configured on this server (ADMIN_PASSWORD is unset).
          </p>
        )}

        <div className="pt-2">
          <Link
            href="/games"
            className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            ← Back to all games
          </Link>
        </div>
      </div>
    </div>
  );
}

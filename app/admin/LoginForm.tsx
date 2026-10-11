"use client";

import { useActionState } from "react";
import { adminLogin } from "@/lib/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="glass-2 space-y-3 rounded-2xl p-4">
      <label className="label block text-muted" htmlFor="password">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="h-12 w-full rounded-xl border border-white/80 bg-white/60 px-4 text-base font-semibold text-ink shadow-inner outline-none focus:ring-2 focus:ring-court"
      />
      {state?.error && (
        <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

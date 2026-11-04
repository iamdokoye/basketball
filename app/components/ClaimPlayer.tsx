"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimPlayer, releasePlayer } from "@/lib/meActions";
import { ME_BACKUP_KEY } from "@/lib/identityShared";
import { PlayerPicker } from "@/app/components/PlayerPicker";

function setBackup(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(ME_BACKUP_KEY);
    else localStorage.setItem(ME_BACKUP_KEY, String(id));
  } catch {
    /* blocked storage: the cookie alone still works */
  }
}

/** "I'm…" button: pick your name and this device remembers you. */
export function ClaimPlayer({
  options,
  buttonLabel = "I'm…",
  title = "Who are you?",
}: {
  options: { id: number; name: string }[];
  buttonLabel?: string;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(id: number) {
    setError(null);
    startTransition(async () => {
      const r = await claimPlayer(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBackup(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <PlayerPicker
        label="You"
        accent="court"
        options={options}
        onPick={pick}
        buttonLabel={buttonLabel}
        title={title}
        busy={pending}
      />
      {error && (
        <p role="alert" className="px-1 text-sm font-medium text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Not you?": forget this device's player so someone else can pick their name. */
export function SwitchPlayer({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await releasePlayer();
          setBackup(null);
          router.refresh();
        })
      }
    >
      {pending ? "Switching…" : "Not you? Switch"}
    </button>
  );
}

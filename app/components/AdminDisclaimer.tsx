import Link from "next/link";

/** Full-screen disclaimer screen for locked slideshows. */
export function AdminDisclaimerScreen({
  title,
  periodLabel,
  description,
  confirmHref,
  backHref,
}: {
  title: string;
  periodLabel: string;
  description?: string;
  confirmHref: string;
  backHref: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="glass-2 sheet-up w-full max-w-md space-y-5 rounded-3xl p-6 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 text-3xl">
          ⚠️
        </div>

        <div className="space-y-2">
          <div className="label text-xs uppercase tracking-wider text-amber-600">
            Admin Preview · Locked Content
          </div>
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="text-sm font-semibold text-court-ink">{periodLabel}</p>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          {description ??
            "This period is currently active and locked for regular users. Viewing the recap slideshow early will reveal provisional standings, award winners, and spoilers before the period concludes."}
        </p>

        <div className="rounded-2xl bg-amber-500/10 p-3 text-xs font-bold text-amber-800">
          Do you really want to view this locked slideshow now?
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={confirmHref}
            className="grid h-12 place-items-center rounded-full bg-ink px-6 text-sm font-bold text-paper shadow-md transition hover:bg-black/85 active:scale-95"
          >
            ▶ Yes, reveal & start slideshow
          </Link>
          <Link
            href={backHref}
            className="grid h-11 place-items-center rounded-full bg-black/[0.05] px-6 text-xs font-bold text-muted transition hover:bg-black/[0.08] hover:text-ink active:scale-95"
          >
            ← Keep locked & go back
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Inline disclaimer banner for locked cards or awards. */
export function AdminDisclaimerBanner({
  isUnlocked,
  unlockHref,
  lockHref,
  periodName,
  reason,
}: {
  isUnlocked: boolean;
  unlockHref: string;
  lockHref: string;
  periodName: string;
  reason?: string;
}) {
  if (isUnlocked) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/15 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/30">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base">
            ⚠️
          </span>
          <span>
            <b>Admin Preview Active:</b> You are viewing locked content for{" "}
            <b>{periodName}</b>. Regular users see this as locked.
          </span>
        </div>
        <Link
          href={lockHref}
          className="shrink-0 rounded-full bg-amber-900/10 px-3 py-1 font-bold text-amber-950 transition hover:bg-amber-900/20 active:scale-95"
        >
          Hide spoilers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/25">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="text-lg">
          🔒
        </span>
        <div className="space-y-0.5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
            Admin Preview Option
          </div>
          <p className="text-xs font-medium text-amber-900">
            {reason ??
              `This content is locked for normal users until the period ends.`}{" "}
            As admin, do you really want to view and confirm this display early?
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={unlockHref}
          className="rounded-full bg-amber-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-800 active:scale-95"
        >
          ⚠️ Yes, preview locked content
        </Link>
      </div>
    </div>
  );
}

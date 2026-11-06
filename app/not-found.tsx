import Link from "next/link";

/** 404, for a bad link or a game/player that no longer exists. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-5 py-10">
      <div className="glass-2 space-y-4 rounded-3xl p-6 text-center">
        <div className="text-4xl" aria-hidden>
          🏀
        </div>
        <h1 className="text-[26px] font-extrabold leading-8 tracking-tight">
          Air ball
        </h1>
        <p className="text-sm text-muted">
          That page doesn&apos;t exist. It may have been deleted, or the link
          may be wrong.
        </p>
        <Link
          href="/"
          className="grid h-11 place-items-center rounded-full bg-ink text-sm font-semibold text-paper active:scale-[0.98]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

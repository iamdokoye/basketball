import Link from "next/link";
import { getAccess } from "@/lib/access";
import { Countdown } from "./Countdown";

const LOCK = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Header pill that says what visitors can do right now. Links to the admin page. */
export async function AccessBadge() {
  const a = await getAccess();
  const base = "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold";

  if (a.isAdmin) {
    return (
      <Link href="/admin" className={`${base} bg-ink text-paper`}>
        {LOCK} Admin
      </Link>
    );
  }
  if (a.windowOpen) {
    return (
      <Link href="/admin" className={`${base} bg-win/15 text-emerald-800 ring-1 ring-win/30`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
        Open · closes in{" "}
        {a.closesAt ? <Countdown target={a.closesAt} serverNow={a.now} compact /> : a.windowEnds}
      </Link>
    );
  }
  return (
    <Link href="/admin" className={`${base} bg-black/[0.06] text-muted`}>
      {LOCK}
      {a.opensAt ? (
        <span>
          Opens in <Countdown target={a.opensAt} serverNow={a.now} compact />
        </span>
      ) : (
        "View only"
      )}
    </Link>
  );
}

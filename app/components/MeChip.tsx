import Link from "next/link";
import { getMe } from "@/lib/identity";
import { Avatar } from "./Avatar";

/** Header shortcut to the personal page: your initials once this device knows you, a prompt before. */
export async function MeChip() {
  const me = await getMe();

  if (!me) {
    return (
      <Link
        href="/me"
        aria-label="Who are you? Pick your name"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.06] text-muted transition active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href="/me"
      aria-label={`${me.name}: your page`}
      className="shrink-0 rounded-full transition active:scale-95"
    >
      <Avatar name={me.name} size="md" tone="ink" />
    </Link>
  );
}

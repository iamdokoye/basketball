"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5V21H3z" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5 7 21l5-3 5 3-2-7.5" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14c2.5 0 4 1.8 4 4" />
    </>
  ),
};

const TABS: { href: string; label: string; icon: keyof typeof ICONS }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rankings", label: "Rankings", icon: "trophy" },
  { href: "/records", label: "Records", icon: "medal" },
  { href: "/games", label: "Games", icon: "ball" },
  { href: "/players", label: "Players", icon: "users" },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

export function TopNav() {
  const active = useActive();
  return (
    <nav
      className="hidden gap-0.5 rounded-full bg-black/[0.05] p-1 text-[13px] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] md:flex"
      aria-label="Main"
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active(t.href) ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 transition-colors ${
            active(t.href) ? "bg-ink text-paper shadow-sm" : "text-muted hover:bg-white/60 hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const active = useActive();
  return (
    <nav
      aria-label="Main"
      className="glass-2 fixed inset-x-4 bottom-4 z-30 mx-auto max-w-sm rounded-full p-1.5 md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 gap-1">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${
                active(t.href) ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              <Icon name={t.icon} />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

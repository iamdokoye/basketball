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
      className="h-6 w-6"
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
    <nav className="hidden gap-1 text-sm font-semibold md:flex" aria-label="Main">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active(t.href) ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 ${
            active(t.href) ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-200"
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
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                active(t.href) ? "text-court" : "text-stone-500"
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

"use client";

import { useEffect, useRef, useState } from "react";
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
  grid: (
    <>
      <rect width="6" height="6" x="3.5" y="3.5" rx="1.5" />
      <rect width="6" height="6" x="14.5" y="3.5" rx="1.5" />
      <rect width="6" height="6" x="14.5" y="14.5" rx="1.5" />
      <rect width="6" height="6" x="3.5" y="14.5" rx="1.5" />
    </>
  ),
};

const MAIN_TABS: { href: string; label: string; icon: keyof typeof ICONS }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/games", label: "Games", icon: "ball" },
  { href: "/rankings", label: "Rankings", icon: "trophy" },
  { href: "/players", label: "Players", icon: "users" },
];

export const MORE_SECTIONS = [
  {
    heading: "Court & Matchups",
    items: [
      {
        href: "/tournaments",
        label: "Tournaments",
        sub: "King of the Court & brackets",
        emoji: "👑",
      },
      {
        href: "/builder",
        label: "Team Builder",
        sub: "Fair 3v3 squads & live draft",
        emoji: "⚖️",
      },
      {
        href: "/around-the-world",
        label: "Around the World",
        sub: "Spot shooting & drill contest",
        emoji: "🌍",
      },
      {
        href: "/compare",
        label: "Tale of the Tape",
        sub: "Head-to-head rivalry",
        emoji: "⚔️",
      },
    ],
  },
  {
    heading: "League & Honors",
    items: [
      {
        href: "/mvp",
        label: "MVPs & Awards",
        sub: "Yearly, quarterly, weekly",
        emoji: "🏆",
      },
      {
        href: "/records",
        label: "Records & Clutch",
        sub: "Highs, streaks & game-winners",
        emoji: "🏅",
      },
      {
        href: "/standings",
        label: "Standings",
        sub: "Season ladder & form",
        emoji: "📊",
      },
      {
        href: "/chemistry",
        label: "Duos & Rivals",
        sub: "Teammate synergy & chemistry",
        emoji: "🤝",
      },
      {
        href: "/cards",
        label: "Title Cards",
        sub: "Recap shows & award cards",
        emoji: "🎴",
      },
      {
        href: "/digest",
        label: "Weekly Digest",
        sub: "Group chat shareables",
        emoji: "📰",
      },
    ],
  },
];

const ALL_MORE_HREFS = MORE_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

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
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMoreActive = ALL_MORE_HREFS.some((href) => path.startsWith(href));

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on route change during render
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setOpen(false);
  }

  return (
    <div className="relative hidden md:block" ref={dropdownRef}>
      <nav
        className="flex items-center gap-0.5 rounded-full bg-black/[0.05] p-1 text-[13px] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]"
        aria-label="Main"
      >
        {MAIN_TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active(t.href) ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              active(t.href)
                ? "bg-ink text-paper shadow-xs"
                : "text-muted hover:bg-white/60 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}

        {/* More dropdown trigger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-colors ${
            isMoreActive || open
              ? "bg-ink text-paper shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink"
          }`}
        >
          <span>More</span>
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </nav>

      {/* Desktop Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 overflow-hidden rounded-3xl p-3 bg-white/98 backdrop-blur-3xl border border-white/80 shadow-[0_24px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-3">
            {MORE_SECTIONS.map((sec) => (
              <div key={sec.heading} className="space-y-1">
                <div className="label px-2 text-[10px] text-muted">{sec.heading}</div>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const isActive = path.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-2xl p-2 transition ${
                          isActive
                            ? "bg-court-soft/15 text-court-ink font-bold"
                            : "hover:bg-black/[0.05] text-ink"
                        }`}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/[0.04] text-base">
                          {item.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">{item.label}</div>
                          <div className="truncate text-[10px] text-muted">{item.sub}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BottomNav() {
  const active = useActive();
  const path = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMoreActive = ALL_MORE_HREFS.some((href) => path.startsWith(href));

  // Close sheet on route change during render
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setSheetOpen(false);
  }

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [sheetOpen]);

  return (
    <>
      <nav
        aria-label="Main"
        className="glass-2 fixed inset-x-4 bottom-4 z-30 mx-auto max-w-sm rounded-full p-1.5 md:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 gap-1">
          {MAIN_TABS.map((t) => (
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

          {/* More / Hub Trigger */}
          <li>
            <button
              type="button"
              onClick={() => setSheetOpen(!sheetOpen)}
              aria-expanded={sheetOpen}
              className={`flex w-full flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${
                isMoreActive || sheetOpen ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              <Icon name="grid" />
              Hub
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile Hub Bottom Sheet Modal */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />

          {/* Sheet Content */}
          <div
            className="relative z-50 max-h-[82vh] overflow-y-auto rounded-t-3xl p-5 pb-24 bg-white/96 backdrop-blur-3xl border-t border-white/80 shadow-[0_-20px_50px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
          >
            {/* Sheet Handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/20" />

            <div className="flex items-center justify-between pb-3">
              <div>
                <h2 className="text-lg font-black tracking-tight">League Hub</h2>
                <p className="text-xs text-muted">All tools, tourneys, honors &amp; stats</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {MORE_SECTIONS.map((sec) => (
                <div key={sec.heading} className="space-y-1.5">
                  <h3 className="label px-1 text-[11px] text-muted">{sec.heading}</h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {sec.items.map((item) => {
                      const isActive = path.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-2xl p-3 transition active:scale-[0.99] ${
                            isActive
                              ? "bg-court-soft/20 text-court-ink font-bold border border-court-soft/30"
                              : "bg-white/60 hover:bg-white text-ink border border-black/5"
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.04] text-lg">
                            {item.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-extrabold leading-tight">{item.label}</div>
                            <div className="truncate text-xs text-muted">{item.sub}</div>
                          </div>
                          <span className="text-muted/50 text-xs">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

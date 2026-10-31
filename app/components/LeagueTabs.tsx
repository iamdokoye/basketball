import Link from "next/link";

/** Rankings | Standings switch shown at the top of both pages, keeping the chosen period. */
export function LeagueTabs({
  active,
  keep = {},
}: {
  active: "rankings" | "standings";
  /** Query parameters carried across (view and p). */
  keep?: Record<string, string>;
}) {
  const q = new URLSearchParams(keep).toString();
  const suffix = q ? `?${q}` : "";
  const items = [
    { id: "rankings", label: "Rankings", sub: "Stats & rating", href: `/rankings${suffix}` },
    { id: "standings", label: "Standings", sub: "Wins & form", href: `/standings${suffix}` },
  ] as const;
  return (
    <nav aria-label="League tables" className="glass-2 grid grid-cols-2 gap-1 rounded-2xl p-1">
      {items.map((it) =>
        it.id === active ? (
          <span
            key={it.id}
            aria-current="page"
            className="rounded-xl bg-ink px-3 py-2 text-center text-paper shadow-sm"
          >
            <span className="block text-sm font-bold leading-4">{it.label}</span>
            <span className="block text-[10px] font-medium opacity-70">{it.sub}</span>
          </span>
        ) : (
          <Link
            key={it.id}
            href={it.href}
            className="rounded-xl px-3 py-2 text-center text-muted active:bg-black/5"
          >
            <span className="block text-sm font-bold leading-4 text-ink">{it.label}</span>
            <span className="block text-[10px] font-medium">{it.sub}</span>
          </Link>
        ),
      )}
    </nav>
  );
}

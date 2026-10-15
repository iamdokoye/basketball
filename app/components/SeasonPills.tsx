import Link from "next/link";

/** Season picker: one pill per season (newest first) plus All time. Plain links, so it works without JavaScript. */
export function SeasonPills({
  basePath,
  seasons,
  active,
  extra = {},
}: {
  basePath: string;
  seasons: { key: string; label: string }[];
  active: string;
  /** Other query parameters to keep when switching season (e.g. the rankings sort). */
  extra?: Record<string, string>;
}) {
  const items = [...seasons, { key: "all", label: "All time" }];
  const href = (key: string) => {
    const q = new URLSearchParams({ ...extra, season: key }).toString();
    return `${basePath}?${q}`;
  };
  return (
    <nav
      aria-label="Season"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((s) =>
        s.key === active ? (
          <span
            key={s.key}
            aria-current="page"
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper shadow-sm"
          >
            {s.label}
          </span>
        ) : (
          <Link
            key={s.key}
            href={href(s.key)}
            className="glass-1 shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-muted"
          >
            {s.label}
          </Link>
        ),
      )}
    </nav>
  );
}

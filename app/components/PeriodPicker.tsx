import Link from "next/link";
import type { PeriodView, ResolvedPeriod } from "@/lib/periods";

/**
 * Week / Month / Year / All time tabs, then the periods inside the chosen one (e.g. each week).
 * Plain links, so it works without JavaScript. `extra` keeps other query parameters (like the sort).
 */
export function PeriodPicker({
  basePath,
  period,
  extra = {},
}: {
  basePath: string;
  period: ResolvedPeriod;
  extra?: Record<string, string>;
}) {
  const href = (view: PeriodView, p?: string) => {
    const q = new URLSearchParams({ ...extra, view });
    if (p) q.set("p", p);
    return `${basePath}?${q.toString()}`;
  };
  const tabs: { view: PeriodView; label: string }[] = [
    { view: "week", label: "Week" },
    { view: "month", label: "Month" },
    { view: "year", label: period.yearTabLabel },
    { view: "all", label: "All time" },
  ];

  return (
    <div className="space-y-2.5">
      <nav
        aria-label="Period"
        className="glass-1 grid grid-cols-4 gap-1 rounded-full p-1"
      >
        {tabs.map((t) =>
          t.view === period.view ? (
            <span
              key={t.view}
              aria-current="page"
              className="rounded-full bg-ink py-2 text-center text-xs font-semibold text-paper shadow-sm"
            >
              {t.label}
            </span>
          ) : (
            <Link
              key={t.view}
              href={href(t.view)}
              className="rounded-full py-2 text-center text-xs font-semibold text-muted active:bg-black/5"
            >
              {t.label}
            </Link>
          ),
        )}
      </nav>

      {period.options.length > 1 && (
        <nav
          aria-label={`${period.view} to show`}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {period.options.map((o) =>
            o.key === period.key ? (
              <span
                key={o.key}
                aria-current="page"
                className="shrink-0 rounded-full bg-court-ink px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                {o.label}
              </span>
            ) : (
              <Link
                key={o.key}
                href={href(period.view, o.key)}
                className="glass-1 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted"
              >
                {o.label}
              </Link>
            ),
          )}
        </nav>
      )}
    </div>
  );
}

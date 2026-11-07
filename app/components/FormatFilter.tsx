import Link from "next/link";
import { type GameFormat, FORMAT_LABELS } from "@/lib/gameFormat";

export function FormatFilter({
  basePath,
  active = "all",
  counts,
  keep = {},
}: {
  basePath: string;
  active?: GameFormat;
  counts?: { all: number; target: number; timed: number };
  keep?: Record<string, string>;
}) {
  const formats: GameFormat[] = ["all", "target", "timed"];

  const href = (f: GameFormat) => {
    const q = new URLSearchParams(keep);
    if (f !== "all") {
      q.set("format", f);
    } else {
      q.delete("format");
    }
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1 shrink-0">
        Mode:
      </span>
      {formats.map((f) => {
        const isCurrent = active === f;
        const count = counts ? counts[f] : undefined;
        const item = FORMAT_LABELS[f];

        return isCurrent ? (
          <span
            key={f}
            aria-current="page"
            className="flex items-center gap-1.5 shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper shadow-sm"
          >
            <span>{item.label}</span>
            {count !== undefined && (
              <span className="rounded-full bg-paper/25 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-paper">
                {count}
              </span>
            )}
          </span>
        ) : (
          <Link
            key={f}
            href={href(f)}
            className="glass-1 flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink active:scale-95"
          >
            <span>{item.label}</span>
            {count !== undefined && (
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

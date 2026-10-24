import Link from "next/link";
import { Avatar } from "@/app/components/Avatar";
import type { UpcomingMilestone } from "@/lib/milestones";

export function MilestoneWatch({
  milestones,
}: {
  milestones: UpcomingMilestone[];
}) {
  if (milestones.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            🎯
          </span>
          <h2 className="label">Milestone Watch</h2>
        </div>
        <span className="text-xs font-semibold text-muted">Approaching history</span>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {milestones.slice(0, 8).map((m) => (
          <Link
            key={`${m.playerId}-${m.category}-${m.target}`}
            href={`/players/${m.playerId}`}
            className="glass-1 flex w-52 shrink-0 snap-start flex-col justify-between rounded-2xl p-3.5 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-court-ink">
                <span aria-hidden>{m.emoji}</span>
                <span>{m.target} {m.categoryLabel}</span>
              </span>
              <Avatar id={m.playerId} name={m.playerName} size="sm" />
            </div>

            <div className="my-2.5">
              <div className="truncate font-extrabold text-ink">
                {m.playerName}
              </div>
              <div className="tabular text-xs font-semibold text-muted">
                Needs{" "}
                <span className="font-extrabold text-court-ink">
                  {m.remaining}
                </span>{" "}
                more ({m.current}/{m.target})
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-court to-court-soft transition-all"
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <div className="tabular text-right text-[10px] font-bold text-muted">
                {m.pct}% complete
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

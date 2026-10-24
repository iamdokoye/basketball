import type { PlayerMilestoneProgress } from "@/lib/milestones";

export function PlayerMilestonesCard({
  milestones,
}: {
  milestones: PlayerMilestoneProgress[];
}) {
  const activeTargets = milestones.filter((m) => m.current > 0 || m.remaining > 0);
  const totalAchieved = milestones.reduce((sum, m) => sum + m.achieved.length, 0);

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>
            🏁
          </span>
          <h2 className="label">Career Milestones</h2>
        </div>
        {totalAchieved > 0 && (
          <span className="text-xs font-semibold text-muted">
            {totalAchieved} reached
          </span>
        )}
      </div>

      <div className="glass-2 space-y-3.5 rounded-3xl p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {activeTargets.map((m) => (
            <div key={m.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{m.emoji}</span>
                  <span>{m.categoryLabel}</span>
                </span>
                <span className="tabular text-muted">
                  <span className="font-extrabold text-ink">{m.current}</span> / {m.nextTarget}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-court to-court-soft"
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-muted">
                <span>{m.remaining > 0 ? `${m.remaining} to go` : "Target reached!"}</span>
                <span>{m.pct}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Achieved Badges */}
        {totalAchieved > 0 && (
          <div className="hairline border-t pt-3">
            <div className="label mb-2 text-[10px] text-muted">Achieved marks</div>
            <div className="flex flex-wrap gap-1.5">
              {milestones.flatMap((m) =>
                m.achieved.map((threshold) => (
                  <span
                    key={`${m.category}-${threshold}`}
                    className="tabular inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-bold text-ink ring-1 ring-black/5"
                  >
                    <span aria-hidden>{m.emoji}</span>
                    <span>
                      {threshold} {m.categoryLabel}
                    </span>
                  </span>
                )),
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

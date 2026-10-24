import type { PlayerArchetype } from "@/lib/badges";

const TIER_STYLES = {
  bronze: {
    badge: "bg-amber-900/15 text-amber-800 ring-amber-900/25",
    dot: "bg-amber-700",
  },
  silver: {
    badge: "bg-slate-300/40 text-slate-700 ring-slate-400/30",
    dot: "bg-slate-500",
  },
  gold: {
    badge: "bg-amber-400/20 text-amber-700 ring-amber-500/40",
    dot: "bg-amber-500",
  },
  hof: {
    badge: "bg-purple-600/15 text-purple-700 ring-purple-500/35 shadow-sm",
    dot: "bg-purple-600",
  },
};

export function PlayerBadges({ archetype }: { archetype: PlayerArchetype }) {
  return (
    <section className="space-y-3">
      {/* Archetype Card */}
      <div className="glass-2 relative overflow-hidden rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/[0.05] text-2xl shadow-inner"
              aria-hidden
            >
              {archetype.emoji}
            </span>
            <div>
              <div className="label text-court-ink">Playstyle Archetype</div>
              <h2 className="text-xl font-extrabold tracking-tight text-ink">
                {archetype.title}
              </h2>
            </div>
          </div>
          {archetype.badges.length > 0 && (
            <span className="tabular rounded-full bg-court-soft/10 px-3 py-1 text-xs font-bold text-court-ink ring-1 ring-court-soft/25">
              {archetype.badges.length} {archetype.badges.length === 1 ? "badge" : "badges"}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-medium leading-relaxed text-muted">
          {archetype.description}
        </p>
      </div>

      {/* Badges List */}
      {archetype.badges.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {archetype.badges.map((b) => {
            const style = TIER_STYLES[b.tier];
            return (
              <div
                key={b.id}
                className="glass-1 relative flex flex-col justify-between rounded-2xl p-3.5 transition-transform hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {b.emoji}
                    </span>
                    <span className="font-extrabold text-ink">{b.name}</span>
                  </div>
                  <span
                    className={`tabular inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${style.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {b.tierLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-muted">
                  {b.description}
                </p>
                <div className="tabular mt-3 hairline border-t pt-2 text-[11px] font-semibold text-court-ink">
                  {b.progress}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="glass-1 rounded-2xl p-6 text-center text-xs font-semibold text-muted">
          Play more games to unlock 2K badges.
        </p>
      )}
    </section>
  );
}

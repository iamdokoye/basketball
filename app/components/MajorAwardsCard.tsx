import Link from "next/link";
import { majorMultiWinners, type MajorAward } from "@/lib/awards";
import { Avatar, shortName } from "./Avatar";

const ICONS: Record<string, string> = {
  mvp: "🏆",
  all_star_three: "⭐",
  best_trio: "🤝",
  team_of_year: "👑",
  spectacular: "🎬",
  rookie: "🌟",
  dpoy: "🔒",
  sixth_man: "⚡",
  mip: "📈",
  clutch: "🧊",
};

const NO_WINNER_REASONS: Record<string, string> = {
  all_star_three: "Requires at least 3 qualifying players",
  best_trio: "No 3-player squad with qualifying games",
  team_of_year: "Requires finished season games",
  spectacular: "Decided between players on highlight mixtapes",
  rookie: "No eligible first-year players",
  dpoy: "Not enough qualifying games",
  sixth_man: "No players with majority bench appearances",
  mip: "Requires previous games baseline",
  clutch: "No clutch points or game-winners recorded",
  mvp: "Not enough games played",
};

/** Card displaying major honors for a quarter or year. */
export function MajorAwardsCard({
  periodLabel,
  periodKind,
  isCurrent,
  awards,
}: {
  periodLabel: string;
  periodKind: "quarter" | "year";
  isCurrent: boolean;
  awards: MajorAward[];
}) {
  const mvp = awards.find((a) => a.id === "mvp");
  const rest = awards.filter((a) => a.id !== "mvp");
  const decorated = majorMultiWinners(awards);
  const heading = periodKind === "year" ? "Yearly awards" : "Quarterly awards";

  return (
    <section className="glass-2 space-y-3.5 rounded-3xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="label text-court-ink">{heading}</span>
            {isCurrent && (
              <span className="rounded-full bg-court-soft/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-court-ink">
                Current leaders
              </span>
            )}
          </div>
          <div className="text-xl font-extrabold leading-6 tracking-tight">
            {periodLabel}
          </div>
        </div>
        <span aria-hidden className="text-2xl leading-none">
          🏆
        </span>
      </div>

      {/* MVP Hero Highlight */}
      {mvp?.winner ? (
        <div className="space-y-2 rounded-2xl bg-court-soft/10 p-3.5 ring-1 ring-court-soft/25">
          <Link
            href={`/players/${mvp.winner.playerId}`}
            className="flex items-center gap-3.5 active:scale-[0.99]"
            title={mvp.blurb}
          >
            <Avatar name={mvp.winner.name} size="md" tone="ink" />
            <div className="min-w-0 flex-1">
              <div className="label flex items-center gap-1.5 text-court-ink">
                <span aria-hidden>🏆</span>
                <span>{mvp.title}</span>
              </div>
              <div className="truncate text-lg font-extrabold leading-tight tracking-tight">
                {mvp.winner.name}
              </div>
              <div className="tabular truncate text-xs font-semibold text-muted">
                {mvp.winner.detail}
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-xl font-black leading-6 text-court-ink">
                {mvp.winner.value}
              </div>
              <div className="label text-[10px] text-muted">rating</div>
            </div>
          </Link>

          {mvp.runnersUp && mvp.runnersUp.length > 0 && (
            <div className="hairline flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-court-soft/20 pt-2 text-[11px] font-semibold text-muted">
              <span className="text-court-ink font-bold">Contenders:</span>
              {mvp.runnersUp.map((r, i) => (
                <Link
                  key={r.playerId}
                  href={`/players/${r.playerId}`}
                  className="hover:underline"
                >
                  {i + 2}. {shortName(r.name)}{" "}
                  <span className="tabular font-bold text-ink">
                    ({r.scoreLabel})
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-black/[0.03] p-4 text-center">
          <div className="label text-[11px] text-muted">{mvp?.title ?? "MVP"}</div>
          <div className="text-sm font-bold text-muted">No MVP winner</div>
          <div className="text-xs text-muted">Not enough qualifying games</div>
        </div>
      )}

      {/* Grid of the major awards (All-Star Three, Best Trio, Team of Year, Spectacular, Rookie, DPOY, 6th Man, MIP, Clutch) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {rest.map((a) => {
          const icon = ICONS[a.id] ?? "🏅";

          // Team honors (All-Star Three, Best Trio, Team of the Year)
          if (a.team && a.team.length > 0 && a.winner) {
            return (
              <div
                key={a.id}
                className="flex flex-col justify-between rounded-2xl bg-white/60 p-3 ring-1 ring-black/5 active:scale-[0.99]"
              >
                <div className="space-y-1.5" title={a.blurb}>
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden className="text-sm">
                      {icon}
                    </span>
                    <div className="label truncate text-[10px] text-muted">
                      {a.title}
                    </div>
                  </div>

                  {/* 3 Avatars together */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex -space-x-2">
                      {a.team.map((p) => (
                        <div key={p.id} className="ring-2 ring-white rounded-full">
                          <Avatar name={p.name} size="sm" />
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-extrabold">
                        {a.team.map((p) => shortName(p.name)).join(" · ")}
                      </div>
                      <div className="tabular text-xs font-bold text-court-ink">
                        {a.winner.value}
                      </div>
                    </div>
                  </div>

                  <div className="tabular truncate text-[11px] font-medium text-muted">
                    {a.winner.detail}
                  </div>
                </div>

                {a.runnersUp && a.runnersUp.length > 0 && (
                  <div className="hairline mt-2 border-t pt-1.5 text-[10.5px] font-medium text-muted">
                    <span className="text-court-ink font-semibold">Runner-up: </span>
                    <Link
                      href={`/players/${a.runnersUp[0].playerId}`}
                      className="hover:underline"
                    >
                      {shortName(a.runnersUp[0].name)}{" "}
                      <span className="tabular font-bold text-ink">
                        ({a.runnersUp[0].scoreLabel})
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            );
          }

          if (a.winner) {
            return (
              <div
                key={a.id}
                className="flex flex-col justify-between rounded-2xl bg-white/60 p-3 ring-1 ring-black/5 active:scale-[0.99]"
              >
                <Link
                  href={`/players/${a.winner.playerId}`}
                  title={a.blurb}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden className="text-sm">
                      {icon}
                    </span>
                    <div className="label truncate text-[10px] text-muted">
                      {a.title}
                    </div>
                  </div>
                  <div className="truncate text-sm font-extrabold">
                    {shortName(a.winner.name)}
                  </div>
                  <div className="tabular text-xs font-bold text-court-ink">
                    {a.winner.value}
                  </div>
                  <div className="tabular truncate text-[11px] font-medium text-muted">
                    {a.winner.detail}
                  </div>
                </Link>

                {a.runnersUp && a.runnersUp.length > 0 && (
                  <div className="hairline mt-2 border-t pt-1.5 text-[10.5px] font-medium text-muted">
                    <span className="text-court-ink font-semibold">2nd: </span>
                    <Link
                      href={`/players/${a.runnersUp[0].playerId}`}
                      className="hover:underline"
                    >
                      {shortName(a.runnersUp[0].name)}{" "}
                      <span className="tabular font-bold text-ink">
                        ({a.runnersUp[0].scoreLabel})
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={a.id}
              title={a.blurb}
              className="space-y-1 rounded-2xl bg-black/[0.03] p-3 opacity-60"
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="text-sm opacity-50">
                  {icon}
                </span>
                <div className="label truncate text-[10px] text-muted">
                  {a.title}
                </div>
              </div>
              <div className="text-sm font-bold text-muted">No winner</div>
              <div className="text-[11px] font-medium text-muted">
                {NO_WINNER_REASONS[a.id] ?? "No qualified players"}
              </div>
            </div>
          );
        })}
      </div>

      {decorated.length > 0 && (
        <p className="hairline border-t pt-2.5 text-xs font-semibold text-muted">
          Most decorated:{" "}
          {decorated.slice(0, 3).map((d, i) => (
            <span key={d.playerId}>
              {i > 0 && " · "}
              <Link
                href={`/players/${d.playerId}`}
                className="text-ink hover:underline"
              >
                {shortName(d.name)}
              </Link>{" "}
              <span className="tabular font-bold text-court-ink">
                ({d.count})
              </span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

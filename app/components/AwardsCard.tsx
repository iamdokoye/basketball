import Link from "next/link";
import { multiWinners, type Award } from "@/lib/awards";
import { Avatar, shortName } from "./Avatar";

/** The month-end awards card: MVP up top, then the other awards. A player can appear on several. */
export function AwardsCard({
  monthLabel,
  awards,
}: {
  monthLabel: string;
  awards: Award[];
}) {
  const mvp = awards.find((a) => a.id === "mvp");
  const rest = awards.filter((a) => a.id !== "mvp");
  const decorated = multiWinners(awards);

  return (
    <section className="glass-2 space-y-3 rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label text-court-ink">Month awards</div>
          <div className="text-xl font-extrabold leading-6 tracking-tight">
            {monthLabel}
          </div>
        </div>
        <span aria-hidden className="text-xl leading-none">
          🏆
        </span>
      </div>

      {mvp?.winner && (
        <Link
          href={`/players/${mvp.winner.playerId}`}
          className="flex items-center gap-3 rounded-2xl bg-court-soft/10 p-3 ring-1 ring-court-soft/25"
          title={mvp.blurb}
        >
          <Avatar name={mvp.winner.name} tone="ink" />
          <div className="min-w-0 flex-1">
            <div className="label text-court-ink">MVP</div>
            <div className="truncate text-lg font-extrabold leading-6 tracking-tight">
              {mvp.winner.name}
            </div>
            <div className="tabular text-xs font-semibold text-muted">
              {mvp.winner.detail}
            </div>
          </div>
          <div className="tabular text-right text-sm font-extrabold text-court-ink">
            {mvp.winner.value}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2">
        {rest.map((a) =>
          a.winner ? (
            <Link
              key={a.id}
              href={`/players/${a.winner.playerId}`}
              title={a.blurb}
              className="space-y-0.5 rounded-2xl bg-white/55 p-3 ring-1 ring-black/5 active:scale-[0.99]"
            >
              <div className="label text-[10px] text-muted">{a.title}</div>
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
          ) : (
            <div
              key={a.id}
              title={a.blurb}
              className="space-y-0.5 rounded-2xl bg-black/[0.03] p-3 opacity-60"
            >
              <div className="label text-[10px] text-muted">{a.title}</div>
              <div className="text-sm font-bold text-muted">No winner</div>
              <div className="text-[11px] font-medium text-muted">
                Not enough games or attempts
              </div>
            </div>
          ),
        )}
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
              ×{d.count}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

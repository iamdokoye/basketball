import Link from "next/link";
import type { MvpResult, PeriodKind } from "@/lib/mvp";
import { Avatar, shortName } from "./Avatar";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Featured MVP for a week or month: winner, their stat line, and the two runners-up. */
export function MvpCard({
  kind,
  periodLabel,
  isCurrent,
  result,
}: {
  kind: PeriodKind;
  periodLabel: string;
  /** False when the current period has no finished games yet and an earlier one is shown. */
  isCurrent: boolean;
  result: MvpResult;
}) {
  const w = result.winner;
  const noun = kind === "week" ? "week" : "month";
  const when = isCurrent ? `This ${noun}` : `Last ${noun} played`;
  const perGame = w.gp > 1;
  const stats: [string, number][] = [
    ["PTS", w.pts],
    ["REB", w.reb],
    ["AST", w.ast],
    ["STL", w.stl],
    ["BLK", w.blk],
  ];

  return (
    <section className="glass-2 space-y-3 rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label text-court-ink">MVP of the {noun}</div>
          <div className="text-xs font-semibold text-muted">
            {when} · {periodLabel}
          </div>
        </div>
        <span aria-hidden className="text-xl leading-none">
          🏆
        </span>
      </div>

      <Link href={`/players/${w.playerId}`} className="flex items-center gap-3">
        <Avatar name={w.name} size="lg" tone="ink" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-extrabold leading-7 tracking-tight">
            {w.name}
          </div>
          <div className="tabular text-xs font-semibold text-muted">
            {w.wins}-{w.losses} in {w.gp} {w.gp === 1 ? "game" : "games"}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-3xl font-extrabold leading-8 tracking-tight text-court-ink">
            {w.rating.toFixed(1)}
            <span className="text-sm font-bold text-muted">/10</span>
          </div>
          <div className="label text-muted">rating</div>
        </div>
      </Link>

      <div className="grid grid-cols-5 gap-1.5">
        {stats.map(([label, v]) => (
          <div key={label} className="rounded-xl bg-white/50 py-2 text-center">
            <div className="tabular text-lg font-extrabold leading-5">
              {fmt(Math.round(v * 10) / 10)}
            </div>
            <div className="label text-[10px] text-muted">{label}</div>
          </div>
        ))}
      </div>
      {perGame && (
        <p className="-mt-1 text-[11px] font-semibold text-muted">
          Per-game averages
        </p>
      )}

      {result.runnersUp.length > 0 && (
        <div className="hairline flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2.5 text-xs font-semibold text-muted">
          {result.runnersUp.map((c, i) => (
            <Link
              key={c.playerId}
              href={`/players/${c.playerId}`}
              className="tabular hover:underline"
            >
              <span className="text-ink">{i + 2}.</span> {shortName(c.name)} ·{" "}
              {c.rating.toFixed(1)}
            </Link>
          ))}
          <span className="ml-auto">
            {result.games} {result.games === 1 ? "game" : "games"}
          </span>
        </div>
      )}
    </section>
  );
}

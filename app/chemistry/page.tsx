import Link from "next/link";
import { bestDuos, pairStats, rivalries } from "@/lib/chemistry";
import { computeLeagueTrios } from "@/lib/lineups";
import { listGames } from "@/lib/queries";
import { shortName } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

const MIN = 2;
const pct = (w: number, gp: number) => `${Math.round((w / gp) * 100)}%`;

export default async function ChemistryPage() {
  const allGames = await listGames();
  const pairs = pairStats(allGames);
  const duos = bestDuos(pairs, MIN).slice(0, 8);
  const rivals = rivalries(pairs, MIN).slice(0, 8);
  const trios = computeLeagueTrios(allGames).slice(0, 8);

  return (
    <div className="space-y-7">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Chemistry &amp; Lineups
        </h1>
        <p className="text-sm text-muted">
          Who wins together, the most lethal 3-man lineups, and who keeps meeting on opposite teams.
        </p>
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="label">Dominant Trios (3-Man Lineups)</h2>
          <span className="text-xs font-semibold text-muted">Sorted by Win% &amp; +/-</span>
        </div>
        {trios.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No 3-man lineup data recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {trios.map((t) => (
              <li
                key={t.key}
                className="glass-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3.5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    <Link
                      href={`/players/${t.playerIds[0]}`}
                      className="truncate hover:underline"
                    >
                      {shortName(t.playerNames[0])}
                    </Link>
                    <span className="text-muted">·</span>
                    <Link
                      href={`/players/${t.playerIds[1]}`}
                      className="truncate hover:underline"
                    >
                      {shortName(t.playerNames[1])}
                    </Link>
                    <span className="text-muted">·</span>
                    <Link
                      href={`/players/${t.playerIds[2]}`}
                      className="truncate hover:underline"
                    >
                      {shortName(t.playerNames[2])}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2.5 tabular text-xs font-semibold text-muted">
                    <span>
                      {t.wins}-{t.losses} ({t.gp} {t.gp === 1 ? "game" : "games"})
                    </span>
                    <span>·</span>
                    <span
                      className={
                        t.plusMinus > 0
                          ? "text-win font-bold"
                          : t.plusMinus < 0
                            ? "text-loss font-bold"
                            : ""
                      }
                    >
                      {t.plusMinus > 0 ? `+${t.plusMinus}` : t.plusMinus} +/-
                    </span>
                    <span>·</span>
                    <span>
                      {t.netRating > 0 ? `+${t.netRating}` : t.netRating} Net RTG
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-black/5 pt-2 sm:pt-0">
                  <div className="tabular text-right">
                    <div className="text-xl font-extrabold text-court-ink leading-tight">
                      {pct(t.wins, Math.max(1, t.gp))}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Win rate
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="label px-1">Best duos</h2>
        {duos.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No pair has played {MIN} games on the same team yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {duos.map((d) => (
              <li
                key={`${d.a.id}-${d.b.id}`}
                className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5"
              >
                <div className="min-w-0 flex-1 text-sm font-bold">
                  <div className="flex items-center gap-1.5 truncate">
                    <Link href={`/players/${d.a.id}`} className="truncate hover:underline">
                      {shortName(d.a.name)}
                    </Link>
                    <span className="text-muted shrink-0"> &amp; </span>
                    <Link href={`/players/${d.b.id}`} className="truncate hover:underline">
                      {shortName(d.b.name)}
                    </Link>
                  </div>
                  <div className="tabular text-xs font-semibold text-muted">
                    {d.together.wins}-{d.together.losses} in {d.together.gp}{" "}
                    games together
                  </div>
                </div>
                <div className="tabular shrink-0 text-xl font-extrabold text-court-ink">
                  {pct(d.together.wins, d.together.gp)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="label px-1">Biggest rivalries</h2>
        {rivals.length === 0 ? (
          <p className="glass-1 rounded-2xl p-6 text-center text-sm text-muted">
            No pair has faced each other {MIN} times yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rivals.map((r) => (
              <li
                key={`${r.a.id}-${r.b.id}`}
                className="glass-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-2xl p-3.5"
              >
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-bold">
                  <Link
                    href={`/players/${r.a.id}`}
                    className="truncate text-right hover:underline"
                  >
                    {shortName(r.a.name)}
                  </Link>
                  <span className="tabular rounded-full bg-black/[0.04] ring-1 ring-inset ring-black/5 px-2.5 py-0.5 text-xs font-bold text-ink text-center">
                    {r.against.aWins} – {r.against.bWins}
                  </span>
                  <Link
                    href={`/players/${r.b.id}`}
                    className="truncate hover:underline"
                  >
                    {shortName(r.b.name)}
                  </Link>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-black/5 pt-2 sm:pt-0">
                  <div className="tabular text-xs font-semibold text-muted">
                    {r.against.gp} games
                  </div>
                  <Link
                    href={`/compare?p1=${r.a.id}&p2=${r.b.id}`}
                    className="rounded-full bg-court-ink/10 ring-1 ring-inset ring-court-ink/20 px-2.5 py-0.5 text-[11px] font-bold text-court-ink hover:bg-court-ink hover:text-white transition"
                    title="Compare head-to-head"
                  >
                    Compare
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { bestDuos, pairStats, rivalries } from "@/lib/chemistry";
import { listGames } from "@/lib/queries";
import { shortName } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

const MIN = 2;
const pct = (w: number, gp: number) => `${Math.round((w / gp) * 100)}%`;

export default async function ChemistryPage() {
  const pairs = pairStats(await listGames());
  const duos = bestDuos(pairs, MIN).slice(0, 8);
  const rivals = rivalries(pairs, MIN).slice(0, 8);

  return (
    <div className="space-y-7">
      <div className="space-y-1 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Duos &amp; rivals
        </h1>
        <p className="text-sm text-muted">
          Who wins together and who keeps meeting on opposite teams. Needs at
          least {MIN} games together or against.
        </p>
      </div>

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
                className="glass-1 flex items-center gap-3 rounded-2xl p-3.5"
              >
                <div className="min-w-0 flex-1 text-sm font-bold">
                  <Link href={`/players/${d.a.id}`} className="hover:underline">
                    {shortName(d.a.name)}
                  </Link>
                  <span className="text-muted"> &amp; </span>
                  <Link href={`/players/${d.b.id}`} className="hover:underline">
                    {shortName(d.b.name)}
                  </Link>
                  <div className="tabular text-xs font-semibold text-muted">
                    {d.together.wins}-{d.together.losses} in {d.together.gp}{" "}
                    games together
                  </div>
                </div>
                <div className="tabular text-xl font-extrabold text-court-ink">
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
                className="glass-1 flex items-center gap-3 rounded-2xl p-3.5"
              >
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-bold">
                  <Link
                    href={`/players/${r.a.id}`}
                    className="truncate text-right hover:underline"
                  >
                    {shortName(r.a.name)}
                  </Link>
                  <span className="tabular rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-extrabold">
                    {r.against.aWins} – {r.against.bWins}
                  </span>
                  <Link
                    href={`/players/${r.b.id}`}
                    className="truncate hover:underline"
                  >
                    {shortName(r.b.name)}
                  </Link>
                </div>
                <div className="tabular text-xs font-semibold text-muted">
                  {r.against.gp} games
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

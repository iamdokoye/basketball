import Link from "next/link";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers, SORTS, type Ranked, type SortKey } from "@/lib/rankings";
import { GameRow } from "@/app/components/GameRow";
import { Avatar } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

const LEADER_CATEGORIES: { key: SortKey; label: string }[] = [
  { key: "ppg", label: "Scoring" },
  { key: "rpg", label: "Rebounds" },
  { key: "apg", label: "Assists" },
  { key: "spg", label: "Steals" },
  { key: "bpg", label: "Blocks" },
];

const PODIUM = [
  { place: 2, bar: "h-16 bg-stone-300", order: "order-1" },
  { place: 1, bar: "h-24 bg-amber-400", order: "order-2" },
  { place: 3, bar: "h-12 bg-orange-300", order: "order-3" },
];

export default async function Home() {
  const [games, players] = await Promise.all([listGames(), listPlayers()]);
  const live = games.filter((g) => g.status === "live");
  const final = games.filter((g) => g.status === "final");
  const career = careerTotals(games, players);
  const { rows: ranked } = rankPlayers(career);
  const top3 = ranked.filter((r) => r.rank !== null).slice(0, 3);

  const leaders = LEADER_CATEGORIES.flatMap(({ key, label }) => {
    const { rows } = rankPlayers(career, key);
    const best = rows[0];
    return best ? [{ label, key, player: best }] : [];
  });

  return (
    <div className="space-y-7">
      <Link
        href="/games/new"
        className="flex items-center justify-between rounded-3xl bg-gradient-to-br from-court to-orange-500 p-5 text-white shadow-lg active:scale-[0.99]"
      >
        <div>
          <div className="text-sm font-bold uppercase tracking-widest text-orange-100">Ready?</div>
          <div className="text-3xl font-black leading-tight">Start a game</div>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 text-3xl">🏀</span>
      </Link>

      {live.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">In progress</h2>
          <ul className="space-y-2">
            {live.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">Top players</h2>
          <Link href="/rankings" className="text-xs font-bold text-court hover:underline">
            Full rankings →
          </Link>
        </div>
        {top3.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-stone-200">
            Finish a game to crown a champion.
          </p>
        ) : (
          <div className="grid grid-cols-3 items-end gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            {PODIUM.map(({ place, bar, order }) => {
              const r: Ranked | undefined = top3[place - 1];
              if (!r) return <div key={place} className={order} />;
              return (
                <Link key={place} href={`/players/${r.playerId}`} className={`${order} flex flex-col items-center text-center`}>
                  <Avatar id={r.playerId} name={r.name} size={place === 1 ? "lg" : "md"} />
                  <div className="mt-1.5 w-full truncate text-sm font-black">{r.name}</div>
                  <div className="tabular text-xs font-semibold text-stone-500">{r.rating.toFixed(1)} rtg</div>
                  <div className={`mt-2 grid w-full place-items-center rounded-t-xl text-2xl font-black ${bar}`}>
                    {place}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {leaders.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-500">Category leaders</h2>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {leaders.map(({ label, key, player }) => (
              <Link
                key={key}
                href={`/rankings?sort=${key}`}
                className="w-36 shrink-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200"
              >
                <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{label}</div>
                <div className="tabular mt-1 text-3xl font-black">
                  {SORTS[key].value(player).toFixed(1)}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Avatar id={player.playerId} name={player.name} size="sm" />
                  <span className="truncate text-sm font-bold">{player.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">Recent games</h2>
          <Link href="/games" className="text-xs font-bold text-court hover:underline">
            See all →
          </Link>
        </div>
        {final.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-stone-200">
            No finished games yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {final.slice(0, 5).map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { addPlayer, setPlayerArchived } from "@/lib/actions";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { fmtAvg } from "@/lib/stats";
import { Avatar } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, games] = await Promise.all([listPlayers(), listGames()]);
  const totals = new Map(careerTotals(games, players).map((c) => [c.playerId, c]));
  const active = players.filter((p) => !p.archived);
  const archived = players.filter((p) => p.archived);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black tracking-tight">Players</h1>

      <form action={addPlayer} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={40}
          placeholder="Add a player"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-3 text-base"
        />
        <button className="rounded-full bg-court px-6 py-3 font-black text-white active:bg-court-dark">
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {active.map((p) => {
          const c = totals.get(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200"
            >
              <Link href={`/players/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar id={p.id} name={p.name} />
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="tabular text-xs text-stone-500">
                    {c && c.gp > 0
                      ? `${c.gp} GP · ${fmtAvg(c.pts, c.gp)} pts · ${fmtAvg(c.reb, c.gp)} reb · ${fmtAvg(c.ast, c.gp)} ast`
                      : "No games yet"}
                  </div>
                </div>
              </Link>
              <form action={setPlayerArchived.bind(null, p.id, true)}>
                <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 active:bg-stone-100">
                  Archive
                </button>
              </form>
            </li>
          );
        })}
        {active.length === 0 && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Add your friends to get started.
          </li>
        )}
      </ul>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">Archived</h2>
          <ul className="space-y-2">
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200"
              >
                <Link href={`/players/${p.id}`} className="font-semibold text-stone-500">
                  {p.name}
                </Link>
                <form action={setPlayerArchived.bind(null, p.id, false)}>
                  <button className="rounded-full px-3 py-1.5 text-xs font-bold text-court active:bg-orange-100">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

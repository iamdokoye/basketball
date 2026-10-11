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
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">Players</h1>

      <form action={addPlayer} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={40}
          placeholder="Add a player"
          className="glass-1 h-12 min-w-0 flex-1 rounded-full px-5 text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted focus:ring-2 focus:ring-court"
        />
        <button className="h-12 rounded-full bg-ink px-6 text-sm font-semibold text-paper shadow-sm active:scale-95">
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {active.map((p) => {
          const c = totals.get(p.id);
          return (
            <li
              key={p.id}
              className="glass-1 flex items-center gap-3 rounded-2xl p-3"
            >
              <Link href={`/players/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar id={p.id} name={p.name} />
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="tabular text-xs font-semibold text-muted">
                    {c && c.gp > 0
                      ? `${c.gp} GP · ${fmtAvg(c.pts, c.gp)} pts · ${fmtAvg(c.reb, c.gp)} reb · ${fmtAvg(c.ast, c.gp)} ast`
                      : "No games yet"}
                  </div>
                </div>
              </Link>
              <form action={setPlayerArchived.bind(null, p.id, true)}>
                <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted active:bg-black/5">
                  Archive
                </button>
              </form>
            </li>
          );
        })}
        {active.length === 0 && (
          <li className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
            Add your friends to get started.
          </li>
        )}
      </ul>

      {archived.length > 0 && (
        <section>
          <h2 className="label mb-2 px-1 text-muted">Archived</h2>
          <ul className="space-y-2">
            {archived.map((p) => (
              <li
                key={p.id}
                className="glass-1 flex items-center justify-between rounded-2xl p-3 opacity-70"
              >
                <Link href={`/players/${p.id}`} className="font-semibold text-muted">
                  {p.name}
                </Link>
                <form action={setPlayerArchived.bind(null, p.id, false)}>
                  <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-court-ink active:bg-court/10">
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

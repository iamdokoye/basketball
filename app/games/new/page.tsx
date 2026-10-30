import Link from "next/link";
import { getAccess } from "@/lib/access";
import { Countdown } from "@/app/components/Countdown";
import { playerStrengths } from "@/lib/balance";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import NewGameForm from "./NewGameForm";

export const dynamic = "force-dynamic";

export default async function NewGamePage({
  searchParams,
}: {
  searchParams?: Promise<{ teamA?: string; teamB?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialA = params.teamA ? params.teamA.split(",").map(Number).filter(Boolean) : [];
  const initialB = params.teamB ? params.teamB.split(",").map(Number).filter(Boolean) : [];

  const access = await getAccess();
  if (!access.canPlay) {
    return (
      <div className="glass-1 space-y-3 rounded-2xl p-6 text-center">
        <p className="font-semibold">Scoring is closed right now.</p>
        {access.opensAt && (
          <p className="text-3xl font-extrabold tracking-tight">
            <Countdown target={access.opensAt} serverNow={access.now} />
          </p>
        )}
        <p className="text-sm text-muted">
          New games can be started {access.windowLabel}, or by the admin.
        </p>
        <Link
          href="/admin"
          className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Admin sign in
        </Link>
      </div>
    );
  }

  const [allPlayers, games] = await Promise.all([listPlayers(), listGames()]);
  const players = allPlayers.filter((p) => !p.archived);
  const strengths = Object.fromEntries(
    playerStrengths(careerTotals(games, allPlayers)),
  );

  if (players.length < 2) {
    return (
      <div className="glass-1 rounded-2xl p-6 text-center">
        <p className="font-semibold">Add at least two players first.</p>
        <Link
          href="/players"
          className="mt-3 inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Go to roster
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          New game
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/tournaments"
            className="glass-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-ink hover:bg-white active:scale-95 border border-black/5"
          >
            <span>👑</span>
            <span>King of the Court</span>
          </Link>
          <Link
            href="/around-the-world"
            className="glass-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-ink hover:bg-white active:scale-95 border border-black/5"
          >
            <span>🌍</span>
            <span>Around the World</span>
          </Link>
        </div>
      </div>
      <NewGameForm
        players={players.map((p) => ({ id: p.id, name: p.name, injured: p.injured }))}
        strengths={strengths}
        initialA={initialA}
        initialB={initialB}
      />
    </div>
  );
}

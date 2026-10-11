import Link from "next/link";
import { getAccess } from "@/lib/access";
import { Countdown } from "@/app/components/Countdown";
import { listPlayers } from "@/lib/queries";
import NewGameForm from "./NewGameForm";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
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
        <p className="text-sm text-muted">New games can be started {access.windowLabel}, or by the admin.</p>
        <Link
          href="/admin"
          className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Admin sign in
        </Link>
      </div>
    );
  }

  const players = (await listPlayers()).filter((p) => !p.archived);

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
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">New game</h1>
      <NewGameForm players={players.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}

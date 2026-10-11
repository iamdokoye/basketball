import Link from "next/link";
import { listPlayers } from "@/lib/queries";
import NewGameForm from "./NewGameForm";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
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

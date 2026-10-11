import Link from "next/link";
import { listPlayers } from "@/lib/queries";
import NewGameForm from "./NewGameForm";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  const players = (await listPlayers()).filter((p) => !p.archived);

  if (players.length < 2) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
        <p className="font-semibold">Add at least two players first.</p>
        <Link
          href="/players"
          className="mt-3 inline-block rounded-full bg-orange-600 px-5 py-2 text-sm font-bold text-white"
        >
          Go to roster
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">New game</h1>
      <NewGameForm players={players.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}

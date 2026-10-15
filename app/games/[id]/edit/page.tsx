import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/access";
import { totalsFromLine } from "@/lib/import";
import { getGame } from "@/lib/queries";
import EditBoxScore from "./EditBoxScore";

export const dynamic = "force-dynamic";

export default async function EditBoxScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, access] = await Promise.all([getGame(Number(id)), getAccess()]);
  if (!game) notFound();

  if (!access.isAdmin) {
    return (
      <div className="glass-1 space-y-3 rounded-2xl p-6 text-center">
        <p className="font-semibold">Only the admin can edit a box score.</p>
        <Link
          href="/admin"
          className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Admin sign in
        </Link>
      </div>
    );
  }
  if (game.status !== "final") {
    return (
      <div className="glass-1 space-y-3 rounded-2xl p-6 text-center">
        <p className="font-semibold">
          This game is still live. Finish it first, then edit its box score.
        </p>
        <Link
          href={`/games/${game.id}`}
          className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
        >
          Back to the game
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/games/${game.id}`}
        className="px-1 text-sm font-semibold text-muted hover:underline"
      >
        ← Back to the game
      </Link>
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">
        Edit box score
      </h1>
      <EditBoxScore
        gameId={game.id}
        players={game.lines.map((l) => ({
          id: l.playerId,
          name: l.name,
          team: l.team,
          totals: totalsFromLine(l),
        }))}
      />
    </div>
  );
}

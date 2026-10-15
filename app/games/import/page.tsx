import Link from "next/link";
import { getAccess } from "@/lib/access";
import { leagueTimeZone } from "@/lib/format";
import { listPlayers } from "@/lib/queries";
import ImportGameForm from "./ImportGameForm";

export const dynamic = "force-dynamic";

/** Today's date in the league timezone as YYYY-MM-DD (en-CA formats it that way). */
function todayInLeagueZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: leagueTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ImportGamePage() {
  const access = await getAccess();
  if (!access.isAdmin) {
    return (
      <div className="glass-1 space-y-3 rounded-2xl p-6 text-center">
        <p className="font-semibold">Only the admin can import a game.</p>
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
  return (
    <div className="space-y-4">
      <Link
        href="/games"
        className="px-1 text-sm font-semibold text-muted hover:underline"
      >
        ← All games
      </Link>
      <h1 className="px-1 text-[32px] font-extrabold leading-[38px] tracking-tight">
        Import a game
      </h1>
      <ImportGameForm
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        defaultDate={todayInLeagueZone()}
      />
    </div>
  );
}

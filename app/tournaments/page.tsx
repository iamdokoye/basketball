import { listPlayers } from "@/lib/queries";
import { getActiveTournament } from "@/lib/tournamentActions";
import { TournamentHub } from "./TournamentHub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tournament Hub & King of the Court",
  description: "Live tournament brackets, King of the Court rotation, and championship gold-medal games for pickup basketball.",
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teams?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [players, activeTournament] = await Promise.all([
    listPlayers(),
    getActiveTournament(),
  ]);

  let initialTeams: { name: string; playerIds: number[] }[] | undefined;
  if (params.teams) {
    try {
      initialTeams = JSON.parse(decodeURIComponent(params.teams));
    } catch {
      /* ignore */
    }
  }

  return (
    <TournamentHub
      key={activeTournament?.id ?? "none"}
      players={players}
      initialTeams={initialTeams}
      serverTournament={activeTournament}
    />
  );
}

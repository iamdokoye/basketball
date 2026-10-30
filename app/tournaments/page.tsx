import { listPlayers } from "@/lib/queries";
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
  const players = await listPlayers();

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
      players={players}
      initialTeams={initialTeams}
    />
  );
}

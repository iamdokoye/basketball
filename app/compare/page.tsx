import { listGames, listPlayers, careerTotals, listVotedAwards } from "@/lib/queries";
import { comparePlayers } from "@/lib/compare";
import { CompareView } from "./CompareView";
import { rankPlayers } from "@/lib/rankings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tale of the Tape · Head-to-Head Rivalry",
  description: "Compare any two pickup basketball players head-to-head with direct matchup records, career stats, and trophy shelves.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}) {
  const params = await searchParams;
  const [players, games, votedAwards] = await Promise.all([
    listPlayers(),
    listGames(),
    listVotedAwards(),
  ]);

  const activePlayers = players.filter((p) => !p.archived);
  const career = careerTotals(games, players);
  const finalGames = games.filter((g) => g.status === "final");
  const { rows: ranked } = rankPlayers(career, "rating", finalGames.length);

  // Default to the top 2 ranked active players if params not provided
  const defaultP1 = activePlayers.find((p) => p.id === ranked[0]?.playerId)?.id ?? activePlayers[0]?.id ?? 1;
  const defaultP2 = activePlayers.find((p) => p.id === ranked[1]?.playerId)?.id ?? activePlayers[1]?.id ?? 2;

  const p1Id = params.p1 ? Number(params.p1) : defaultP1;
  const p2Id = params.p2 ? Number(params.p2) : defaultP2;

  const data = comparePlayers(p1Id, p2Id, players, games, career, votedAwards);

  return (
    <CompareView
      players={players}
      p1Id={p1Id}
      p2Id={p2Id}
      data={data}
    />
  );
}

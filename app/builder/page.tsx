import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { playerStrengths } from "@/lib/balance";
import { pairStats } from "@/lib/chemistry";
import { TeamBuilder } from "./TeamBuilder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fair Team Builder & Captains Draft",
  description: "Check in today's run, auto-balance fair 3v3 teams with chemistry synergy, or run a live captains snake draft.",
};

export default async function BuilderPage() {
  const [players, games] = await Promise.all([listPlayers(), listGames()]);
  const career = careerTotals(games, players);
  const strengths = Object.fromEntries(playerStrengths(career));

  // Compute synergy map for all pairs
  const pairs = pairStats(games);
  const synergies: Record<string, number> = {};
  for (const p of pairs) {
    const k = p.a.id < p.b.id ? `${p.a.id}-${p.b.id}` : `${p.b.id}-${p.a.id}`;
    const winRate = p.together.gp > 0 ? (p.together.wins / p.together.gp) * 100 : 50;
    synergies[k] = winRate;
  }

  return (
    <TeamBuilder
      players={players}
      career={career}
      strengths={strengths}
      synergies={synergies}
    />
  );
}

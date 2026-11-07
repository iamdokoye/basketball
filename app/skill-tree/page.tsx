import type { Metadata } from "next";
import { getAccess } from "@/lib/access";
import { leagueTimeZone } from "@/lib/format";
import { careerTotals, listGames, listPlayers, type CareerLine } from "@/lib/queries";
import { clutchTotals } from "@/lib/clutch";
import { groupBySeason, seasonKey, seasonLabel } from "@/lib/seasons";
import { emptyLine } from "@/lib/stats";
import { transformToTreeItem } from "@/lib/skillTree";
import { ArchetypeTreeClient } from "./ArchetypeTreeClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archetype Skill Tree | Basketball",
  description:
    "Interactive tiered skill tree from Tier 0 to Tier 4. Discover where every player sits on the tree, their active road, completion percentage, and what it takes to level up.",
};

export default async function SkillTreePage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; season?: string }>;
}) {
  const { player: requestedPlayerId } = await searchParams;

  const [players, games, access] = await Promise.all([
    listPlayers(),
    listGames(),
    getAccess(),
  ]);

  const tz = leagueTimeZone();
  const currentKey = seasonKey(access.now, tz);
  const sLabel = seasonLabel(currentKey);
  const seasons = groupBySeason(games, tz);
  const currentSeason = seasons.find((s) => s.key === currentKey);
  const seasonGames = currentSeason ? currentSeason.games : [];

  // All-time data
  const finalGames = games.filter((g) => g.status === "final");
  // Standardized so timed games and games to other targets compare fairly against the fixed bars.
  const allTimeTotals = careerTotals(finalGames, players, { standardize: true });
  const allTimeClutch = clutchTotals(finalGames);
  const allTimeCareerMap = new Map(allTimeTotals.map((c) => [c.playerId, c]));
  const allTimeClutchMap = new Map(allTimeClutch.map((c) => [c.playerId, c]));

  // Season data
  const seasonTotals = careerTotals(seasonGames, players, { standardize: true });
  const seasonClutch = clutchTotals(seasonGames);
  const seasonCareerMap = new Map(seasonTotals.map((c) => [c.playerId, c]));
  const seasonClutchMap = new Map(seasonClutch.map((c) => [c.playerId, c]));

  const blankCareer = (p: (typeof players)[number]): CareerLine => ({
    ...emptyLine({ id: p.id, name: p.name, team: "A" }),
    gp: 0,
    wins: 0,
    losses: 0,
    ratingSum: 0,
    ratingW: 0,
    injured: p.injured,
  });

  const allTimeItems = players.map((p) => {
    const c = allTimeCareerMap.get(p.id) ?? blankCareer(p);
    const cl = allTimeClutchMap.get(p.id) ?? null;
    return transformToTreeItem(p, c, cl, finalGames.length);
  });

  const seasonItems = players.map((p) => {
    const c = seasonCareerMap.get(p.id) ?? blankCareer(p);
    const cl = seasonClutchMap.get(p.id) ?? null;
    return transformToTreeItem(p, c, cl, seasonGames.length);
  });

  const initialPlayerId = requestedPlayerId ? Number(requestedPlayerId) : undefined;

  return (
    <div className="space-y-6">
      <ArchetypeTreeClient
        seasonPlayers={seasonItems}
        allTimePlayers={allTimeItems}
        seasonLabel={sLabel}
        initialPlayerId={initialPlayerId}
      />
    </div>
  );
}

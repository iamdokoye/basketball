import { listPlayers } from "@/lib/queries";
import { AroundTheWorldGame } from "./AroundTheWorldGame";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Around the World | Shooting Drill & Mini-Game",
  description:
    "Interactive Around the World court mini-game: Classic Chance It or Stay on Miss modes, live half-court map, and spot progression tracking.",
};

export default async function AroundTheWorldPage() {
  const players = await listPlayers();
  return <AroundTheWorldGame allPlayers={players} />;
}

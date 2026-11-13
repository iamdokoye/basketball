import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/tournamentActions";

export const dynamic = "force-dynamic";

/** Returns the active tournament state for live bracket and streak polling across all phones. */
export async function GET() {
  const tournament = await getActiveTournament();
  return NextResponse.json(
    { tournament, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

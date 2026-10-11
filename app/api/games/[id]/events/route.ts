import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Current plays and status of one game, for the live screens to poll. A GET route (not a
 * server action) so a poll never queues behind a save. Viewing is public, like the pages.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gameId = Number((await params).id);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const [game, events] = await Promise.all([
    db().from("games").select("status").eq("id", gameId).maybeSingle(),
    db()
      .from("events")
      .select("*") // "*" so it works before the clock migration adds the team column
      .eq("game_id", gameId)
      .order("id")
      .limit(5000),
  ]);
  if (game.error || events.error)
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!game.data)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    {
      status: game.data.status as "live" | "final",
      /** The server's clock, so every phone can show the same game clock even if its own is off. */
      serverNow: Date.now(),
      events: (events.data ?? []).map((e) => ({
        id: Number(e.id),
        playerId: Number(e.player_id ?? 0),
        team: e.team === "A" || e.team === "B" ? e.team : undefined,
        type: e.type,
        grp: e.grp,
        at: new Date(e.at).getTime(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

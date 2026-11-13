import { NextResponse } from "next/server";
import { getGameRoster } from "@/lib/queries";
import { isShotZone } from "@/lib/shotZones";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function mapEvent(e: Record<string, unknown>) {
  return {
    id: Number(e.id),
    playerId: Number(e.player_id ?? 0),
    team: e.team === "A" || e.team === "B" ? e.team : undefined,
    ...(isShotZone(e.zone as string | null | undefined) ? { zone: e.zone } : {}),
    type: e.type,
    grp: e.grp,
    at: new Date(e.at as string).getTime(),
  };
}

/**
 * Current plays and status of one game, for the live screens to poll.
 * Supports cursor-based delta sync (?since=<maxId>&count=<totalCount>&rosters=<rosterCount>):
 *  - If nothing changed: returns { notModified: true, status, serverNow } (saves ~99% bandwidth).
 *  - If new events were added: returns { delta: true, newEvents: [...], totalCount }
 *  - If events were undone or cursor is omitted: returns full { events: [...] }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gameId = Number((await params).id);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const countParam = url.searchParams.get("count");
  const rostersParam = url.searchParams.get("rosters");

  const since = sinceParam !== null ? Number(sinceParam) : null;
  const knownCount = countParam !== null ? Number(countParam) : null;
  const knownRosters = rostersParam !== null ? Number(rostersParam) : null;

  const hasCursor =
    since !== null &&
    Number.isSafeInteger(since) &&
    since >= 0 &&
    knownCount !== null &&
    Number.isSafeInteger(knownCount) &&
    knownCount >= 0;

  // 1. Fetch game status
  const { data: game, error: gameErr } = await db()
    .from("games")
    .select("status")
    .eq("id", gameId)
    .maybeSingle();

  if (gameErr) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });

  const status = game.status as "live" | "final";
  const serverNow = Date.now();

  // If game is final, return status immediately so clients trigger completion
  if (status === "final") {
    return NextResponse.json(
      { status: "final", serverNow },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // 2. Cursor evaluation
  if (hasCursor) {
    // Check latest event id and count using index events_game_id_idx
    const { data: latestRows, count: totalCount, error: countErr } = await db()
      .from("events")
      .select("id", { count: "exact" })
      .eq("game_id", gameId)
      .order("id", { ascending: false })
      .limit(1);

    if (countErr) return NextResponse.json({ error: "unavailable" }, { status: 503 });

    const total = totalCount ?? 0;
    const maxId = latestRows && latestRows.length > 0 ? Number(latestRows[0].id) : 0;

    // Check if roster changed
    let rosterUpdate: unknown = undefined;
    if (knownRosters !== null) {
      const { count: rosterCount } = await db()
        .from("game_players")
        .select("player_id", { count: "exact", head: true })
        .eq("game_id", gameId);
      if (rosterCount !== null && rosterCount !== knownRosters) {
        rosterUpdate = await getGameRoster(gameId).catch(() => null);
      }
    }

    // A. Nothing changed at all
    if (total === knownCount && maxId === since) {
      return NextResponse.json(
        {
          status,
          serverNow,
          notModified: true,
          totalCount: total,
          ...(rosterUpdate ? { roster: rosterUpdate } : {}),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // B. Incremental additions (new plays added, no undos)
    if (total > knownCount && maxId > since) {
      const expectedNew = total - knownCount;
      const { data: newEvents, error: newErr } = await db()
        .from("events")
        .select("*")
        .eq("game_id", gameId)
        .gt("id", since)
        .order("id", { ascending: true })
        .limit(expectedNew + 10);

      if (!newErr && newEvents && newEvents.length === expectedNew) {
        return NextResponse.json(
          {
            status,
            serverNow,
            delta: true,
            newEvents: newEvents.map((e) => mapEvent(e as Record<string, unknown>)),
            totalCount: total,
            ...(rosterUpdate ? { roster: rosterUpdate } : {}),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  // 3. Fallback: Full sync (initial load, or after undo/reorder)
  const [events, roster] = await Promise.all([
    db()
      .from("events")
      .select("*")
      .eq("game_id", gameId)
      .order("id")
      .limit(5000),
    getGameRoster(gameId).catch(() => null),
  ]);

  if (events.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json(
    {
      status,
      serverNow,
      ...(roster ? { roster } : {}),
      events: (events.data ?? []).map((e) => mapEvent(e as Record<string, unknown>)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

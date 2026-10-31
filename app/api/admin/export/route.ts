import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { boxCsv, eventsCsv, type ExportFormat } from "@/lib/export";
import { listGames } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Admin-only CSV download. `?games=all` or `?games=3,5,8`, and `?format=events|box`.
 * A GET so the browser can download it straight from a link; the admin cookie is checked here.
 */
export async function GET(req: Request) {
  if (!(await getAccess()).isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format: ExportFormat = url.searchParams.get("format") === "box" ? "box" : "events";
  const which = (url.searchParams.get("games") ?? "all").trim();

  let games = await listGames();
  if (which !== "all") {
    const ids = new Set(
      which
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isSafeInteger(n) && n > 0),
    );
    if (ids.size === 0) {
      return NextResponse.json({ error: "No games selected" }, { status: 400 });
    }
    games = games.filter((g) => ids.has(g.id));
  }
  games.sort((a, b) => a.startMs - b.startMs || a.id - b.id);

  const csv = format === "box" ? boxCsv(games) : eventsCsv(games);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="games-${format}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

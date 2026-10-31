import { gameContext, rateLine } from "./rating";
import type { Game } from "./queries";

// Pure CSV builders for the admin export. Two shapes:
//  - "events": every recorded play (the raw data; anything else can be derived from it)
//  - "box":    one row per player per game (the box score)

export type ExportFormat = "events" | "box";

/** Quote a field, and defuse spreadsheet formulas in text a user typed (names). */
function cell(v: string | number | boolean | null | undefined, text = false): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cols: (string | number | boolean | null | undefined)[], textCols: number[] = []) =>
  cols.map((v, i) => cell(v, textCols.includes(i))).join(",");

const GAME_HEAD = [
  "game_id",
  "played_at",
  "status",
  "target",
  "win_by",
  "score_a",
  "score_b",
  "estimated_order",
];

const gameCols = (g: Game) => [
  g.id,
  g.playedAt,
  g.status,
  g.target,
  g.winBy,
  g.score.A,
  g.score.B,
  g.estimatedOrder,
];

export function eventsCsv(games: Game[]): string {
  const lines = [
    row([...GAME_HEAD, "seq", "event_id", "event_at", "player_id", "player_name", "team", "type", "grp"]),
  ];
  for (const g of games) {
    const byId = new Map(g.roster.map((p) => [p.id, p]));
    g.events.forEach((e, i) => {
      const p = byId.get(e.playerId);
      lines.push(
        row(
          [
            ...gameCols(g),
            i + 1,
            e.id,
            new Date(e.at).toISOString(),
            e.playerId || "",
            p?.name ?? "",
            e.team ?? p?.team ?? "",
            e.type,
            e.grp,
          ],
          [GAME_HEAD.length + 4],
        ),
      );
    });
  }
  return lines.join("\n") + "\n";
}

export function boxCsv(games: Game[]): string {
  const lines = [
    row([
      ...GAME_HEAD,
      "player_id",
      "player_name",
      "team",
      "starter",
      "pts",
      "fgm",
      "fga",
      "fg2m",
      "fg2a",
      "fg3m",
      "fg3a",
      "ftm",
      "fta",
      "oreb",
      "dreb",
      "reb",
      "ast",
      "stl",
      "blk",
      "tov",
      "pf",
      "defl",
      "sec",
      "plus_minus",
      "rating",
    ]),
  ];
  for (const g of games) {
    const ctx = gameContext(g.lines);
    const starter = new Map(g.roster.map((p) => [p.id, p.starter]));
    for (const l of g.lines) {
      const r = rateLine(l, ctx);
      lines.push(
        row(
          [
            ...gameCols(g),
            l.playerId,
            l.name,
            l.team,
            starter.get(l.playerId) ?? "",
            l.pts,
            l.fgm,
            l.fga,
            l.fg2m,
            l.fg2a,
            l.fg3m,
            l.fg3a,
            l.ftm,
            l.fta,
            l.oreb,
            l.dreb,
            l.reb,
            l.ast,
            l.stl,
            l.blk,
            l.tov,
            l.pf,
            l.defl,
            Math.round(l.sec),
            l.plusMinus,
            r ? r.rating.toFixed(2) : "",
          ],
          [GAME_HEAD.length + 1],
        ),
      );
    }
  }
  return lines.join("\n") + "\n";
}

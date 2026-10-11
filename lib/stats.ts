// Pure stat logic, safe to import from both server and client components.
// Events are the source of truth; everything else is derived from them.

export const EVENT_TYPES = [
  "MAKE2",
  "MISS2",
  "MAKE3",
  "MISS3",
  "MAKE_FT",
  "MISS_FT",
  "OREB",
  "DREB",
  "AST",
  "STL",
  "BLK",
  "TOV",
  "FOUL",
  "DEFL",
  "SUB_IN",
  "SUB_OUT",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Team = "A" | "B";

export type GameEvent = {
  id?: number;
  playerId: number;
  type: EventType;
  /** Events recorded by one scorekeeper action (e.g. make + assist) share a group. */
  grp: string;
  /** Epoch milliseconds when the event happened. */
  at: number;
};

export type RosterEntry = { id: number; name: string; team: Team; starter: boolean };

export type StatLine = {
  playerId: number;
  name: string;
  team: Team;
  pts: number;
  fgm: number;
  fga: number;
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  defl: number;
  /** Seconds on court (wall clock between sub in/out). */
  sec: number;
  /** Team points minus opponent points while this player was on court. */
  plusMinus: number;
};

export function emptyLine(p: Pick<RosterEntry, "id" | "name" | "team">): StatLine {
  return {
    playerId: p.id,
    name: p.name,
    team: p.team,
    pts: 0,
    fgm: 0,
    fga: 0,
    fg2m: 0,
    fg2a: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    defl: 0,
    sec: 0,
    plusMinus: 0,
  };
}

export const POINTS: Partial<Record<EventType, number>> = {
  MAKE2: 2,
  MAKE3: 3,
  MAKE_FT: 1,
};

function applyEvent(line: StatLine, type: EventType): void {
  switch (type) {
    case "MAKE2":
      line.pts += 2;
      line.fgm++;
      line.fga++;
      line.fg2m++;
      line.fg2a++;
      break;
    case "MISS2":
      line.fga++;
      line.fg2a++;
      break;
    case "MAKE3":
      line.pts += 3;
      line.fgm++;
      line.fga++;
      line.fg3m++;
      line.fg3a++;
      break;
    case "MISS3":
      line.fga++;
      line.fg3a++;
      break;
    case "MAKE_FT":
      line.pts += 1;
      line.ftm++;
      line.fta++;
      break;
    case "MISS_FT":
      line.fta++;
      break;
    case "OREB":
      line.oreb++;
      line.reb++;
      break;
    case "DREB":
      line.dreb++;
      line.reb++;
      break;
    case "AST":
      line.ast++;
      break;
    case "STL":
      line.stl++;
      break;
    case "BLK":
      line.blk++;
      break;
    case "TOV":
      line.tov++;
      break;
    case "FOUL":
      line.pf++;
      break;
    case "DEFL":
      line.defl++;
      break;
  }
}

/** Who is on the court after replaying every sub in order. */
export function onCourt(roster: RosterEntry[], events: GameEvent[]): Set<number> {
  const on = new Set(roster.filter((p) => p.starter).map((p) => p.id));
  for (const e of events) {
    if (e.type === "SUB_IN") on.add(e.playerId);
    else if (e.type === "SUB_OUT") on.delete(e.playerId);
  }
  return on;
}

/**
 * One stat line per rostered player for a single game. Events must be in
 * chronological order. `startMs` is tip-off; the game ends at the last event.
 */
export function boxScore(roster: RosterEntry[], events: GameEvent[], startMs: number): StatLine[] {
  const lines = new Map(roster.map((p) => [p.id, emptyLine(p)]));
  const on = new Set(roster.filter((p) => p.starter).map((p) => p.id));
  const since = new Map<number, number>([...on].map((id) => [id, startMs]));
  const endMs = Math.max(startMs, ...events.map((e) => e.at));

  const leave = (id: number, at: number) => {
    const line = lines.get(id);
    const from = since.get(id);
    if (line && from !== undefined) line.sec += Math.max(0, (at - from) / 1000);
    on.delete(id);
    since.delete(id);
  };

  for (const e of events) {
    const line = lines.get(e.playerId);
    if (!line) continue;

    if (e.type === "SUB_OUT") {
      if (on.has(e.playerId)) leave(e.playerId, e.at);
    } else if (e.type === "SUB_IN") {
      if (!on.has(e.playerId)) {
        on.add(e.playerId);
        since.set(e.playerId, e.at);
      }
    } else {
      applyEvent(line, e.type);
      const pts = POINTS[e.type];
      if (pts) {
        for (const id of on) {
          const l = lines.get(id)!;
          l.plusMinus += l.team === line.team ? pts : -pts;
        }
      }
    }
  }
  for (const id of [...on]) leave(id, endMs);
  return [...lines.values()];
}

export function teamScores(lines: StatLine[]): Record<Team, number> {
  const score: Record<Team, number> = { A: 0, B: 0 };
  for (const l of lines) score[l.team] += l.pts;
  return score;
}

export type GameRules = { target: number; winBy: number };

/** A game ends when a team has reached the target and leads by the win-by margin. */
export function gameResult(
  score: Record<Team, number>,
  rules: GameRules,
): { over: boolean; winner: Team | null } {
  const leader: Team = score.A >= score.B ? "A" : "B";
  const lead = Math.abs(score.A - score.B);
  const over = score[leader] >= rules.target && lead >= rules.winBy;
  return { over, winner: over ? leader : null };
}

/**
 * Hollinger's Game Score: a single-number box score summary. A solid game is
 * ~10, a great one 20+. Free throws are counted separately from field goals.
 */
export function gameScore(l: StatLine): number {
  return (
    l.pts +
    0.4 * l.fgm -
    0.7 * l.fga -
    0.4 * (l.fta - l.ftm) +
    0.7 * l.oreb +
    0.3 * l.dreb +
    l.stl +
    0.7 * l.ast +
    0.7 * l.blk -
    0.4 * l.pf -
    l.tov
  );
}

export function fmtPct(made: number, att: number): string {
  return att === 0 ? "–" : `${((made / att) * 100).toFixed(0)}%`;
}

/** Effective FG%: gives 3-pointers their extra 50% weight. */
export function fmtEfg(l: Pick<StatLine, "fgm" | "fg3m" | "fga">): string {
  if (l.fga === 0) return "–";
  return `${(((l.fgm + 0.5 * l.fg3m) / l.fga) * 100).toFixed(0)}%`;
}

/** True shooting %: scoring efficiency including free throws. */
export function fmtTs(l: Pick<StatLine, "pts" | "fga" | "fta">): string {
  const denom = 2 * (l.fga + 0.44 * l.fta);
  return denom === 0 ? "–" : `${((l.pts / denom) * 100).toFixed(0)}%`;
}

export function fmtAvg(total: number, games: number, digits = 1): string {
  return games === 0 ? "–" : (total / games).toFixed(digits);
}

export function fmtSigned(n: number, digits = 0): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

export function fmtMinutes(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function describeGroup(events: GameEvent[], nameOf: (id: number) => string): string {
  const find = (...types: EventType[]) => events.find((e) => types.includes(e.type));
  const main = events[0];
  if (!main) return "";

  const subIn = find("SUB_IN");
  const subOut = find("SUB_OUT");
  if (subIn || subOut) {
    if (subIn && subOut) return `${nameOf(subIn.playerId)} in for ${nameOf(subOut.playerId)}`;
    return subIn ? `${nameOf(subIn.playerId)} subbed in` : `${nameOf(subOut!.playerId)} subbed out`;
  }

  const make = find("MAKE2", "MAKE3");
  const miss = find("MISS2", "MISS3");
  const blk = find("BLK");
  const stl = find("STL");
  const reb = find("OREB", "DREB");
  const ast = find("AST");
  const tov = find("TOV");

  if (make) {
    const n = make.type === "MAKE3" ? 3 : 2;
    return `${nameOf(make.playerId)} hit a ${n}${ast ? ` (ast ${nameOf(ast.playerId)})` : ""}`;
  }
  if (miss) {
    const n = miss.type === "MISS3" ? 3 : 2;
    let s = `${nameOf(miss.playerId)} missed a ${n}`;
    if (blk) s += `, blocked by ${nameOf(blk.playerId)}`;
    if (reb) s += `, ${reb.type === "OREB" ? "off" : "def"} reb ${nameOf(reb.playerId)}`;
    return s;
  }
  if (stl) return `${nameOf(stl.playerId)} steal${tov ? ` from ${nameOf(tov.playerId)}` : ""}`;

  const labels: Partial<Record<EventType, string>> = {
    MAKE_FT: "made a free throw",
    MISS_FT: "missed a free throw",
    OREB: "offensive rebound",
    DREB: "defensive rebound",
    AST: "assist",
    BLK: "block",
    TOV: "turnover",
    FOUL: "foul",
    DEFL: "deflection",
  };
  return `${nameOf(main.playerId)} ${labels[main.type] ?? main.type.toLowerCase()}`;
}

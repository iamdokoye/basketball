// Pure stat logic, safe to import from both server and client components.
// Events are the source of truth; everything else is derived from them.

export const EVENT_TYPES = [
  "MAKE2",
  "MISS2",
  "MAKE3",
  "MISS3",
  "OREB",
  "DREB",
  "AST",
  "STL",
  "BLK",
  "TOV",
  "FOUL",
  "DEFL",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Team = "A" | "B";

export type GameEvent = {
  id?: number;
  playerId: number;
  type: EventType;
  /** Events recorded by one scorekeeper action (e.g. make + assist) share a group. */
  grp: string;
};

export type RosterEntry = { id: number; name: string; team: Team };

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
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  defl: number;
};

export type NumericStat = Exclude<keyof StatLine, "playerId" | "name" | "team">;

export function emptyLine(p: RosterEntry): StatLine {
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
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    defl: 0,
  };
}

export function applyEvent(line: StatLine, type: EventType): void {
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

/** One stat line per rostered player for a single game. */
export function boxScore(roster: RosterEntry[], events: GameEvent[]): StatLine[] {
  const lines = new Map(roster.map((p) => [p.id, emptyLine(p)]));
  for (const e of events) {
    const line = lines.get(e.playerId);
    if (line) applyEvent(line, e.type);
  }
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

export function pct(made: number, att: number): number | null {
  return att === 0 ? null : made / att;
}

export function fmtPct(made: number, att: number): string {
  const p = pct(made, att);
  return p === null ? "–" : `${(p * 100).toFixed(0)}%`;
}

/** Effective FG%: gives 3-pointers their extra 50% weight. */
export function fmtEfg(l: Pick<StatLine, "fgm" | "fg3m" | "fga">): string {
  if (l.fga === 0) return "–";
  return `${(((l.fgm + 0.5 * l.fg3m) / l.fga) * 100).toFixed(0)}%`;
}

export function fmtAvg(total: number, games: number): string {
  return games === 0 ? "–" : (total / games).toFixed(1);
}

export function describeGroup(
  events: GameEvent[],
  nameOf: (id: number) => string,
): string {
  const by = (t: EventType) => events.find((e) => e.type === t);
  const main = events[0];
  if (!main) return "";
  const who = nameOf(main.playerId);
  const make = events.find((e) => e.type === "MAKE2" || e.type === "MAKE3");
  const miss = events.find((e) => e.type === "MISS2" || e.type === "MISS3");
  const blk = by("BLK");
  const stl = by("STL");
  const reb = events.find((e) => e.type === "OREB" || e.type === "DREB");
  const ast = by("AST");
  const tov = by("TOV");

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
    OREB: "offensive rebound",
    DREB: "defensive rebound",
    AST: "assist",
    BLK: "block",
    TOV: "turnover",
    FOUL: "foul",
    DEFL: "deflection",
  };
  return `${who} ${labels[main.type] ?? main.type.toLowerCase()}`;
}

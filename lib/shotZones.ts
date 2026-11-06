import type { Game } from "./queries";
import type { GameEvent, ShotZoneId } from "./stats";

// Shot locations. A shot's zone is stored as a ZONE event in the same group as its make/miss, so
// it is undone with the play, queued offline with it, and shared with every phone by the normal
// play poll. A profile built from real records never invents a location; untagged shots are shown
// as an estimate and the UI says so.

export type { ShotZoneId };

export type ShotZoneMeta = {
  id: ShotZoneId;
  label: string;
  pts: 2 | 3;
  description: string;
  expectedPct: number; // League benchmark
};

export const SHOT_ZONES: Record<ShotZoneId, ShotZoneMeta> = {
  paint: {
    id: "paint",
    label: "Paint & Rim",
    pts: 2,
    description: "Layups, floaters, dunks & putbacks (0–8 ft)",
    expectedPct: 58,
  },
  mid_left: {
    id: "mid_left",
    label: "Mid-Range Left",
    pts: 2,
    description: "Left wing & baseline pullups",
    expectedPct: 40,
  },
  mid_right: {
    id: "mid_right",
    label: "Mid-Range Right",
    pts: 2,
    description: "Right wing & baseline pullups",
    expectedPct: 40,
  },
  three_left: {
    id: "three_left",
    label: "Left 3PT",
    pts: 3,
    description: "Left wing & corner beyond the arc",
    expectedPct: 32,
  },
  three_right: {
    id: "three_right",
    label: "Right 3PT",
    pts: 3,
    description: "Right wing & corner beyond the arc",
    expectedPct: 32,
  },
  three_top: {
    id: "three_top",
    label: "Top 3PT",
    pts: 3,
    description: "Straight-on deep 3 at the top of the arc",
    expectedPct: 33,
  },
};

export type ZoneStat = {
  id: ShotZoneId;
  label: string;
  pts: 2 | 3;
  fgm: number;
  fga: number;
  pct: number;
  frequency: number; // % of total player shots
  status: "hot" | "neutral" | "cold";
};

export type ShotProfile = {
  totalFgm: number;
  totalFga: number;
  overallPct: number;
  /** Shots whose zone was actually recorded (not estimated). */
  taggedFgm: number;
  taggedFga: number;
  zones: Record<ShotZoneId, ZoneStat>;
  distribution: {
    paint: number; // % of total shots
    midRange: number;
    three: number;
  };
  deadliestZone: ZoneStat | null;
  volumeZone: ZoneStat | null;
};

export type PlayerShotProfile = ShotProfile & { playerId: number };

export type ShotZoneRecord = {
  id?: number;
  gameId: number;
  playerId: number;
  zone: ShotZoneId;
  made: boolean;
  pts: 2 | 3;
};

/** The shooting totals a profile is measured against. */
export type ShotTotals = {
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
};

type Tallies = Record<ShotZoneId, { fgm: number; fga: number }>;

const emptyTallies = (): Tallies => ({
  paint: { fgm: 0, fga: 0 },
  mid_left: { fgm: 0, fga: 0 },
  mid_right: { fgm: 0, fga: 0 },
  three_left: { fgm: 0, fga: 0 },
  three_right: { fgm: 0, fga: 0 },
  three_top: { fgm: 0, fga: 0 },
});

export function isShotZone(value: unknown): value is ShotZoneId {
  return typeof value === "string" && value in SHOT_ZONES;
}

/**
 * Reads the real shot locations out of a game's play log. Each ZONE event is paired with the
 * make/miss in its group; anything else is ignored.
 */
export function zoneRecordsFromGames(games: Game[]): ShotZoneRecord[] {
  const out: ShotZoneRecord[] = [];
  for (const g of games) {
    const groups = new Map<string, GameEvent[]>();
    for (const e of g.events) {
      const list = groups.get(e.grp) ?? [];
      list.push(e);
      groups.set(e.grp, list);
    }
    for (const events of groups.values()) {
      const zone = events.find((e) => e.type === "ZONE")?.zone;
      if (!zone) continue;
      const shot = events.find(
        (e) =>
          e.type === "MAKE2" ||
          e.type === "MISS2" ||
          e.type === "MAKE3" ||
          e.type === "MISS3",
      );
      if (!shot) continue;
      const three = shot.type === "MAKE3" || shot.type === "MISS3";
      out.push({
        gameId: g.id,
        playerId: shot.playerId,
        zone,
        made: shot.type === "MAKE2" || shot.type === "MAKE3",
        pts: three ? 3 : 2,
      });
    }
  }
  return out;
}

/**
 * Folds real records into a profile. Untagged shots are spread over the zones with the league's
 * typical mix so percentages stay meaningful, and `taggedFga` records how much is real.
 */
export function computeShotProfile(
  records: ShotZoneRecord[],
  totals: ShotTotals,
): ShotProfile {
  const tallies = emptyTallies();

  // Never count more tagged shots than the games actually contain (a deleted play can leave a
  // stray record behind in an old export).
  let allowed2 = Math.max(0, totals.fg2a);
  let allowed3 = Math.max(0, totals.fg3a);
  const tagged: ShotZoneRecord[] = [];
  for (const r of records) {
    if (r.pts === 3) {
      if (allowed3 <= 0) continue;
      allowed3--;
    } else {
      if (allowed2 <= 0) continue;
      allowed2--;
    }
    tagged.push(r);
  }

  for (const r of tagged) {
    tallies[r.zone].fga += 1;
    if (r.made) tallies[r.zone].fgm += 1;
  }

  const tagged2a =
    tallies.paint.fga + tallies.mid_left.fga + tallies.mid_right.fga;
  const tagged2m =
    tallies.paint.fgm + tallies.mid_left.fgm + tallies.mid_right.fgm;
  const tagged3a =
    tallies.three_left.fga + tallies.three_right.fga + tallies.three_top.fga;
  const tagged3m =
    tallies.three_left.fgm + tallies.three_right.fgm + tallies.three_top.fgm;

  // Untagged shots: in pickup 3v3, ~68% of 2s are paint/rim, ~16% mid-left, ~16% mid-right;
  // 3s are ~35% top of arc, ~33% left wing, ~32% right wing.
  const untagged2a = Math.max(0, totals.fg2a - tagged2a);
  const untagged2m = Math.max(0, totals.fg2m - tagged2m);

  if (untagged2a > 0) {
    const paintAtt = Math.round(untagged2a * 0.68);
    const midLAtt = Math.floor((untagged2a - paintAtt) / 2);
    const midRAtt = untagged2a - paintAtt - midLAtt;

    const paintMakes = Math.min(paintAtt, Math.round(untagged2m * 0.72));
    const restMakes = Math.max(0, untagged2m - paintMakes);
    const midLMakes = Math.min(midLAtt, Math.floor(restMakes / 2));
    const midRMakes = Math.min(midRAtt, restMakes - midLMakes);

    tallies.paint.fga += paintAtt;
    tallies.paint.fgm += paintMakes;
    tallies.mid_left.fga += midLAtt;
    tallies.mid_left.fgm += midLMakes;
    tallies.mid_right.fga += midRAtt;
    tallies.mid_right.fgm += midRMakes;
  }

  const untagged3a = Math.max(0, totals.fg3a - tagged3a);
  const untagged3m = Math.max(0, totals.fg3m - tagged3m);

  if (untagged3a > 0) {
    const topAtt = Math.round(untagged3a * 0.38);
    const leftAtt = Math.floor((untagged3a - topAtt) / 2);
    const rightAtt = untagged3a - topAtt - leftAtt;

    const topMakes = Math.min(topAtt, Math.round(untagged3m * 0.4));
    const rest3Makes = Math.max(0, untagged3m - topMakes);
    const leftMakes = Math.min(leftAtt, Math.floor(rest3Makes / 2));
    const rightMakes = Math.min(rightAtt, rest3Makes - leftMakes);

    tallies.three_top.fga += topAtt;
    tallies.three_top.fgm += topMakes;
    tallies.three_left.fga += leftAtt;
    tallies.three_left.fgm += leftMakes;
    tallies.three_right.fga += rightAtt;
    tallies.three_right.fgm += rightMakes;
  }

  const totalFga = Object.values(tallies).reduce((acc, z) => acc + z.fga, 0);
  const totalFgm = Object.values(tallies).reduce((acc, z) => acc + z.fgm, 0);
  const overallPct = totalFga > 0 ? (totalFgm / totalFga) * 100 : 0;

  const zones: Record<ShotZoneId, ZoneStat> = {} as Record<
    ShotZoneId,
    ZoneStat
  >;

  for (const [key, meta] of Object.entries(SHOT_ZONES) as [
    ShotZoneId,
    ShotZoneMeta,
  ][]) {
    const tally = tallies[key];
    const pct = tally.fga > 0 ? (tally.fgm / tally.fga) * 100 : 0;
    const frequency =
      totalFga > 0 ? Math.round((tally.fga / totalFga) * 100) : 0;

    let status: "hot" | "neutral" | "cold" = "neutral";
    if (tally.fga >= 2) {
      if (pct >= meta.expectedPct + 7) status = "hot";
      else if (pct <= meta.expectedPct - 7) status = "cold";
    }

    zones[key] = {
      id: key,
      label: meta.label,
      pts: meta.pts,
      fgm: tally.fgm,
      fga: tally.fga,
      pct: Math.round(pct),
      frequency,
      status,
    };
  }

  const paintShots = tallies.paint.fga;
  const midShots = tallies.mid_left.fga + tallies.mid_right.fga;
  const threeShots =
    tallies.three_left.fga + tallies.three_right.fga + tallies.three_top.fga;

  const distribution = {
    paint: totalFga > 0 ? Math.round((paintShots / totalFga) * 100) : 0,
    midRange: totalFga > 0 ? Math.round((midShots / totalFga) * 100) : 0,
    three: totalFga > 0 ? Math.round((threeShots / totalFga) * 100) : 0,
  };

  const zonesList = Object.values(zones);
  const qualifiedForDeadliest = zonesList.filter((z) => z.fga >= 3);
  const deadliestZone =
    qualifiedForDeadliest.length > 0
      ? qualifiedForDeadliest.reduce((best, cur) =>
          cur.pct > best.pct ? cur : best,
        )
      : null;

  const volumeZone =
    zonesList.length > 0
      ? zonesList.reduce((best, cur) => (cur.fga > best.fga ? cur : best))
      : null;

  return {
    totalFgm,
    totalFga,
    overallPct: Math.round(overallPct),
    taggedFgm: tagged2m + tagged3m,
    taggedFga: tagged2a + tagged3a,
    zones,
    distribution,
    deadliestZone,
    volumeZone,
  };
}

/** A player's profile across the given games (pass the records from zoneRecordsFromGames). */
export function computePlayerShotProfile(
  playerId: number,
  games: Game[],
  zoneRecords: ShotZoneRecord[] = [],
): PlayerShotProfile {
  const totals: ShotTotals = { fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
  for (const g of games) {
    if (g.status !== "final") continue;
    const line = g.lines.find((l) => l.playerId === playerId);
    if (!line) continue;
    totals.fg2m += line.fg2m;
    totals.fg2a += line.fg2a;
    totals.fg3m += line.fg3m;
    totals.fg3a += line.fg3a;
  }
  return {
    playerId,
    ...computeShotProfile(
      zoneRecords.filter((r) => r.playerId === playerId),
      totals,
    ),
  };
}

/** Every tagged shot and every shot attempt in one game, for a game-level shot chart. */
export function computeGameShotProfile(
  game: Game,
  zoneRecords: ShotZoneRecord[],
): ShotProfile {
  const totals: ShotTotals = { fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
  for (const l of game.lines) {
    totals.fg2m += l.fg2m;
    totals.fg2a += l.fg2a;
    totals.fg3m += l.fg3m;
    totals.fg3a += l.fg3a;
  }
  return computeShotProfile(
    zoneRecords.filter((r) => r.gameId === game.id),
    totals,
  );
}

/** One team's shooting in one game. */
export function computeGameTeamShotProfile(
  game: Game,
  zoneRecords: ShotZoneRecord[],
  team: "A" | "B",
): ShotProfile {
  const ids = new Set(
    game.lines.filter((l) => l.team === team).map((l) => l.playerId),
  );
  const totals: ShotTotals = { fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
  for (const l of game.lines) {
    if (l.team !== team) continue;
    totals.fg2m += l.fg2m;
    totals.fg2a += l.fg2a;
    totals.fg3m += l.fg3m;
    totals.fg3a += l.fg3a;
  }
  return computeShotProfile(
    zoneRecords.filter(
      (r) => r.gameId === game.id && ids.has(r.playerId),
    ),
    totals,
  );
}

/** The whole league across the given games. */
export function computeLeagueShotProfile(
  games: Game[],
  zoneRecords: ShotZoneRecord[],
): ShotProfile {
  const totals: ShotTotals = { fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
  const played = new Set<number>();
  for (const g of games) {
    if (g.status !== "final") continue;
    for (const l of g.lines) {
      played.add(l.playerId);
      totals.fg2m += l.fg2m;
      totals.fg2a += l.fg2a;
      totals.fg3m += l.fg3m;
      totals.fg3a += l.fg3a;
    }
  }
  return computeShotProfile(
    zoneRecords.filter((r) => played.has(r.playerId)),
    totals,
  );
}

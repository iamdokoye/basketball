import type { Game } from "./queries";
import { played } from "./rating";

export type ShotZoneId =
  | "paint"
  | "mid_left"
  | "mid_right"
  | "three_left"
  | "three_right"
  | "three_top";

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
    description: "Straight-on deep 3 at top of the arc",
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

export type PlayerShotProfile = {
  playerId: number;
  totalFgm: number;
  totalFga: number;
  overallPct: number;
  zones: Record<ShotZoneId, ZoneStat>;
  distribution: {
    paint: number; // % of total shots
    midRange: number;
    three: number;
  };
  deadliestZone: ZoneStat | null;
  volumeZone: ZoneStat | null;
};

export type ShotZoneRecord = {
  id?: number;
  gameId: number;
  playerId: number;
  zone: ShotZoneId;
  made: boolean;
  pts: 2 | 3;
};

export function computePlayerShotProfile(
  playerId: number,
  games: Game[],
  zoneRecords: ShotZoneRecord[] = [],
): PlayerShotProfile {
  const playerRecords = zoneRecords.filter((r) => r.playerId === playerId);

  const zoneTallies: Record<ShotZoneId, { fgm: number; fga: number }> = {
    paint: { fgm: 0, fga: 0 },
    mid_left: { fgm: 0, fga: 0 },
    mid_right: { fgm: 0, fga: 0 },
    three_left: { fgm: 0, fga: 0 },
    three_right: { fgm: 0, fga: 0 },
    three_top: { fgm: 0, fga: 0 },
  };

  // If we have explicit tagged records, tally them
  for (const r of playerRecords) {
    if (zoneTallies[r.zone]) {
      zoneTallies[r.zone].fga += 1;
      if (r.made) zoneTallies[r.zone].fgm += 1;
    }
  }

  // Also collect shots from all finished games
  let game2m = 0;
  let game2a = 0;
  let game3m = 0;
  let game3a = 0;

  for (const g of games) {
    if (g.status !== "final") continue;
    const line = g.lines.find((l) => l.playerId === playerId && played(l));
    if (!line) continue;
    game2m += line.fg2m;
    game2a += line.fg2a;
    game3m += line.fg3m;
    game3a += line.fg3a;
  }

  // If explicit zone records are fewer than total shots (e.g. historical games),
  // distribute the untagged shots intelligently:
  // In pickup 3v3, ~68% of 2s are paint/rim, ~16% mid-left, ~16% mid-right.
  // 3s are ~35% top of arc, ~33% left wing, ~32% right wing.
  const tagged2a = zoneTallies.paint.fga + zoneTallies.mid_left.fga + zoneTallies.mid_right.fga;
  const untagged2a = Math.max(0, game2a - tagged2a);
  const untagged2m = Math.max(0, game2m - (zoneTallies.paint.fgm + zoneTallies.mid_left.fgm + zoneTallies.mid_right.fgm));

  if (untagged2a > 0) {
    const paintAtt = Math.round(untagged2a * 0.68);
    const midLAtt = Math.floor((untagged2a - paintAtt) / 2);
    const midRAtt = untagged2a - paintAtt - midLAtt;

    const paintMakes = Math.min(paintAtt, Math.round(untagged2m * 0.72));
    const restMakes = Math.max(0, untagged2m - paintMakes);
    const midLMakes = Math.min(midLAtt, Math.floor(restMakes / 2));
    const midRMakes = Math.min(midRAtt, restMakes - midLMakes);

    zoneTallies.paint.fga += paintAtt;
    zoneTallies.paint.fgm += paintMakes;
    zoneTallies.mid_left.fga += midLAtt;
    zoneTallies.mid_left.fgm += midLMakes;
    zoneTallies.mid_right.fga += midRAtt;
    zoneTallies.mid_right.fgm += midRMakes;
  }

  const tagged3a = zoneTallies.three_left.fga + zoneTallies.three_right.fga + zoneTallies.three_top.fga;
  const untagged3a = Math.max(0, game3a - tagged3a);
  const untagged3m = Math.max(0, game3m - (zoneTallies.three_left.fgm + zoneTallies.three_right.fgm + zoneTallies.three_top.fgm));

  if (untagged3a > 0) {
    const topAtt = Math.round(untagged3a * 0.38);
    const leftAtt = Math.floor((untagged3a - topAtt) / 2);
    const rightAtt = untagged3a - topAtt - leftAtt;

    const topMakes = Math.min(topAtt, Math.round(untagged3m * 0.4));
    const rest3Makes = Math.max(0, untagged3m - topMakes);
    const leftMakes = Math.min(leftAtt, Math.floor(rest3Makes / 2));
    const rightMakes = Math.min(rightAtt, rest3Makes - leftMakes);

    zoneTallies.three_top.fga += topAtt;
    zoneTallies.three_top.fgm += topMakes;
    zoneTallies.three_left.fga += leftAtt;
    zoneTallies.three_left.fgm += leftMakes;
    zoneTallies.three_right.fga += rightAtt;
    zoneTallies.three_right.fgm += rightMakes;
  }

  const totalFga = Object.values(zoneTallies).reduce((acc, z) => acc + z.fga, 0);
  const totalFgm = Object.values(zoneTallies).reduce((acc, z) => acc + z.fgm, 0);
  const overallPct = totalFga > 0 ? (totalFgm / totalFga) * 100 : 0;

  const zones: Record<ShotZoneId, ZoneStat> = {} as Record<ShotZoneId, ZoneStat>;

  for (const [key, meta] of Object.entries(SHOT_ZONES) as [ShotZoneId, ShotZoneMeta][]) {
    const tally = zoneTallies[key];
    const pct = tally.fga > 0 ? (tally.fgm / tally.fga) * 100 : 0;
    const frequency = totalFga > 0 ? Math.round((tally.fga / totalFga) * 100) : 0;

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

  const paintShots = zoneTallies.paint.fga;
  const midShots = zoneTallies.mid_left.fga + zoneTallies.mid_right.fga;
  const threeShots = zoneTallies.three_left.fga + zoneTallies.three_right.fga + zoneTallies.three_top.fga;

  const distribution = {
    paint: totalFga > 0 ? Math.round((paintShots / totalFga) * 100) : 0,
    midRange: totalFga > 0 ? Math.round((midShots / totalFga) * 100) : 0,
    three: totalFga > 0 ? Math.round((threeShots / totalFga) * 100) : 0,
  };

  const zonesList = Object.values(zones);
  const qualifiedForDeadliest = zonesList.filter((z) => z.fga >= 3);
  const deadliestZone = qualifiedForDeadliest.length > 0
    ? qualifiedForDeadliest.reduce((best, cur) => (cur.pct > best.pct ? cur : best))
    : null;

  const volumeZone = zonesList.length > 0
    ? zonesList.reduce((best, cur) => (cur.fga > best.fga ? cur : best))
    : null;

  return {
    playerId,
    totalFgm,
    totalFga,
    overallPct: Math.round(overallPct),
    zones,
    distribution,
    deadliestZone,
    volumeZone,
  };
}

import type { Game } from "./queries";
import type { Team } from "./stats";

export type TeamFourFactors = {
  team: Team;
  pts: number;
  fga: number;
  fgm: number;
  fg3m: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  tov: number;
  possessions: number;
  efgPct: number; // 0 to 100
  tsPct: number; // 0 to 100
  tovPct: number; // 0 to 100
  orbPct: number; // 0 to 100
  ftRate: number; // FTA / FGA
  ortg: number; // Points per 100 possessions
  drtg: number; // Opponent points per 100 possessions
  netRtg: number;
};

export type PlayerAdvancedStats = {
  playerId: number;
  playerName: string;
  team: Team;
  tsPct: number; // True Shooting %
  efgPct: number; // Effective FG %
  usgPct: number; // Usage Rate %
  astPct: number; // Assist Rate %
  tovPct: number; // Turnover Rate %
  gameScore: number;
};

export function computeFourFactors(game: Game): { A: TeamFourFactors; B: TeamFourFactors } {
  const teamTotals = (t: Team) => {
    const lines = game.lines.filter((l) => l.team === t);
    return lines.reduce(
      (acc, l) => ({
        pts: acc.pts + l.pts,
        fga: acc.fga + l.fga,
        fgm: acc.fgm + l.fgm,
        fg3m: acc.fg3m + l.fg3m,
        fta: acc.fta + l.fta,
        ftm: acc.ftm + l.ftm,
        oreb: acc.oreb + l.oreb,
        dreb: acc.dreb + l.dreb,
        tov: acc.tov + l.tov,
      }),
      { pts: 0, fga: 0, fgm: 0, fg3m: 0, fta: 0, ftm: 0, oreb: 0, dreb: 0, tov: 0 },
    );
  };

  const rawA = teamTotals("A");
  const rawB = teamTotals("B");

  // Estimated possessions in 3v3: FGA + 0.44*FTA + TOV - OREB
  const possA = Math.max(1, rawA.fga + 0.44 * rawA.fta + rawA.tov - rawA.oreb);
  const possB = Math.max(1, rawB.fga + 0.44 * rawB.fta + rawB.tov - rawB.oreb);

  const calcFactors = (raw: typeof rawA, opp: typeof rawB, poss: number, oppPoss: number, t: Team): TeamFourFactors => {
    const efg = raw.fga > 0 ? ((raw.fgm + 0.5 * raw.fg3m) / raw.fga) * 100 : 0;
    const tsDenom = 2 * (raw.fga + 0.44 * raw.fta);
    const ts = tsDenom > 0 ? (raw.pts / tsDenom) * 100 : 0;
    const tovDenom = raw.fga + 0.44 * raw.fta + raw.tov;
    const tov = tovDenom > 0 ? (raw.tov / tovDenom) * 100 : 0;
    const orbDenom = raw.oreb + opp.dreb;
    const orb = orbDenom > 0 ? (raw.oreb / orbDenom) * 100 : 0;
    const ftr = raw.fga > 0 ? raw.fta / raw.fga : 0;
    const ortg = (raw.pts / poss) * 100;
    const drtg = (opp.pts / oppPoss) * 100;

    return {
      team: t,
      ...raw,
      possessions: Math.round(poss),
      efgPct: Math.round(efg * 10) / 10,
      tsPct: Math.round(ts * 10) / 10,
      tovPct: Math.round(tov * 10) / 10,
      orbPct: Math.round(orb * 10) / 10,
      ftRate: Math.round(ftr * 100) / 100,
      ortg: Math.round(ortg * 10) / 10,
      drtg: Math.round(drtg * 10) / 10,
      netRtg: Math.round((ortg - drtg) * 10) / 10,
    };
  };

  return {
    A: calcFactors(rawA, rawB, possA, possB, "A"),
    B: calcFactors(rawB, rawA, possB, possA, "B"),
  };
}

export function computeAdvancedLines(game: Game): PlayerAdvancedStats[] {
  const teamTotals = {
    A: game.lines.filter((l) => l.team === "A").reduce((s, l) => ({ fga: s.fga + l.fga, fta: s.fta + l.fta, tov: s.tov + l.tov, fgm: s.fgm + l.fgm }), { fga: 0, fta: 0, tov: 0, fgm: 0 }),
    B: game.lines.filter((l) => l.team === "B").reduce((s, l) => ({ fga: s.fga + l.fga, fta: s.fta + l.fta, tov: s.tov + l.tov, fgm: s.fgm + l.fgm }), { fga: 0, fta: 0, tov: 0, fgm: 0 }),
  };

  return game.lines.map((l) => {
    const tTotals = teamTotals[l.team];
    const playerPoss = l.fga + 0.44 * l.fta + l.tov;
    const teamPoss = Math.max(1, tTotals.fga + 0.44 * tTotals.fta + tTotals.tov);
    const usg = (playerPoss / teamPoss) * 100;

    const efg = l.fga > 0 ? ((l.fgm + 0.5 * l.fg3m) / l.fga) * 100 : 0;
    const tsDenom = 2 * (l.fga + 0.44 * l.fta);
    const ts = tsDenom > 0 ? (l.pts / tsDenom) * 100 : 0;
    const tovDenom = l.fga + 0.44 * l.fta + l.tov;
    const tov = tovDenom > 0 ? (l.tov / tovDenom) * 100 : 0;
    const ast = tTotals.fgm > l.fgm ? (l.ast / Math.max(1, tTotals.fgm - l.fgm)) * 100 : 0;

    // Standard Hollinger Game Score
    const gs =
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
      l.tov;

    return {
      playerId: l.playerId,
      playerName: l.name,
      team: l.team,
      tsPct: Math.round(ts * 10) / 10,
      efgPct: Math.round(efg * 10) / 10,
      usgPct: Math.round(usg * 10) / 10,
      astPct: Math.round(ast * 10) / 10,
      tovPct: Math.round(tov * 10) / 10,
      gameScore: Math.round(gs * 10) / 10,
    };
  });
}

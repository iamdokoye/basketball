import type { Game } from "./queries";
import { POINTS, type Team } from "./stats";

export type TrioLineup = {
  key: string;
  playerIds: [number, number, number];
  playerNames: [string, string, string];
  team: Team;
  gameId?: number;
  gp: number;
  wins: number;
  losses: number;
  ptsFor: number;
  ptsAgainst: number;
  plusMinus: number;
  netRating: number;
};

export function computeGameLineups(game: Game): TrioLineup[] {
  const nameMap = new Map<number, string>(game.roster.map((p) => [p.id, p.name]));
  const teamMap = new Map<number, Team>(game.roster.map((p) => [p.id, p.team]));

  // Track on-court players per team
  const courtA = new Set<number>(game.roster.filter((p) => p.team === "A" && p.starter).map((p) => p.id));
  const courtB = new Set<number>(game.roster.filter((p) => p.team === "B" && p.starter).map((p) => p.id));

  type LineupAcc = {
    team: Team;
    playerIds: [number, number, number];
    ptsFor: number;
    ptsAgainst: number;
    possessions: number;
  };

  const lineups = new Map<string, LineupAcc>();

  const getTrioKey = (courtSet: Set<number>): { key: string; ids: [number, number, number] } | null => {
    const ids = [...courtSet].sort((a, b) => a - b);
    if (ids.length !== 3) return null;
    const trioIds: [number, number, number] = [ids[0], ids[1], ids[2]];
    return { key: trioIds.join("-"), ids: trioIds };
  };

  const ensureLineup = (trio: { key: string; ids: [number, number, number] }, t: Team) => {
    let acc = lineups.get(trio.key);
    if (!acc) {
      acc = { team: t, playerIds: trio.ids, ptsFor: 0, ptsAgainst: 0, possessions: 0 };
      lineups.set(trio.key, acc);
    }
    return acc;
  };

  // Sort events by timestamp or id
  const sortedEvents = [...game.events].sort((a, b) => a.at - b.at || (a.id ?? 0) - (b.id ?? 0));

  for (const ev of sortedEvents) {
    if (ev.type === "SUB_IN") {
      const t = teamMap.get(ev.playerId);
      if (t === "A") courtA.add(ev.playerId);
      else if (t === "B") courtB.add(ev.playerId);
    } else if (ev.type === "SUB_OUT") {
      const t = teamMap.get(ev.playerId);
      if (t === "A") courtA.delete(ev.playerId);
      else if (t === "B") courtB.delete(ev.playerId);
    }

    const pts = POINTS[ev.type] ?? 0;
    if (pts > 0) {
      const scorerTeam = teamMap.get(ev.playerId);
      const trioA = getTrioKey(courtA);
      const trioB = getTrioKey(courtB);

      if (trioA) {
        const accA = ensureLineup(trioA, "A");
        if (scorerTeam === "A") accA.ptsFor += pts;
        else accA.ptsAgainst += pts;
        accA.possessions += 1;
      }
      if (trioB) {
        const accB = ensureLineup(trioB, "B");
        if (scorerTeam === "B") accB.ptsFor += pts;
        else accB.ptsAgainst += pts;
        accB.possessions += 1;
      }
    }
  }

  const results: TrioLineup[] = [];
  for (const [key, acc] of lineups.entries()) {
    const pNames: [string, string, string] = [
      nameMap.get(acc.playerIds[0]) ?? `Player ${acc.playerIds[0]}`,
      nameMap.get(acc.playerIds[1]) ?? `Player ${acc.playerIds[1]}`,
      nameMap.get(acc.playerIds[2]) ?? `Player ${acc.playerIds[2]}`,
    ];
    const plusMinus = acc.ptsFor - acc.ptsAgainst;
    const netRtg = acc.possessions > 0 ? (plusMinus / acc.possessions) * 100 : 0;
    const isWinner = game.status === "final" && game.winner === acc.team;

    results.push({
      key,
      playerIds: acc.playerIds,
      playerNames: pNames,
      team: acc.team,
      gameId: game.id,
      gp: 1,
      wins: isWinner ? 1 : 0,
      losses: game.status === "final" && !isWinner ? 1 : 0,
      ptsFor: acc.ptsFor,
      ptsAgainst: acc.ptsAgainst,
      plusMinus,
      netRating: Math.round(netRtg * 10) / 10,
    });
  }

  return results.sort((a, b) => b.plusMinus - a.plusMinus || b.ptsFor - a.ptsFor);
}

export function computeLeagueTrios(games: Game[]): TrioLineup[] {
  const agg = new Map<string, TrioLineup>();

  for (const game of games) {
    if (game.status !== "final") continue;
    const trios = computeGameLineups(game);
    for (const t of trios) {
      let existing = agg.get(t.key);
      if (!existing) {
        existing = {
          key: t.key,
          playerIds: t.playerIds,
          playerNames: t.playerNames,
          team: t.team,
          gp: 0,
          wins: 0,
          losses: 0,
          ptsFor: 0,
          ptsAgainst: 0,
          plusMinus: 0,
          netRating: 0,
        };
        agg.set(t.key, existing);
      }
      existing.gp += t.gp;
      existing.wins += t.wins;
      existing.losses += t.losses;
      existing.ptsFor += t.ptsFor;
      existing.ptsAgainst += t.ptsAgainst;
      existing.plusMinus += t.plusMinus;
    }
  }

  const list = [...agg.values()].map((t) => {
    const totalPoss = Math.max(1, (t.ptsFor + t.ptsAgainst) / 2);
    const netRtg = (t.plusMinus / totalPoss) * 100;
    return {
      ...t,
      netRating: Math.round(netRtg * 10) / 10,
    };
  });

  return list.sort(
    (a, b) =>
      b.wins / Math.max(1, b.gp) - a.wins / Math.max(1, a.gp) ||
      b.plusMinus - a.plusMinus ||
      b.gp - a.gp,
  );
}

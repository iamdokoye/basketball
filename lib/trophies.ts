import type { Game } from "./queries";
import { AWARD_TITLES, monthAwards, type AwardId } from "./awards";
import { computeMvp, groupByPeriod, monthKey, weekKey } from "./mvp";
import { gameSvp, playerOfTheGame } from "./pog";
import { careerTotals } from "./queries";
import { rankPlayers } from "./rankings";
import { groupBySeason, seasonKey, seasonMode } from "./seasons";

export type Trophies = {
  weeklyMvp: number;
  monthlyMvp: number;
  playerOfTheGame: number;
  svp: number;
  /** Season honours, only for seasons that are over. */
  seasonMvp: number;
  seasonChampion: number;
  /** Month-award wins by award id (MVP is counted in monthlyMvp instead). */
  awards: Partial<Record<Exclude<AwardId, "mvp">, number>>;
};

const empty = (): Trophies => ({
  weeklyMvp: 0,
  monthlyMvp: 0,
  playerOfTheGame: 0,
  svp: 0,
  seasonMvp: 0,
  seasonChampion: 0,
  awards: {},
});

/**
 * Trophy counts per player. Weekly and monthly honours only count for weeks and months that
 * are over, so a provisional leader doesn't get a trophy early. Player of the game counts for
 * every finished game.
 */
export function trophyShelf(
  games: Game[],
  timeZone: string,
  weekStartDay: number,
  nowMs: number,
): Map<number, Trophies> {
  const shelf = new Map<number, Trophies>();
  const get = (id: number) => {
    let t = shelf.get(id);
    if (!t) shelf.set(id, (t = empty()));
    return t;
  };

  for (const g of games) {
    const pog = playerOfTheGame(g);
    if (pog) get(pog.line.playerId).playerOfTheGame++;
    const svp = gameSvp(g);
    if (svp) get(svp.line.playerId).svp++;
  }

  const thisWeek = weekKey(nowMs, timeZone, weekStartDay);
  for (const week of groupByPeriod(games, "week", timeZone, weekStartDay)) {
    if (week.key >= thisWeek) continue;
    const mvp = computeMvp(week.games);
    if (mvp) get(mvp.winner.playerId).weeklyMvp++;
  }

  const thisMonth = monthKey(nowMs, timeZone);
  for (const month of groupByPeriod(games, "month", timeZone, weekStartDay)) {
    if (month.key >= thisMonth) continue;
    for (const award of monthAwards(month.games)) {
      if (!award.winner) continue;
      const t = get(award.winner.playerId);
      if (award.id === "mvp") t.monthlyMvp++;
      else t.awards[award.id] = (t.awards[award.id] ?? 0) + 1;
    }
  }

  // Season honours: best rating (MVP) and best win rate (champion) among ranked players.
  const thisSeason = seasonKey(nowMs, timeZone);
  for (const season of groupBySeason(games, timeZone, seasonMode())) {
    if (season.key >= thisSeason) continue;
    const career = careerTotals(season.games, []);
    const mvp = rankPlayers(career, "rating").rows[0];
    if (mvp?.rank === 1) get(mvp.playerId).seasonMvp++;
    const champ = rankPlayers(career, "win").rows[0];
    if (champ?.rank === 1) get(champ.playerId).seasonChampion++;
  }
  return shelf;
}

/** Human-readable shelf entries, e.g. [{ label: "Weekly MVP", count: 2 }, ...], most valuable first. */
export function shelfEntries(
  t: Trophies | undefined,
): { label: string; count: number }[] {
  if (!t) return [];
  const entries = [
    { label: "Season champion", count: t.seasonChampion },
    { label: "Season MVP", count: t.seasonMvp },
    { label: "Monthly MVP", count: t.monthlyMvp },
    { label: "Weekly MVP", count: t.weeklyMvp },
    ...(Object.entries(t.awards) as [Exclude<AwardId, "mvp">, number][]).map(
      ([id, count]) => ({
        label: AWARD_TITLES[id],
        count,
      }),
    ),
    { label: "Player of the game", count: t.playerOfTheGame },
    { label: "SVP", count: t.svp },
  ];
  return entries.filter((e) => e.count > 0);
}

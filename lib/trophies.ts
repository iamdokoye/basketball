import type { Game } from "./queries";
import {
  AWARD_TITLES,
  computeMajorAwards,
  monthAwards,
  type AwardId,
} from "./awards";
import {
  computeMvp,
  groupByPeriod,
  monthKey,
  quarterKey,
  weekKey,
  yearKey,
} from "./mvp";
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
  /** Tournament & Team Honours */
  allStarThree: number;
  bestTrio: number;
  teamOfYear: number;
  mostSpectacular: number;
  /** Quarterly major honours */
  quarterlyMvp: number;
  rookieOfQuarter: number;
  dpoyQuarterly: number;
  sixthManOfQuarter: number;
  mipQuarterly: number;
  clutchPlayerOfQuarter: number;
  /** Yearly major honours */
  yearlyMvp: number;
  rookieOfYear: number;
  dpoyYearly: number;
  sixthManOfYear: number;
  mipYearly: number;
  clutchPlayerOfYear: number;
};

const empty = (): Trophies => ({
  weeklyMvp: 0,
  monthlyMvp: 0,
  playerOfTheGame: 0,
  svp: 0,
  seasonMvp: 0,
  seasonChampion: 0,
  awards: {},
  allStarThree: 0,
  bestTrio: 0,
  teamOfYear: 0,
  mostSpectacular: 0,
  quarterlyMvp: 0,
  rookieOfQuarter: 0,
  dpoyQuarterly: 0,
  sixthManOfQuarter: 0,
  mipQuarterly: 0,
  clutchPlayerOfQuarter: 0,
  yearlyMvp: 0,
  rookieOfYear: 0,
  dpoyYearly: 0,
  sixthManOfYear: 0,
  mipYearly: 0,
  clutchPlayerOfYear: 0,
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
  votedAwards?: {
    periodKey: string;
    awardId: string;
    playerId: number;
    notes: string;
  }[],
  playerNames?: Map<number, string>,
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

  // Quarterly honours (MVP, All-Star Three, Best Trio, Spectacular, Rookie, DPOY, Sixth Man, MIP, Clutch)
  const thisQuarter = quarterKey(nowMs, timeZone);
  for (const quarter of groupByPeriod(games, "quarter", timeZone, weekStartDay)) {
    if (quarter.key >= thisQuarter) continue;
    for (const award of computeMajorAwards(quarter.games, games, "quarter", timeZone, votedAwards, playerNames)) {
      if (award.id === "all_star_three" && award.team) {
        for (const p of award.team) get(p.id).allStarThree++;
      } else if (award.id === "best_trio" && award.team) {
        for (const p of award.team) get(p.id).bestTrio++;
      } else if (award.winner) {
        const t = get(award.winner.playerId);
        if (award.id === "mvp") t.quarterlyMvp++;
        else if (award.id === "spectacular") t.mostSpectacular++;
        else if (award.id === "rookie") t.rookieOfQuarter++;
        else if (award.id === "dpoy") t.dpoyQuarterly++;
        else if (award.id === "sixth_man") t.sixthManOfQuarter++;
        else if (award.id === "mip") t.mipQuarterly++;
        else if (award.id === "clutch") t.clutchPlayerOfQuarter++;
      }
    }
  }

  // Yearly honours (MVP, All-Star Three, Team of Year, Best Trio, Spectacular, Rookie, DPOY, Sixth Man, MIP, Clutch)
  const thisYear = yearKey(nowMs, timeZone);
  for (const year of groupByPeriod(games, "year", timeZone, weekStartDay)) {
    if (year.key >= thisYear) continue;
    for (const award of computeMajorAwards(year.games, games, "year", timeZone, votedAwards, playerNames)) {
      if (award.id === "all_star_three" && award.team) {
        for (const p of award.team) get(p.id).allStarThree++;
      } else if (award.id === "best_trio" && award.team) {
        for (const p of award.team) get(p.id).bestTrio++;
      } else if (award.id === "team_of_year" && award.team) {
        for (const p of award.team) get(p.id).teamOfYear++;
      } else if (award.winner) {
        const t = get(award.winner.playerId);
        if (award.id === "mvp") t.yearlyMvp++;
        else if (award.id === "spectacular") t.mostSpectacular++;
        else if (award.id === "rookie") t.rookieOfYear++;
        else if (award.id === "dpoy") t.dpoyYearly++;
        else if (award.id === "sixth_man") t.sixthManOfYear++;
        else if (award.id === "mip") t.mipYearly++;
        else if (award.id === "clutch") t.clutchPlayerOfYear++;
      }
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
    { label: "Team of the Year", count: t.teamOfYear },
    { label: "Yearly MVP", count: t.yearlyMvp },
    { label: "Team of the Tournament (Best Trio)", count: t.bestTrio },
    { label: "All-Star Three", count: t.allStarThree },
    { label: "Most Spectacular Player", count: t.mostSpectacular },
    { label: "Rookie of the Year", count: t.rookieOfYear },
    { label: "Defensive Player of the Year (DPOY)", count: t.dpoyYearly },
    { label: "Sixth Man of the Year", count: t.sixthManOfYear },
    { label: "Most Improved Player (Year)", count: t.mipYearly },
    { label: "Clutch Player of the Year", count: t.clutchPlayerOfYear },
    { label: "Season MVP", count: t.seasonMvp },
    { label: "Quarterly MVP", count: t.quarterlyMvp },
    { label: "Rookie of the Quarter", count: t.rookieOfQuarter },
    { label: "Defensive Player of the Quarter (DPOY)", count: t.dpoyQuarterly },
    { label: "Sixth Man of the Quarter", count: t.sixthManOfQuarter },
    { label: "Most Improved Player (Quarter)", count: t.mipQuarterly },
    { label: "Clutch Player of the Quarter", count: t.clutchPlayerOfQuarter },
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

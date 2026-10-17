import type { Game } from "./queries";
import { buildCards, DECK, type AwardCardData } from "./cards";
import { aggregatePlayers, computeMvp, groupByPeriod } from "./mvp";

// Recap slideshows for a finished month or year. Pure: pass in the period's games, get back plain data
// the player component can run. The month's show is short and sweet; the year's is longer and grander
// (a slower build-up, a month-by-month roll call, a bigger finale).

export type ShowTier = "month" | "year";

export type Slide =
  | { kind: "intro"; title: string; subtitle: string }
  | { kind: "numbers"; stats: { label: string; value: number }[] }
  | { kind: "months"; rows: { month: string; name: string; rating: string }[] }
  | { kind: "award"; card: AwardCardData; n: number; of: number }
  | { kind: "star"; playerId: number; name: string; titles: { emoji: string; title: string }[] }
  | { kind: "outro"; cards: AwardCardData[]; title: string };

export type Show = {
  tier: ShowTier;
  periodKey: string;
  periodLabel: string;
  slides: Slide[];
};

/** Suspense order: the all-rounder always comes last. */
const REVEAL_ORDER = [...DECK].reverse().map((c) => c.id);

const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

/** The player with the most cards; a tie goes to the all-rounder, then to the earlier card in the deck. */
function pickStar(cards: AwardCardData[]): { playerId: number; name: string; cards: AwardCardData[] } | null {
  const by = new Map<number, AwardCardData[]>();
  for (const c of cards) by.set(c.playerId, [...(by.get(c.playerId) ?? []), c]);
  const rank = (list: AwardCardData[]) => Math.min(...list.map((c) => DECK.findIndex((d) => d.id === c.category)));
  const best = [...by.values()].sort(
    (a, b) =>
      b.length - a.length ||
      Number(b.some((c) => c.category === "allround")) - Number(a.some((c) => c.category === "allround")) ||
      rank(a) - rank(b),
  )[0];
  return best ? { playerId: best[0].playerId, name: best[0].name, cards: best } : null;
}

/** Builds the show for one finished month ("2026-09") or year ("2026"). Null when there is nothing to show. */
export function buildShow(
  tier: ShowTier,
  period: { key: string; label: string; games: Game[] },
  timeZone: string,
  weekStartDay: number,
): Show | null {
  const finals = period.games.filter((g) => g.status === "final");
  const cards = buildCards(finals, tier, period);
  if (cards.length === 0) return null;

  const players = aggregatePlayers(finals);
  const sum = (pick: (g: Game["lines"][number]) => number) =>
    finals.reduce((n, g) => n + g.lines.reduce((m, l) => m + pick(l), 0), 0);

  const slides: Slide[] = [
    {
      kind: "intro",
      title: period.label,
      subtitle: tier === "year" ? "The year in review" : "The month in review",
    },
    {
      kind: "numbers",
      stats: [
        { label: finals.length === 1 ? "game" : "games", value: finals.length },
        { label: "players", value: players.length },
        { label: "points", value: sum((l) => l.pts) },
        { label: "threes", value: sum((l) => l.fg3m) },
      ],
    },
  ];

  if (tier === "year") {
    const rows = groupByPeriod(finals, "month", timeZone, weekStartDay)
      .reverse() // oldest first
      .flatMap((m) => {
        const mvp = computeMvp(m.games);
        return mvp
          ? [
              {
                month: SHORT_MONTH.format(new Date(`${m.key}-01T00:00:00Z`)),
                name: mvp.winner.name,
                rating: mvp.winner.rating.toFixed(1),
              },
            ]
          : [];
      });
    if (rows.length > 1) slides.push({ kind: "months", rows });
  }

  const ordered = REVEAL_ORDER.flatMap((id) => cards.filter((c) => c.category === id));
  ordered.forEach((card, i) => slides.push({ kind: "award", card, n: i + 1, of: ordered.length }));

  const star = pickStar(cards);
  if (star)
    slides.push({
      kind: "star",
      playerId: star.playerId,
      name: star.name,
      titles: star.cards.map((c) => ({ emoji: c.emoji, title: c.title })),
    });

  slides.push({
    kind: "outro",
    cards: DECK.flatMap((d) => cards.filter((c) => c.category === d.id)),
    title: tier === "year" ? `That's ${period.label}` : `That's ${period.label.split(" ")[0]}`,
  });

  return { tier, periodKey: period.key, periodLabel: period.label, slides };
}

// ---- timing -----------------------------------------------------------------------------------------

/** How long each slide stays up, and when within it the big reveal lands (ms). The year takes its time. */
export const TIMING: Record<ShowTier, { slideMs: Record<Slide["kind"], number>; revealMs: number }> = {
  month: {
    slideMs: { intro: 4500, numbers: 5500, months: 0, award: 6500, star: 7000, outro: 8000 },
    revealMs: 1500,
  },
  year: {
    slideMs: { intro: 7500, numbers: 7500, months: 10000, award: 9500, star: 11000, outro: 14000 },
    revealMs: 2800,
  },
};

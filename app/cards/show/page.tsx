import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { groupByYear, yearKey } from "@/lib/cards";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { groupByPeriod, monthKey } from "@/lib/mvp";
import { listGames } from "@/lib/queries";
import { buildShow, type ShowTier } from "@/lib/slideshow";
import { Slideshow } from "@/app/components/Slideshow";

export const dynamic = "force-dynamic";

export const metadata = { title: "Recap · Pickup League" };

/** The recap slideshow for a finished month or year. Unfinished ones go back to the cards. */
export default async function ShowPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; period?: string }>;
}) {
  const { tier: t, period } = await searchParams;
  const tier: ShowTier = t === "year" ? "year" : "month";
  const back = `/cards?tier=${tier}${period ? `&period=${encodeURIComponent(period)}` : ""}`;

  const [games, access] = await Promise.all([listGames(), getAccess()]);
  const tz = leagueTimeZone();
  const day = leagueGameDay();

  const currentKey = tier === "year" ? yearKey(access.now, tz) : monthKey(access.now, tz);
  const periods = tier === "year" ? groupByYear(games, tz) : groupByPeriod(games, "month", tz, day);
  const picked = periods.find((p) => p.key === period);
  // Only a finished month or year gets a show, same as its cards.
  if (!picked || picked.key >= currentKey) redirect(`/cards?tier=${tier}`);

  const show = buildShow(tier, picked, tz, day);
  if (!show) redirect(`/cards?tier=${tier}`);

  return <Slideshow show={show} backHref={back} />;
}

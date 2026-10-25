import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { groupByYear, yearKey } from "@/lib/cards";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { groupByPeriod, monthKey } from "@/lib/mvp";
import { listGames } from "@/lib/queries";
import { buildShow, type ShowTier } from "@/lib/slideshow";
import { Slideshow } from "@/app/components/Slideshow";
import { AdminDisclaimerScreen } from "@/app/components/AdminDisclaimer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Recap · Pickup League" };

/** The recap slideshow for a finished month or year, with admin preview capability for in-progress periods. */
export default async function ShowPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; period?: string; confirmed?: string }>;
}) {
  const { tier: t, period, confirmed } = await searchParams;
  const tier: ShowTier = t === "year" ? "year" : "month";
  const back = `/cards?tier=${tier}${period ? `&period=${encodeURIComponent(period)}` : ""}`;

  const [games, access] = await Promise.all([listGames(), getAccess()]);
  const tz = leagueTimeZone();
  const day = leagueGameDay();

  const currentKey = tier === "year" ? yearKey(access.now, tz) : monthKey(access.now, tz);
  const periods = tier === "year" ? groupByYear(games, tz) : groupByPeriod(games, "month", tz, day);
  const picked =
    periods.find((p) => p.key === period) ??
    (access.isAdmin ? periods.find((p) => p.key === currentKey) : undefined);

  if (!picked) redirect(`/cards?tier=${tier}`);

  const isLocked = picked.key >= currentKey;
  if (isLocked) {
    if (!access.isAdmin) {
      redirect(`/cards?tier=${tier}`);
    }

    // Admin disclaimer asking if they really want to view it
    if (confirmed !== "1") {
      const confirmHref = `/cards/show?tier=${tier}&period=${encodeURIComponent(picked.key)}&confirmed=1`;
      return (
        <AdminDisclaimerScreen
          title={`Recap Slideshow (${tier === "year" ? "Yearly" : "Monthly"})`}
          periodLabel={picked.label}
          description={`The ${picked.label} ${tier} is currently in progress and locked for regular users. Viewing this recap slideshow early will reveal provisional standings, MVP honors, and potential spoilers.`}
          confirmHref={confirmHref}
          backHref={back}
        />
      );
    }
  }

  const show = buildShow(tier, picked, tz, day);
  if (!show) redirect(`/cards?tier=${tier}`);

  return <Slideshow show={show} backHref={back} />;
}

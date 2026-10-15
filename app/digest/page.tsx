import Link from "next/link";
import { getAccess } from "@/lib/access";
import { buildDigest } from "@/lib/digest";
import { leagueGameDay, leagueTimeZone } from "@/lib/format";
import { featuredPeriod, groupByPeriod, weekKey } from "@/lib/mvp";
import { listGames, listPlayers } from "@/lib/queries";
import { ShareRecap } from "@/app/components/ShareRecap";

export const dynamic = "force-dynamic";

export default async function DigestPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: requested } = await searchParams;
  const [games, players, access] = await Promise.all([
    listGames(),
    listPlayers(),
    getAccess(),
  ]);
  const tz = leagueTimeZone();
  const day = leagueGameDay();
  const weeks = groupByPeriod(games, "week", tz, day);
  const selected =
    weeks.find((w) => w.key === requested) ??
    featuredPeriod(weeks, weekKey(access.now, tz, day))?.period ??
    weeks[0];
  const text = selected
    ? buildDigest({ week: selected, allGames: games, players, timeZone: tz })
    : null;

  return (
    <div className="space-y-5">
      <div className="space-y-1 px-1">
        <Link href="/" className="text-sm font-semibold text-muted hover:underline">
          ← Home
        </Link>
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Weekly digest
        </h1>
        <p className="text-sm text-muted">
          A summary of the week to paste into the group chat: results, MVP, best
          game, game-winners, new records and the season standings. A week runs
          from game day to the Friday after.
        </p>
      </div>

      {weeks.length > 0 && (
        <nav
          aria-label="Week"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {weeks.slice(0, 10).map((w) =>
            w.key === selected?.key ? (
              <span
                key={w.key}
                aria-current="page"
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper shadow-sm"
              >
                {w.label}
              </span>
            ) : (
              <Link
                key={w.key}
                href={`/digest?week=${w.key}`}
                className="glass-1 shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-muted"
              >
                {w.label}
              </Link>
            ),
          )}
        </nav>
      )}

      {selected && text ? (
        <ShareRecap
          text={text}
          path={`/digest?week=${selected.key}`}
          title={`Week of ${selected.label}`}
          copyLabel="Copy digest"
        />
      ) : (
        <p className="glass-1 rounded-2xl p-8 text-center text-sm text-muted">
          The digest shows up after the first finished game.
        </p>
      )}
    </div>
  );
}

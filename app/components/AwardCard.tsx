import Link from "next/link";
import { TIER_LABEL, type AwardCardData, type Tier } from "@/lib/cards";
import { Avatar } from "./Avatar";
import { CardActions } from "./CardActions";

const STARS: Record<Tier, string> = { week: "★", month: "★★", year: "★★★" };

/** A single long word ("Flamethrower") needs a smaller size to fit the card width on one line. */
function titleSize(title: string): string {
  const longest = Math.max(...title.split(" ").map((w) => w.length));
  return longest >= 11 ? "text-[14.5px]" : longest >= 9 ? "text-[16.5px]" : "text-[19px]";
}

/** One title card: the picture, the title, and the winner's number on a white panel. */
export function AwardCard({ card, sharePath }: { card: AwardCardData; sharePath: string }) {
  return (
    <article
      className={`tcard tcard-${card.tier} flex h-full flex-col`}
      aria-label={`${card.title}: ${card.name}`}
    >
      <div className="relative z-[1] flex items-center justify-between gap-2 px-3 pt-3 text-[10px] font-extrabold uppercase tracking-[0.12em]">
        <span className="whitespace-nowrap rounded-full bg-black/30 px-2 py-0.5">
          {TIER_LABEL[card.tier]}
        </span>
        <span aria-hidden className="whitespace-nowrap text-sm tracking-normal text-amber-200">
          {STARS[card.tier]}
        </span>
      </div>

      <div className="relative z-[1] mx-auto mt-2 grid h-24 w-24 place-items-center">
        <span aria-hidden className="tcard-glow" />
        <span
          aria-hidden
          className="relative text-[58px] leading-none drop-shadow-[0_4px_10px_rgb(0_0_0/0.4)]"
        >
          {card.emoji}
        </span>
      </div>

      <div className="relative z-[1] mt-1 px-3 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/80">
        {card.categoryLabel}
      </div>
      <h3 className={`relative z-[1] text-balance px-2 text-center ${titleSize(card.title)} font-black uppercase leading-[22px] tracking-wide [text-shadow:0_2px_8px_rgb(0_0_0/0.4)]`}>
        {card.title}
      </h3>
      <p className="relative z-[1] px-3 pb-3 pt-1 text-center text-[11px] font-semibold leading-snug text-white/90">
        {card.tagline}
      </p>

      <div className="relative z-[1] mt-auto space-y-1.5 rounded-t-2xl bg-white/95 p-3 text-ink">
        <Link
          href={`/players/${card.playerId}`}
          className="flex items-center gap-2 active:opacity-70"
        >
          <Avatar name={card.name} size="sm" tone="ink" />
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{card.name}</span>
        </Link>
        <div className="tabular text-[26px] font-black leading-7 tracking-tight text-court-ink">
          {card.value}
        </div>
        <div className="tabular text-[11px] font-semibold leading-snug text-muted">
          {card.detail}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="label min-w-0 flex-1 text-[10px] leading-3 text-muted">
            {card.periodLabel}
          </span>
          <CardActions card={card} sharePath={sharePath} />
        </div>
      </div>
    </article>
  );
}

/** A face-down card, for a deck that hasn't dropped yet. */
export function CardBack({ tier }: { tier: Tier }) {
  return (
    <div
      aria-hidden
      className="tcard tcard-back grid aspect-[3/4] place-items-center"
      style={{ opacity: tier === "week" ? 1 : 0.92 }}
    >
      <span className="text-5xl opacity-80">🎴</span>
    </div>
  );
}

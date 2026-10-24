"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

/** Popup modal detailing why the player won the card, along with the runner up. */
export function CardDetailModal({
  card,
  onClose,
}: {
  card: AwardCardData;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="glass-3 sheet-up relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl !bg-paper/95 p-5 shadow-2xl"
      >
        {/* Top Header with Card Theme */}
        <div
          className={`tcard tcard-${card.tier} relative -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-3xl p-4 text-white shadow-md`}
        >
          <div className="relative z-[1] flex items-center justify-between gap-2">
            <span className="whitespace-nowrap rounded-full bg-black/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]">
              {TIER_LABEL[card.tier]} · {STARS[card.tier]}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-sm font-bold text-white transition hover:bg-black/60 active:scale-95"
            >
              ✕
            </button>
          </div>

          <div className="relative z-[1] mt-2 flex items-center gap-3">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center">
              <span aria-hidden className="tcard-glow" />
              <span
                aria-hidden
                className="relative text-3xl drop-shadow-[0_2px_6px_rgb(0_0_0/0.4)]"
              >
                {card.emoji}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/80">
                {card.categoryLabel}
              </div>
              <h2
                id="card-modal-title"
                className="truncate text-lg font-black uppercase leading-tight tracking-wide drop-shadow-[0_2px_4px_rgb(0_0_0/0.4)]"
              >
                {card.title}
              </h2>
              <p className="truncate text-xs font-semibold text-white/90">
                {card.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable details */}
        <div className="space-y-4 overflow-y-auto pr-0.5">
          {/* Winner Spotlight */}
          <div className="space-y-1.5">
            <div className="label flex items-center gap-1.5 text-xs text-court-ink">
              <span aria-hidden>🏆</span>
              <span>Winner</span>
            </div>
            <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5">
              <Link
                href={`/players/${card.playerId}`}
                onClick={onClose}
                className="flex min-w-0 items-center gap-2.5 hover:opacity-80"
              >
                <Avatar name={card.name} size="md" tone="ink" />
                <div className="min-w-0">
                  <div className="truncate font-extrabold text-ink">{card.name}</div>
                  <div className="tabular text-xs font-semibold text-muted">{card.detail}</div>
                </div>
              </Link>
              <div className="tabular shrink-0 text-right text-xl font-black text-court-ink">
                {card.value}
              </div>
            </div>
          </div>

          {/* Explanation: Why they won */}
          <div className="space-y-1.5">
            <div className="label flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden>📋</span>
              <span>Why they won</span>
            </div>
            <div className="glass-1 space-y-2 rounded-2xl p-3.5 text-xs">
              <p className="font-semibold leading-relaxed text-ink">
                {card.explanation ||
                  `${card.name} led all qualified contenders for ${card.title} with ${card.value} (${card.detail}).`}
              </p>
              {card.criteria && (
                <div className="hairline border-t pt-2 text-[11px] text-muted">
                  <span className="font-bold text-ink">Criteria: </span>
                  {card.criteria}
                </div>
              )}
            </div>
          </div>

          {/* Runner-up */}
          <div className="space-y-1.5">
            <div className="label flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden>🥈</span>
              <span>Runner up</span>
            </div>
            {card.runnerUp ? (
              <div className="glass-1 flex items-center justify-between gap-3 rounded-2xl p-3.5">
                <Link
                  href={`/players/${card.runnerUp.playerId}`}
                  onClick={onClose}
                  className="flex min-w-0 items-center gap-2.5 hover:opacity-80"
                >
                  <Avatar name={card.runnerUp.name} size="md" tone="soft" />
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{card.runnerUp.name}</div>
                    <div className="tabular text-xs font-semibold text-muted">{card.runnerUp.detail}</div>
                  </div>
                </Link>
                <div className="tabular shrink-0 text-right text-base font-extrabold text-muted">
                  {card.runnerUp.value}
                </div>
              </div>
            ) : (
              <div className="glass-1 rounded-2xl p-3.5 text-center text-xs font-semibold text-muted">
                No runner-up qualified this period.
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-full bg-ink text-sm font-bold text-paper shadow-sm active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One title card: the picture, the title, and the winner's number on a white panel. */
export function AwardCard({ card, sharePath }: { card: AwardCardData; sharePath: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <article
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`tcard tcard-${card.tier} flex h-full cursor-pointer select-none flex-col transition-transform duration-150 hover:scale-[1.02] active:scale-[0.99]`}
        aria-label={`${card.title}: ${card.name} (tap to view why they won and runner up)`}
      >
        <div className="relative z-[1] flex items-center justify-between gap-2 px-3 pt-3 text-[10px] font-extrabold uppercase tracking-[0.12em]">
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap rounded-full bg-black/30 px-2 py-0.5">
              {TIER_LABEL[card.tier]}
            </span>
            <span
              className="grid h-4 w-4 place-items-center rounded-full bg-black/25 text-[9px] text-white/90"
              title="Click for details & runner up"
            >
              ℹ
            </span>
          </div>
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
        <h3
          className={`relative z-[1] text-balance px-2 text-center ${titleSize(card.title)} font-black uppercase leading-[22px] tracking-wide [text-shadow:0_2px_8px_rgb(0_0_0/0.4)]`}
        >
          {card.title}
        </h3>
        <p className="relative z-[1] px-3 pb-3 pt-1 text-center text-[11px] font-semibold leading-snug text-white/90">
          {card.tagline}
        </p>

        <div className="relative z-[1] mt-auto space-y-1.5 rounded-t-2xl bg-white/95 p-3 text-ink">
          <Link
            href={`/players/${card.playerId}`}
            onClick={(e) => e.stopPropagation()}
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
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="label truncate text-[10px] leading-3 text-muted">
                {card.periodLabel}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-court-soft/15 px-1.5 py-0.5 text-[9px] font-bold text-court-ink">
                Details
              </span>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <CardActions card={card} sharePath={sharePath} />
            </div>
          </div>
        </div>
      </article>

      {open && <CardDetailModal card={card} onClose={() => setOpen(false)} />}
    </>
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

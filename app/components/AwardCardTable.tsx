"use client";

import { useState } from "react";
import Link from "next/link";
import { TIER_LABEL, type AwardCardData } from "@/lib/cards";
import { Avatar } from "./Avatar";
import { CardActions } from "./CardActions";
import { CardDetailModal } from "./AwardCard";

/** The same title cards as the grid, one per row. Tap a row for why they won and the runner up. */
export function AwardCardTable({
  cards,
  sharePath,
}: {
  cards: AwardCardData[];
  sharePath: string;
}) {
  const [open, setOpen] = useState<AwardCardData | null>(null);

  return (
    <>
      <div className="glass-2 overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="tabular w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="label text-muted">
                <th className="px-3 py-3 text-left font-semibold">Card</th>
                <th className="hidden px-2.5 py-3 text-left font-semibold sm:table-cell">Player</th>
                <th className="px-2.5 py-3 text-right font-semibold">Stat</th>
                <th className="hidden px-2.5 py-3 text-left font-semibold md:table-cell">Detail</th>
                <th className="hidden px-2.5 py-3 text-left font-semibold md:table-cell">Runner up</th>
                <th className="px-2.5 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {cards.map((c) => (
                <tr
                  key={c.key}
                  tabIndex={0}
                  onClick={() => setOpen(c)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(c);
                    }
                  }}
                  aria-label={`${c.title}: ${c.name} (view why they won and runner up)`}
                  className="cursor-pointer hover:bg-black/[0.03] focus-visible:bg-black/[0.03]"
                >
                  <td className="py-2.5 pl-3 pr-1.5 sm:pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className={`tcard tcard-${c.tier} grid h-8 w-8 shrink-0 place-items-center !rounded-xl text-xl sm:h-9 sm:w-9`}
                      >
                        {c.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="font-extrabold">{c.title}</div>
                        <div className="label hidden text-[10px] text-muted sm:block">
                          {c.categoryLabel} · {TIER_LABEL[c.tier]}
                        </div>
                        <Link
                          href={`/players/${c.playerId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block text-xs font-semibold text-muted active:opacity-70 sm:hidden"
                        >
                          {c.name}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-2.5 py-2.5 sm:table-cell">
                    <Link
                      href={`/players/${c.playerId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 font-bold active:opacity-70"
                    >
                      <Avatar name={c.name} size="sm" tone="ink" />
                      <span>{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-1 py-2.5 text-right text-base font-black text-court-ink sm:px-2.5">
                    {c.value}
                  </td>
                  <td className="hidden px-2.5 py-2.5 text-xs font-semibold text-muted md:table-cell">{c.detail}</td>
                  <td className="hidden px-2.5 py-2.5 text-xs font-semibold text-muted md:table-cell">
                    {c.runnerUp ? (
                      <>
                        <span className="text-ink">{c.runnerUp.name}</span> · {c.runnerUp.value}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pl-1 pr-2.5 text-right sm:px-2.5" onClick={(e) => e.stopPropagation()}>
                    <CardActions card={c} sharePath={sharePath} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <CardDetailModal card={open} onClose={() => setOpen(null)} />}
    </>
  );
}

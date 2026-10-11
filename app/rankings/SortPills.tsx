"use client";

import Link from "next/link";
import { useState } from "react";

type Item = { key: string; label: string };

/** Plain-language meaning of each stat. */
const EXPLAIN: Record<
  string,
  { title: string; body: string; formula?: string }
> = {
  rating: {
    title: "Rating · out of 10",
    body: "Every player starts a game at 6.5 when they take the court, as a starter or when they check in off the bench. Their plays then move it: points, rebounds, assists, steals, blocks and deflections push it up; missed shots, turnovers and fouls pull it down. Scoring in a low-scoring game counts for more, and so does doing a lot in few minutes. How your team did while you were on court nudges it too. It never goes above 10 or below 3, and 10 is nearly impossible. About 7 is a normal game, 8 is strong and 9 is a night to remember. The table shows each player's average across their games.",
    formula: "6.5 → up or down by points + 0.4·FGM − 0.7·FGA − 0.4·missed FT + 0.7·OREB + 0.3·DREB + STL + 0.7·AST + 0.7·BLK + 0.3·deflections − 0.4·PF − TOV, scaled for pace and minutes, plus a small team plus/minus effect",
  },
  ppg: {
    title: "PPG · Points per game",
    body: "How many points a player scores in an average game, counting 2s, 3s and free throws.",
  },
  rpg: {
    title: "RPG · Rebounds per game",
    body: "How many missed shots a player grabs in an average game, offensive and defensive together.",
  },
  apg: {
    title: "APG · Assists per game",
    body: "How many times a player passes to a teammate who then scores, in an average game.",
  },
  spg: {
    title: "SPG · Steals per game",
    body: "How many times a player takes the ball away from the other team in an average game.",
  },
  bpg: {
    title: "BPG · Blocks per game",
    body: "How many of the other team's shots a player blocks in an average game.",
  },
  fg: {
    title: "FG% · Field goal percentage",
    body: "The share of a player's 2-point and 3-point shots that go in. Free throws aren't counted. Shown only for players who have taken a shot.",
  },
  win: {
    title: "Win% · Win percentage",
    body: "The share of finished games that a player's team won. W-L in the table shows the wins and losses behind it.",
  },
  pm: {
    title: "+/- · Plus/minus per game",
    body: "How much better the player's team did while they were on the court, averaged per game: points their team scored minus points the other team scored. Positive is good. It only changes when someone checks in or out, so subbing matters.",
  },
};

/**
 * Sort pills. Tapping a different pill re-sorts the table; tapping the selected
 * pill again opens a short explanation of that stat. Give this component a `key`
 * of the active stat so the explanation closes when the sort changes.
 */
export function SortPills({
  items,
  active,
}: {
  items: Item[];
  active: string;
}) {
  const [open, setOpen] = useState(false);
  const info = EXPLAIN[active];

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) =>
          it.key === active ? (
            <button
              key={it.key}
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="stat-explainer"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper shadow-sm active:scale-95"
            >
              {it.label}
              <span
                aria-hidden
                className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-extrabold transition ${
                  open ? "bg-paper text-ink" : "bg-paper/25 text-paper"
                }`}
              >
                i
              </span>
              <span className="sr-only">
                {open ? "Hide explanation" : "What does this mean?"}
              </span>
            </button>
          ) : (
            <Link
              key={it.key}
              href={
                it.key === "rating" ? "/rankings" : `/rankings?sort=${it.key}`
              }
              className="glass-1 shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-muted"
            >
              {it.label}
            </Link>
          ),
        )}
      </div>

      {open && info && (
        <div
          id="stat-explainer"
          role="note"
          className="glass-1 sheet-up space-y-1.5 rounded-2xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-extrabold tracking-tight">
              {info.title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close explanation"
              className="-mr-1 -mt-1 rounded-full px-2 py-1 text-muted active:bg-black/5"
            >
              ✕
            </button>
          </div>
          <p className="text-sm leading-relaxed text-muted">{info.body}</p>
          {info.formula && (
            <p className="rounded-xl bg-black/[0.04] p-2.5 font-mono text-[11px] leading-relaxed text-muted">
              {info.formula}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

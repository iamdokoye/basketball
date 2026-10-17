"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustBoxScore } from "@/lib/actions";
import { PlayerStatCard, ScoreBar } from "@/app/components/StatEditor";
import { pointsOf, type Totals } from "@/lib/import";

type P = { id: number; name: string; team: "A" | "B"; totals: Totals };

export default function EditBoxScore({
  gameId,
  players,
}: {
  gameId: number;
  players: P[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(players);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const score = { A: 0, B: 0 };
  for (const r of rows) score[r.team] += pointsOf(r.totals);
  const changed = rows.some(
    (r, i) => JSON.stringify(r.totals) !== JSON.stringify(players[i].totals),
  );

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await adjustBoxScore(
        gameId,
        rows.map((r) => ({ playerId: r.id, totals: r.totals })),
      );
      if (!res.ok) return setError(res.error);
      router.push(`/games/${gameId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-muted">
        Change any number and save. A higher number adds plays at the end of the
        game, a lower one removes that player&apos;s latest plays of that kind.
        Plus/minus for added points follows whoever is on court at the end.
      </p>
      <ScoreBar a={score.A} b={score.B} />
      {(["A", "B"] as const).map((team) => (
        <section key={team} className="space-y-2">
          <h2
            className={`label px-1 ${team === "A" ? "text-court-ink" : "text-away-dark"}`}
          >
            Team {team}
          </h2>
          <ul className="space-y-2">
            {rows
              .filter((r) => r.team === team)
              .map((r) => (
                <PlayerStatCard
                  key={r.id}
                  name={r.name}
                  team={team}
                  totals={r.totals}
                  onChange={(t) =>
                    setRows((cur) =>
                      cur.map((x) => (x.id === r.id ? { ...x, totals: t } : x)),
                    )
                  }
                />
              ))}
          </ul>
        </section>
      ))}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-loss/10 p-3 text-sm font-semibold text-loss"
        >
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={!changed || pending}
        className="h-14 w-full rounded-full bg-ink text-base font-semibold text-paper shadow-md transition active:scale-[0.99] disabled:opacity-40"
      >
        {pending ? "Saving…" : changed ? "Save changes" : "No changes yet"}
      </button>
    </div>
  );
}

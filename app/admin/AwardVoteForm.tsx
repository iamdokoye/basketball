"use client";

import { useState, useTransition } from "react";
import { recordVotedAward } from "@/lib/actions";
import type { VotedAward } from "@/lib/queries";

export function AwardVoteForm({
  players,
  periods,
  votedAwards,
}: {
  players: { id: number; name: string }[];
  periods: { key: string; label: string }[];
  votedAwards: VotedAward[];
}) {
  const [periodKey, setPeriodKey] = useState(periods[0]?.key ?? "");
  const [playerId, setPlayerId] = useState(players[0]?.id ? String(players[0].id) : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const playerNameMap = new Map(players.map((p) => [p.id, p.name]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !periodKey) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await recordVotedAward({
        periodKey,
        awardId: "spectacular",
        playerId: Number(playerId),
        notes,
      });

      if (!res.ok) {
        setError(res.error);
      } else {
        setSuccess(`Awarded Most Spectacular Player for ${periodKey}!`);
        setNotes("");
      }
    });
  };

  return (
    <div className="glass-2 space-y-4 rounded-3xl p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            🎬
          </span>
          <h2 className="label text-court-ink">Most Spectacular Player</h2>
        </div>
        <p className="text-xs text-muted">
          Record your community & peer vote winner for highlight mixtapes and
          clutch plays for any quarter or year.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">
            <span className="text-muted">Period (Quarter or Year)</span>
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="w-full rounded-xl bg-white/70 p-2.5 text-sm font-bold ring-1 ring-black/10 focus:ring-court"
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold">
            <span className="text-muted">Winning Player</span>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="w-full rounded-xl bg-white/70 p-2.5 text-sm font-bold ring-1 ring-black/10 focus:ring-court"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-xs font-semibold">
          <span className="text-muted">Mixtape / Voting Notes (optional)</span>
          <input
            type="text"
            placeholder="e.g. Voted #1 in group highlight poll for ankle-breaker 3s"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl bg-white/70 p-2.5 text-sm font-medium ring-1 ring-black/10 focus:ring-court"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-loss/10 p-2.5 text-xs font-semibold text-loss">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-xl bg-win/10 p-2.5 text-xs font-semibold text-win">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-paper transition hover:bg-black/80 active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Spectacular Player Award"}
        </button>
      </form>

      {/* Previously awarded list */}
      {votedAwards.length > 0 && (
        <div className="hairline space-y-2 border-t pt-3">
          <div className="label text-[10px] text-muted">Voted Honors History</div>
          <ul className="space-y-1.5">
            {votedAwards.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-extrabold text-court-ink">
                    {v.periodKey}:
                  </span>{" "}
                  <span className="font-bold">
                    {playerNameMap.get(v.playerId) ?? `Player #${v.playerId}`}
                  </span>
                  {v.notes && (
                    <span className="text-muted"> · {v.notes}</span>
                  )}
                </div>
                <span className="rounded-full bg-court-soft/15 px-2 py-0.5 text-[10px] font-bold text-court-ink">
                  🎬 Spectacular
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

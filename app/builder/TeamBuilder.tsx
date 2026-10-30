"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import { balanceMultiTeams, type MultiTeamResult } from "@/lib/balance";
import type { CareerLine, Player } from "@/lib/queries";
import { averageRating } from "@/lib/rating";

export function TeamBuilder({
  players,
  career,
  strengths,
  synergies,
}: {
  players: Player[];
  career: CareerLine[];
  strengths: Record<number, number>;
  synergies: Record<string, number>;
}) {
  const [tab, setTab] = useState<"balance" | "draft">("balance");
  const [checkedIds, setCheckedIds] = useState<number[]>(() =>
    players.filter((p) => !p.injured && !p.archived).map((p) => p.id),
  );

  // Auto-balance state
  const [numTeams, setNumTeams] = useState<2 | 3 | 4>(2);
  const [balanceResult, setBalanceResult] = useState<MultiTeamResult | null>(null);

  // Captains Draft state
  const [captain1, setCaptain1] = useState<number | null>(null);
  const [captain2, setCaptain2] = useState<number | null>(null);
  const [draftStarted, setDraftStarted] = useState(false);
  const [draftPicks, setDraftPicks] = useState<{ captain: 1 | 2; playerId: number }[]>([]);

  const activePlayers = players.filter((p) => !p.archived);

  const getPlayer = (id: number) => activePlayers.find((p) => p.id === id);
  const getCareer = (id: number) => career.find((c) => c.playerId === id);
  const getRating = (id: number) => {
    const c = getCareer(id);
    return c ? averageRating(c.ratingSum, c.ratingW) : 5.0;
  };

  const getSynergy = (id1: number, id2: number) => {
    const key = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    return synergies[key] ?? 50;
  };

  function toggleCheck(id: number) {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setBalanceResult(null);
  }

  function selectAll() {
    setCheckedIds(activePlayers.map((p) => p.id));
    setBalanceResult(null);
  }

  function clearAll() {
    setCheckedIds([]);
    setBalanceResult(null);
  }

  // Generate balanced teams
  function runBalance() {
    if (checkedIds.length < numTeams) return;
    const res = balanceMultiTeams(
      checkedIds,
      numTeams,
      (id) => strengths[id] ?? 5.0,
      getSynergy,
    );
    setBalanceResult(res);
  }

  // --- Draft Engine ---
  // Draft pick order (Snake draft: 1 -> 2 -> 2 -> 1 -> 1 -> 2...)
  const team1Picks = draftPicks.filter((p) => p.captain === 1).map((p) => p.playerId);
  const team2Picks = draftPicks.filter((p) => p.captain === 2).map((p) => p.playerId);

  const draftedSet = new Set(draftPicks.map((p) => p.playerId));
  if (captain1) draftedSet.add(captain1);
  if (captain2) draftedSet.add(captain2);

  const availableForDraft = checkedIds.filter((id) => !draftedSet.has(id));

  // Determine whose turn it is
  const totalDraftPicksMade = draftPicks.length;
  // Pick order pattern for 2 captains: 1, 2, 2, 1, 1, 2, 2, 1...
  const isCaptain1Turn =
    totalDraftPicksMade % 4 === 0 || totalDraftPicksMade % 4 === 3;
  const currentCaptainTurn: 1 | 2 = isCaptain1Turn ? 1 : 2;

  function pickPlayerForDraft(playerId: number) {
    setDraftPicks((prev) => [...prev, { captain: currentCaptainTurn, playerId }]);
  }

  function undoDraftPick() {
    setDraftPicks((prev) => prev.slice(0, -1));
  }

  function resetDraft() {
    setDraftStarted(false);
    setDraftPicks([]);
  }

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="space-y-1 px-1">
        <div className="label text-court-ink">Lineups &amp; Scouting</div>
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Fair team builder &amp; draft
        </h1>
        <p className="text-sm text-muted">
          Check in who showed up to the court today, generate chemically balanced 3v3 squads, or run a live captains draft.
        </p>
      </div>

      {/* Main Tab Toggle */}
      <div className="flex rounded-2xl bg-black/[0.06] p-1 text-sm font-bold">
        <button
          type="button"
          onClick={() => setTab("balance")}
          className={`flex-1 rounded-xl py-2 transition ${
            tab === "balance" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
          }`}
        >
          ⚖️ Auto-Balance Engine
        </button>
        <button
          type="button"
          onClick={() => setTab("draft")}
          className={`flex-1 rounded-xl py-2 transition ${
            tab === "draft" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
          }`}
        >
          👑 Captains Live Draft
        </button>
      </div>

      {/* Court Check-In Section */}
      <section className="glass-1 space-y-3.5 rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="label">Court check-in</h2>
            <div className="text-sm font-extrabold">
              {checkedIds.length} players checked in
              <span className="ml-2 font-normal text-muted">
                ({Math.floor(checkedIds.length / 3)} full 3v3 teams)
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-semibold text-court-ink hover:underline"
            >
              Select all
            </button>
            <span className="text-muted/40">·</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Player Roster Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {activePlayers.map((p) => {
            const isChecked = checkedIds.includes(p.id);
            const r = getRating(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleCheck(p.id)}
                className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                  isChecked
                    ? "border-court-soft/50 bg-court-soft/10 text-ink shadow-2xs"
                    : "border-black/5 bg-white/40 text-muted opacity-70 hover:opacity-100"
                }`}
              >
                <div className="relative">
                  <Avatar id={p.id} name={p.name} size="sm" />
                  {isChecked && (
                    <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-court-ink text-[9px] font-black text-white">
                      ✓
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{shortName(p.name)}</div>
                  <div className="text-[10px] font-semibold text-muted">
                    Rating {r.toFixed(1)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: AUTO-BALANCE ENGINE */}
      {tab === "balance" && (
        <section className="space-y-4">
          <div className="glass-1 flex flex-col gap-3 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="label">Configuration</div>
              <div className="text-sm font-bold">Split into how many squads?</div>
            </div>
            <div className="flex items-center gap-2">
              {([2, 3, 4] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setNumTeams(k);
                    setBalanceResult(null);
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    numTeams === k
                      ? "bg-ink text-paper shadow-xs"
                      : "bg-black/[0.05] text-muted hover:text-ink"
                  }`}
                >
                  {k} Teams ({k * 3}p)
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={runBalance}
            disabled={checkedIds.length < numTeams}
            className="w-full rounded-2xl bg-court-ink py-3.5 text-center text-sm font-extrabold text-white shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
          >
            {balanceResult ? "🔀 Shuffle & Re-Balance Teams" : "⚡ Generate Balanced Teams"}
          </button>

          {balanceResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-court-soft/20 px-3 py-1 text-xs font-black text-court-ink">
                    {balanceResult.fairness}
                  </span>
                  <span className="text-xs text-muted">
                    Max rating gap: {balanceResult.maxGap.toFixed(2)} pts
                  </span>
                </div>

                {numTeams === 2 && (
                  <Link
                    href={`/games/new?teamA=${balanceResult.teams[0]?.playerIds.join(",")}&teamB=${balanceResult.teams[1]?.playerIds.join(",")}`}
                    className="flex items-center gap-1 text-xs font-extrabold text-court-ink hover:underline"
                  >
                    Start Game →
                  </Link>
                )}
                {numTeams >= 3 && (
                  <Link
                    href={`/tournaments?teams=${encodeURIComponent(
                      JSON.stringify(
                        balanceResult.teams.map((t) => ({
                          name: t.name,
                          playerIds: t.playerIds,
                        })),
                      ),
                    )}`}
                    className="flex items-center gap-1 text-xs font-extrabold text-court-ink hover:underline"
                  >
                    Send to King of the Court →
                  </Link>
                )}
              </div>

              {/* Squads Cards Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {balanceResult.teams.map((team, idx) => (
                  <div
                    key={team.id}
                    className="glass-2 relative overflow-hidden rounded-3xl border border-black/5 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-black/5 text-xs font-black">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-base font-extrabold">{team.name}</h3>
                          <div className="text-[11px] font-semibold text-muted">
                            Avg strength {team.avgStrength.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-extrabold text-muted">
                        {team.playerIds.length} players
                      </span>
                    </div>

                    {/* Team Players List */}
                    <ul className="divide-y divide-black/5 rounded-2xl bg-white/60">
                      {team.playerIds.map((id, pIdx) => {
                        const p = getPlayer(id);
                        if (!p) return null;
                        const r = getRating(id);
                        return (
                          <li
                            key={id}
                            className="flex items-center justify-between p-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar id={id} name={p.name} size="sm" />
                              <span className="text-xs font-bold">{p.name}</span>
                              {pIdx === 0 && (
                                <span className="rounded-sm bg-court-soft/20 px-1.5 py-0.5 text-[9px] font-bold text-court-ink">
                                  Anchor
                                </span>
                              )}
                            </div>
                            <span className="tabular text-xs font-semibold text-muted">
                              {r.toFixed(1)} PER
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: CAPTAINS LIVE DRAFT */}
      {tab === "draft" && (
        <section className="space-y-4">
          {!draftStarted ? (
            <div className="glass-1 space-y-4 rounded-3xl p-5">
              <h2 className="label">Step 1: Designate captains</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label mb-1.5 block text-xs">Captain 1</label>
                  <select
                    value={captain1 ?? ""}
                    onChange={(e) => setCaptain1(Number(e.target.value) || null)}
                    className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:outline-hidden"
                  >
                    <option value="">Select Captain 1</option>
                    {checkedIds.map((id) => {
                      const p = getPlayer(id);
                      if (!p || id === captain2) return null;
                      return (
                        <option key={id} value={id}>
                          {p.name} ({getRating(id).toFixed(1)} PER)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="label mb-1.5 block text-xs">Captain 2</label>
                  <select
                    value={captain2 ?? ""}
                    onChange={(e) => setCaptain2(Number(e.target.value) || null)}
                    className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:outline-hidden"
                  >
                    <option value="">Select Captain 2</option>
                    {checkedIds.map((id) => {
                      const p = getPlayer(id);
                      if (!p || id === captain1) return null;
                      return (
                        <option key={id} value={id}>
                          {p.name} ({getRating(id).toFixed(1)} PER)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDraftStarted(true)}
                disabled={!captain1 || !captain2 || captain1 === captain2}
                className="w-full rounded-2xl bg-court-ink py-3 text-sm font-extrabold text-white shadow-md transition hover:opacity-90 disabled:opacity-40"
              >
                🏁 Start Captains Live Draft
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Draft Status Banner */}
              <div className="glass-2 relative overflow-hidden rounded-3xl p-5 text-center">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted">
                    Round {Math.floor(totalDraftPicksMade / 2) + 1} · Pick #{totalDraftPicksMade + 1}
                  </span>
                  <div className="flex gap-2">
                    {draftPicks.length > 0 && (
                      <button
                        type="button"
                        onClick={undoDraftPick}
                        className="text-xs font-semibold text-muted hover:text-ink"
                      >
                        Undo pick
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetDraft}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {availableForDraft.length > 0 ? (
                  <div className="my-3">
                    <div className="label text-court-ink">On the clock</div>
                    <div className="text-2xl font-black">
                      👑 {currentCaptainTurn === 1 ? getPlayer(captain1!)?.name : getPlayer(captain2!)?.name}
                    </div>
                  </div>
                ) : (
                  <div className="my-3 space-y-2">
                    <div className="text-2xl font-black text-court-ink">
                      🎉 Draft Complete!
                    </div>
                    <p className="text-xs text-muted">Both rosters are locked and ready to hoop.</p>
                    <Link
                      href={`/games/new?teamA=${[captain1, ...team1Picks].join(",")}&teamB=${[captain2, ...team2Picks].join(",")}`}
                      className="inline-block rounded-full bg-court-ink px-6 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:opacity-90"
                    >
                      Tip Off Game →
                    </Link>
                  </div>
                )}
              </div>

              {/* Live Rosters */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Team Captain 1 */}
                <div className="glass-1 rounded-3xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-court-ink">Team 1</div>
                      <h3 className="font-extrabold">{getPlayer(captain1!)?.name}</h3>
                    </div>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-extrabold">
                      {team1Picks.length + 1} players
                    </span>
                  </div>

                  <ul className="divide-y divide-black/5 rounded-2xl bg-white/60">
                    <li className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <Avatar id={captain1!} name={getPlayer(captain1!)!.name} size="sm" />
                        <span className="text-xs font-bold">{getPlayer(captain1!)!.name}</span>
                        <span className="rounded-sm bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-700">
                          Captain
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {getRating(captain1!).toFixed(1)} PER
                      </span>
                    </li>
                    {team1Picks.map((id) => (
                      <li key={id} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <Avatar id={id} name={getPlayer(id)!.name} size="sm" />
                          <span className="text-xs font-bold">{getPlayer(id)!.name}</span>
                        </div>
                        <span className="text-[11px] text-muted">
                          {getRating(id).toFixed(1)} PER
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Team Captain 2 */}
                <div className="glass-1 rounded-3xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-court-ink">Team 2</div>
                      <h3 className="font-extrabold">{getPlayer(captain2!)?.name}</h3>
                    </div>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-extrabold">
                      {team2Picks.length + 1} players
                    </span>
                  </div>

                  <ul className="divide-y divide-black/5 rounded-2xl bg-white/60">
                    <li className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <Avatar id={captain2!} name={getPlayer(captain2!)!.name} size="sm" />
                        <span className="text-xs font-bold">{getPlayer(captain2!)!.name}</span>
                        <span className="rounded-sm bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-700">
                          Captain
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {getRating(captain2!).toFixed(1)} PER
                      </span>
                    </li>
                    {team2Picks.map((id) => (
                      <li key={id} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <Avatar id={id} name={getPlayer(id)!.name} size="sm" />
                          <span className="text-xs font-bold">{getPlayer(id)!.name}</span>
                        </div>
                        <span className="text-[11px] text-muted">
                          {getRating(id).toFixed(1)} PER
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Draft Pool (Available Players) */}
              {availableForDraft.length > 0 && (
                <div className="space-y-2">
                  <h2 className="label px-1">
                    Available players ({availableForDraft.length}) · Tap to draft
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {availableForDraft.map((id) => {
                      const p = getPlayer(id);
                      if (!p) return null;
                      const r = getRating(id);
                      const curCaptainId = currentCaptainTurn === 1 ? captain1! : captain2!;
                      const syn = getSynergy(curCaptainId, id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => pickPlayerForDraft(id)}
                          className="glass-1 group flex items-center justify-between rounded-2xl p-3 text-left transition hover:border-court-soft/50 hover:bg-white active:scale-95"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar id={id} name={p.name} size="sm" />
                            <div>
                              <div className="text-xs font-bold group-hover:text-court-ink">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-muted">
                                {r.toFixed(1)} PER · {Math.round(syn)}% synergy
                              </div>
                            </div>
                          </div>
                          <span className="rounded-lg bg-court-ink/10 px-2 py-1 text-[11px] font-black text-court-ink group-hover:bg-court-ink group-hover:text-white transition">
                            Draft
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

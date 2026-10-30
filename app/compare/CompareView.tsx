"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import { InjuredBadge } from "@/app/components/InjuredBadge";
import type { Player } from "@/lib/queries";
import type { HeadToHeadSummary } from "@/lib/compare";

export function CompareView({
  players,
  p1Id,
  p2Id,
  data,
}: {
  players: Player[];
  p1Id: number;
  p2Id: number;
  data: HeadToHeadSummary | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "scoring" | "impact" | "defense" | "shooting">("all");
  const [showGames, setShowGames] = useState(false);
  const [copied, setCopied] = useState(false);

  const activePlayers = players.filter((p) => !p.archived);

  function switchPlayers(newP1: number, newP2: number) {
    router.push(`/compare?p1=${newP1}&p2=${newP2}`);
  }

  function swap() {
    switchPlayers(p2Id, p1Id);
  }

  async function shareBanter() {
    if (!data) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `Tale of the Tape: ${data.player1.name} vs ${data.player2.name}`,
          text: data.banter,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${data.banter}\n\n${window.location.href}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${data.banter}\n\n${window.location.href}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        /* ignore */
      }
    }
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
          Tale of the Tape
        </h1>
        <p className="text-sm text-muted">Select two players to compare head-to-head.</p>
        <div className="glass-1 grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
          <PlayerSelect
            label="Player 1"
            value={p1Id}
            players={activePlayers}
            exclude={p2Id}
            onChange={(id) => switchPlayers(id, p2Id)}
          />
          <PlayerSelect
            label="Player 2"
            value={p2Id}
            players={activePlayers}
            exclude={p1Id}
            onChange={(id) => switchPlayers(p1Id, id)}
          />
        </div>
      </div>
    );
  }

  const { player1, player2, against, together, metrics, trophies } = data;
  const filteredMetrics =
    filter === "all" ? metrics : metrics.filter((m) => m.category === filter);

  const p1Wins = against.p1Wins;
  const p2Wins = against.p2Wins;
  const totalAgainst = against.gp;
  const p1WinPct = totalAgainst ? Math.round((p1Wins / totalAgainst) * 100) : 50;
  const p2WinPct = totalAgainst ? 100 - p1WinPct : 50;

  return (
    <div className="space-y-7">
      {/* Header & Player Selectors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="label text-court-ink">Rivalry &amp; Head-to-Head</div>
            <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
              Tale of the tape
            </h1>
          </div>
          <button
            type="button"
            onClick={shareBanter}
            className="flex items-center gap-1.5 rounded-full bg-court-ink px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? "Copied banter!" : "Share rivalry"}
          </button>
        </div>

        {/* Player Pickers Card */}
        <div className="glass-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl p-4 sm:p-5">
          <div>
            <label className="label mb-1.5 block text-xs">Player 1</label>
            <select
              value={p1Id}
              onChange={(e) => switchPlayers(Number(e.target.value), p2Id)}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:ring-2 focus:ring-court-soft focus:outline-hidden"
            >
              {activePlayers.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === p2Id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={swap}
            title="Swap sides"
            className="mt-5 grid h-10 w-10 place-items-center rounded-full bg-black/[0.06] text-muted transition hover:bg-black/10 hover:text-ink active:scale-90"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8v12M17 20l4-4M17 20l-4-4" />
            </svg>
          </button>

          <div>
            <label className="label mb-1.5 block text-xs text-right">Player 2</label>
            <select
              value={p2Id}
              onChange={(e) => switchPlayers(p1Id, Number(e.target.value))}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:ring-2 focus:ring-court-soft focus:outline-hidden"
            >
              {activePlayers.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === p1Id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Head-to-Head Banner */}
      <section className="glass-2 relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* P1 Side */}
          <div className="flex flex-col items-center text-center">
            <Link href={`/players/${player1.id}`} className="group flex flex-col items-center">
              <Avatar id={player1.id} name={player1.name} size="lg" />
              <div className="mt-2 text-base font-extrabold group-hover:underline">
                {shortName(player1.name)}
              </div>
            </Link>
            {player1.injured && <InjuredBadge className="mt-1" />}
            <div className="mt-1 text-xs font-semibold text-muted">
              {data.career1.gp} GP · {data.career1.wins}W - {data.career1.losses}L
            </div>
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full bg-court-ink/10 px-3 py-1 text-xs font-black tracking-wider text-court-ink uppercase">
              VS
            </span>
            <div className="tabular mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              <span className={p1Wins > p2Wins ? "text-court-ink" : ""}>{p1Wins}</span>
              <span className="mx-2 text-muted/60">–</span>
              <span className={p2Wins > p1Wins ? "text-court-ink" : ""}>{p2Wins}</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-muted">
              {totalAgainst === 0 ? "Never played against" : `${totalAgainst} direct matchups`}
            </div>
          </div>

          {/* P2 Side */}
          <div className="flex flex-col items-center text-center">
            <Link href={`/players/${player2.id}`} className="group flex flex-col items-center">
              <Avatar id={player2.id} name={player2.name} size="lg" />
              <div className="mt-2 text-base font-extrabold group-hover:underline">
                {shortName(player2.name)}
              </div>
            </Link>
            {player2.injured && <InjuredBadge className="mt-1" />}
            <div className="mt-1 text-xs font-semibold text-muted">
              {data.career2.gp} GP · {data.career2.wins}W - {data.career2.losses}L
            </div>
          </div>
        </div>

        {/* Win Ratio Bar */}
        {totalAgainst > 0 && (
          <div className="mt-6 space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className={p1Wins >= p2Wins ? "text-court-ink" : "text-muted"}>
                {p1WinPct}% ({against.p1Ppg.toFixed(1)} PPG)
              </span>
              <span className="text-[11px] font-medium text-muted">Direct Win Rate</span>
              <span className={p2Wins >= p1Wins ? "text-court-ink" : "text-muted"}>
                ({against.p2Ppg.toFixed(1)} PPG) {p2WinPct}%
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.08]">
              <div
                style={{ width: `${p1WinPct}%` }}
                className={`transition-all duration-500 ${
                  p1Wins >= p2Wins ? "bg-court-ink" : "bg-black/40"
                }`}
              />
              <div
                style={{ width: `${p2WinPct}%` }}
                className={`transition-all duration-500 ${
                  p2Wins >= p1Wins ? "bg-court-ink" : "bg-black/40"
                }`}
              />
            </div>
          </div>
        )}

        {/* Together Summary */}
        <div className="mt-5 border-t border-black/5 pt-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-1.5 text-xs font-semibold text-muted">
            <span>🤝 Teammate synergy:</span>
            {together.gp > 0 ? (
              <span className="font-bold text-ink">
                {together.wins}-{together.losses} together ({Math.round(together.winPct)}% win rate in {together.gp} games)
              </span>
            ) : (
              <span>Have not played on the same team yet</span>
            )}
          </div>
        </div>
      </section>

      {/* Matchup Games Accordion */}
      {against.matchups.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="label">Head-to-head games ({against.matchups.length})</h2>
            <button
              type="button"
              onClick={() => setShowGames(!showGames)}
              className="text-xs font-semibold text-court-ink hover:underline"
            >
              {showGames ? "Hide game logs" : "View game logs"}
            </button>
          </div>

          {showGames && (
            <ul className="space-y-2">
              {against.matchups.map((m) => {
                const p1Won = m.winnerId === player1.id;
                return (
                  <li key={m.id} className="glass-1 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            p1Won ? "bg-court-soft/20 text-court-ink" : "bg-black/[0.06] text-muted"
                          }`}
                        >
                          {p1Won ? `${shortName(player1.name)} Won` : `${shortName(player2.name)} Won`}
                        </span>
                        <span className="tabular font-extrabold text-sm">
                          {m.p1Score} – {m.p2Score}
                        </span>
                      </div>
                      <Link
                        href={`/games/${m.id}`}
                        className="font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        Box score →
                      </Link>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted">
                      <div>
                        <span className="font-bold text-ink">{shortName(player1.name)}:</span> {m.p1Line.pts} pts, {m.p1Line.reb} reb, {m.p1Line.ast} ast
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-ink">{shortName(player2.name)}:</span> {m.p2Line.pts} pts, {m.p2Line.reb} reb, {m.p2Line.ast} ast
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Tale of the Tape Stat Matrix */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
          <h2 className="label">Career stat battle</h2>
          {/* Category Filter Pills */}
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {(["all", "scoring", "impact", "defense", "shooting"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                  filter === k
                    ? "bg-ink text-paper shadow-xs"
                    : "bg-black/[0.05] text-muted hover:text-ink"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-1 divide-y divide-black/5 overflow-hidden rounded-3xl">
          {filteredMetrics.map((m) => {
            const isP1 = m.advantage === "p1";
            const isP2 = m.advantage === "p2";
            return (
              <div
                key={m.key}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3.5 sm:px-5"
              >
                {/* P1 Stat */}
                <div className="flex items-center gap-2">
                  <span
                    className={`tabular text-base font-extrabold sm:text-lg ${
                      isP1 ? "text-court-ink" : "text-ink"
                    }`}
                  >
                    {m.p1Display}
                  </span>
                  {isP1 && (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-court-soft/20 text-[10px] font-black text-court-ink">
                      ✓
                    </span>
                  )}
                </div>

                {/* Metric Name */}
                <div className="text-center">
                  <span className="text-xs font-bold text-muted">{m.label}</span>
                </div>

                {/* P2 Stat */}
                <div className="flex items-center justify-end gap-2 text-right">
                  {isP2 && (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-court-soft/20 text-[10px] font-black text-court-ink">
                      ✓
                    </span>
                  )}
                  <span
                    className={`tabular text-base font-extrabold sm:text-lg ${
                      isP2 ? "text-court-ink" : "text-ink"
                    }`}
                  >
                    {m.p2Display}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trophy Shelf Face-off */}
      <section className="space-y-3">
        <h2 className="label px-1">Trophy case face-off</h2>
        <div className="glass-1 divide-y divide-black/5 overflow-hidden rounded-3xl">
          {trophies.map((t) => {
            const isP1 = t.advantage === "p1";
            const isP2 = t.advantage === "p2";
            return (
              <div
                key={t.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3.5 sm:px-5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`tabular text-lg font-black ${
                      isP1 ? "text-court-ink" : t.p1Count === 0 ? "text-muted/40" : "text-ink"
                    }`}
                  >
                    {t.p1Count}
                  </span>
                  {isP1 && (
                    <span className="rounded-md bg-court-soft/20 px-1.5 py-0.5 text-[10px] font-bold text-court-ink">
                      Leader
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-center">
                  <span className="text-base">{t.emoji}</span>
                  <span className="text-xs font-bold text-muted">{t.label}</span>
                </div>

                <div className="flex items-center justify-end gap-2 text-right">
                  {isP2 && (
                    <span className="rounded-md bg-court-soft/20 px-1.5 py-0.5 text-[10px] font-bold text-court-ink">
                      Leader
                    </span>
                  )}
                  <span
                    className={`tabular text-lg font-black ${
                      isP2 ? "text-court-ink" : t.p2Count === 0 ? "text-muted/40" : "text-ink"
                    }`}
                  >
                    {t.p2Count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PlayerSelect({
  label,
  value,
  players,
  exclude,
  onChange,
}: {
  label: string;
  value: number;
  players: Player[];
  exclude: number;
  onChange: (id: number) => void;
}) {
  return (
    <div>
      <label className="label mb-1.5 block text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:ring-2 focus:ring-court-soft focus:outline-hidden"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === exclude}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

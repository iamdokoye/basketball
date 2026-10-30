"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, shortName } from "@/app/components/Avatar";
import {
  computeStandings,
  createTournament,
  recordMatch,
  type TournamentFormat,
  type TournamentState,
  type TournamentTeam,
} from "@/lib/tournaments";
import type { Player } from "@/lib/queries";

const STORAGE_KEY = "pickup_active_tournament_v1";

export function TournamentHub({
  players,
  initialTeams,
}: {
  players: Player[];
  initialTeams?: { name: string; playerIds: number[] }[];
}) {
  const [tournament, setTournament] = useState<TournamentState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [format, setFormat] = useState<TournamentFormat>("king_of_court");
  const [tourneyName, setTourneyName] = useState("Saturday King of the Court");
  const [targetScore, setTargetScore] = useState(15);
  const [teams, setTeams] = useState<TournamentTeam[]>(() => {
    if (initialTeams && initialTeams.length >= 2) {
      return initialTeams.map((t, idx) => ({
        id: `team-${idx + 1}`,
        name: t.name,
        playerIds: t.playerIds,
      }));
    }
    return [
      { id: "team-1", name: "Team Gold", playerIds: [] },
      { id: "team-2", name: "Team Black", playerIds: [] },
      { id: "team-3", name: "Team Blue", playerIds: [] },
    ];
  });
  const [scoreA, setScoreA] = useState<number>(15);
  const [scoreB, setScoreB] = useState<number>(12);

  function saveTournament(state: TournamentState | null) {
    setTournament(state);
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function startNewTournament() {
    // Validate teams have at least 2 players
    const validTeams = teams.filter((t) => t.playerIds.length >= 1);
    if (validTeams.length < 2) return;

    const t = createTournament(tourneyName, format, validTeams, targetScore);
    saveTournament(t);
  }

  function submitScore(matchId: string) {
    if (!tournament) return;
    const next = recordMatch(tournament, matchId, Number(scoreA), Number(scoreB));
    saveTournament(next);
  }

  function resetTournament() {
    if (confirm("Reset current tournament?")) {
      saveTournament(null);
    }
  }

  const getPlayer = (id: number) => players.find((p) => p.id === id);

  // If no active tournament, show creation wizard
  if (!tournament) {
    return (
      <div className="space-y-6">
        <div className="space-y-1 px-1">
          <div className="label text-court-ink">Bracket &amp; King of the Court</div>
          <h1 className="text-[32px] font-extrabold leading-[38px] tracking-tight">
            Tournament Hub
          </h1>
          <p className="text-sm text-muted">
            Organize a King of the Court run (winner stays on) or an official single-elimination weekend tournament.
          </p>
        </div>

        <div className="glass-1 space-y-5 rounded-3xl p-5 sm:p-6">
          <div className="space-y-3">
            <label className="label">1. Tournament format</label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  id: "king_of_court" as const,
                  title: "👑 King of the Court",
                  desc: "Winner stays on court. First to 3-game reign takes the crown.",
                },
                {
                  id: "single_elimination" as const,
                  title: "🏆 Single-Elimination",
                  desc: "Semi-finals into Championship Game (Gold Medal final).",
                },
                {
                  id: "round_robin" as const,
                  title: "🔄 Round-Robin",
                  desc: "Every squad plays each other once. Top 2 advance to Final.",
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    format === f.id
                      ? "border-court-soft/60 bg-court-soft/10 text-ink shadow-2xs"
                      : "border-black/5 bg-white/40 text-muted hover:text-ink"
                  }`}
                >
                  <div className="text-sm font-black">{f.title}</div>
                  <div className="mt-1 text-xs text-muted">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1.5 block text-xs">Tournament name</label>
              <input
                type="text"
                value={tourneyName}
                onChange={(e) => setTourneyName(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:outline-hidden"
              />
            </div>
            <div>
              <label className="label mb-1.5 block text-xs">Target score (first to)</label>
              <select
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-xs focus:outline-hidden"
              >
                <option value={11}>First to 11 pts</option>
                <option value={15}>First to 15 pts</option>
                <option value={21}>First to 21 pts</option>
              </select>
            </div>
          </div>

          {/* Teams Setup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">2. Participating squads ({teams.length})</label>
              <Link
                href="/builder"
                className="text-xs font-semibold text-court-ink hover:underline"
              >
                Build fair squads in Team Builder →
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t, idx) => (
                <div key={t.id} className="rounded-2xl border border-black/5 bg-white/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => {
                        const next = [...teams];
                        next[idx].name = e.target.value;
                        setTeams(next);
                      }}
                      className="text-sm font-black bg-transparent border-b border-black/10 focus:outline-hidden focus:border-court-ink"
                    />
                    <span className="text-xs text-muted">Squad {idx + 1}</span>
                  </div>

                  {/* Player pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {t.playerIds.map((pid) => {
                      const p = getPlayer(pid);
                      return (
                        <span
                          key={pid}
                          className="flex items-center gap-1 rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-bold"
                        >
                          {p?.name ? shortName(p.name) : `#${pid}`}
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...teams];
                              next[idx].playerIds = next[idx].playerIds.filter((x) => x !== pid);
                              setTeams(next);
                            }}
                            className="ml-1 text-muted hover:text-rose-600"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Add player selector */}
                  <select
                    value=""
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      if (!pid || t.playerIds.includes(pid)) return;
                      const next = [...teams];
                      next[idx].playerIds.push(pid);
                      setTeams(next);
                    }}
                    className="w-full rounded-lg border border-black/10 bg-white/90 px-2 py-1 text-xs font-semibold focus:outline-hidden"
                  >
                    <option value="">+ Add player to {t.name}</option>
                    {players
                      .filter((p) => !p.archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>

            {teams.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  setTeams((prev) => [
                    ...prev,
                    {
                      id: `team-${prev.length + 1}`,
                      name: `Squad ${prev.length + 1}`,
                      playerIds: [],
                    },
                  ])
                }
                className="text-xs font-semibold text-court-ink hover:underline"
              >
                + Add another squad
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={startNewTournament}
            disabled={teams.some((t) => t.playerIds.length === 0)}
            className="w-full rounded-2xl bg-court-ink py-3.5 text-center text-sm font-extrabold text-white shadow-md transition hover:opacity-90 disabled:opacity-40"
          >
            🔥 Launch Tournament
          </button>
        </div>
      </div>
    );
  }

  // --- ACTIVE TOURNAMENT VIEW ---
  const standings = computeStandings(tournament);
  const activeMatch = tournament.matches.find((m) => m.winnerTeamId === null);
  const finishedMatches = tournament.matches.filter((m) => m.winnerTeamId !== null);
  const kingTeam = tournament.teams.find((t) => t.id === tournament.currentKingTeamId);
  const champTeam = tournament.teams.find((t) => t.id === tournament.championTeamId);

  const teamA = tournament.teams.find((t) => t.id === activeMatch?.teamAId);
  const teamB = tournament.teams.find((t) => t.id === activeMatch?.teamBId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-court-soft/20 px-2.5 py-0.5 text-xs font-black text-court-ink uppercase">
              {tournament.format.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted">First to {tournament.targetScore}</span>
          </div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight mt-1">
            {tournament.name}
          </h1>
        </div>

        <button
          type="button"
          onClick={resetTournament}
          className="rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-muted hover:text-rose-600 transition"
        >
          Reset
        </button>
      </div>

      {/* Champion Banner (If Finished) */}
      {champTeam && (
        <section className="glass-2 relative overflow-hidden rounded-3xl p-6 text-center space-y-3">
          <div className="text-4xl animate-bounce">🏆</div>
          <div className="label text-court-ink">Tournament Champions &amp; Gold Medalists</div>
          <h2 className="text-3xl font-black">{champTeam.name}</h2>
          <div className="flex justify-center gap-2">
            {champTeam.playerIds.map((pid) => {
              const p = getPlayer(pid);
              if (!p) return null;
              return (
                <div key={pid} className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold shadow-2xs">
                  <Avatar id={pid} name={p.name} size="sm" />
                  <span>{p.name}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-2">
            This squad qualifies for the **Team of the Tournament** honor.
          </p>
        </section>
      )}

      {/* King of the Court Status Banner */}
      {tournament.format === "king_of_court" && !champTeam && (
        <section className="glass-1 rounded-3xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-2xl">
              👑
            </span>
            <div>
              <div className="text-xs font-bold text-amber-700">Current King of the Court</div>
              <div className="text-lg font-black">{kingTeam ? kingTeam.name : "Court Up for Grabs"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-muted">Reign Streak</div>
            <div className="tabular text-2xl font-black text-court-ink">
              {tournament.kingStreak ?? 0} {tournament.kingStreak === 1 ? "win" : "wins"}
            </div>
          </div>
        </section>
      )}

      {/* Live Match On Court */}
      {activeMatch && teamA && teamB && !champTeam && (
        <section className="glass-2 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-600">
              🔴 Live on Court · {activeMatch.label}
            </span>
            <Link
              href={`/games/new?teamA=${teamA.playerIds.join(",")}&teamB=${teamB.playerIds.join(",")}`}
              className="text-xs font-extrabold text-court-ink hover:underline"
            >
              Open Live Scorekeeper →
            </Link>
          </div>

          {/* Matchup Teams */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            {/* Team A */}
            <div className="rounded-2xl bg-white/60 p-3 space-y-1">
              <div className="text-sm font-black">{teamA.name}</div>
              <div className="text-[11px] text-muted">
                {teamA.playerIds.map((pid) => shortName(getPlayer(pid)?.name ?? "")).join(", ")}
              </div>
            </div>

            <div className="font-black text-xs text-muted">VS</div>

            {/* Team B */}
            <div className="rounded-2xl bg-white/60 p-3 space-y-1">
              <div className="text-sm font-black">{teamB.name}</div>
              <div className="text-[11px] text-muted">
                {teamB.playerIds.map((pid) => shortName(getPlayer(pid)?.name ?? "")).join(", ")}
              </div>
            </div>
          </div>

          {/* Quick Score Input Form */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-black/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted">Final Score:</span>
              <input
                type="number"
                value={scoreA}
                onChange={(e) => setScoreA(Number(e.target.value))}
                className="w-16 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-center text-sm font-black shadow-xs focus:outline-hidden"
              />
              <span className="font-bold text-muted">–</span>
              <input
                type="number"
                value={scoreB}
                onChange={(e) => setScoreB(Number(e.target.value))}
                className="w-16 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-center text-sm font-black shadow-xs focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => submitScore(activeMatch.id)}
              disabled={scoreA === scoreB}
              className="w-full sm:w-auto rounded-xl bg-court-ink px-5 py-2 text-xs font-black text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              Confirm Match Winner
            </button>
          </div>
        </section>
      )}

      {/* Tournament Standings */}
      <section className="space-y-2.5">
        <h2 className="label px-1">Tournament standings</h2>
        <div className="glass-1 divide-y divide-black/5 overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 p-3 px-4 text-[11px] font-black uppercase text-muted">
            <span className="w-5">#</span>
            <span>Squad</span>
            <span className="w-12 text-center">W-L</span>
            <span className="w-12 text-center">Diff</span>
            <span className="w-14 text-right">Streak</span>
          </div>

          {standings.map((s, idx) => (
            <div
              key={s.team.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 p-3 px-4 text-xs font-bold"
            >
              <span className="w-5 font-black text-muted">{idx + 1}</span>
              <div className="min-w-0">
                <div className="truncate font-extrabold">{s.team.name}</div>
                <div className="truncate text-[10px] text-muted">
                  {s.team.playerIds.map((pid) => shortName(getPlayer(pid)?.name ?? "")).join(", ")}
                </div>
              </div>
              <span className="tabular w-12 text-center font-black">
                {s.wins}-{s.losses}
              </span>
              <span className="tabular w-12 text-center text-muted">
                {s.diff > 0 ? `+${s.diff}` : s.diff}
              </span>
              <span className="tabular w-14 text-right font-extrabold text-court-ink">
                {s.streak > 0 ? `${s.streak}W` : s.streak < 0 ? `${Math.abs(s.streak)}L` : "–"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Finished Match History */}
      {finishedMatches.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="label px-1">Completed matchups ({finishedMatches.length})</h2>
          <ul className="space-y-2">
            {finishedMatches.map((m) => {
              const winner = tournament.teams.find((t) => t.id === m.winnerTeamId);
              const tA = tournament.teams.find((t) => t.id === m.teamAId);
              const tB = tournament.teams.find((t) => t.id === m.teamBId);
              return (
                <li key={m.id} className="glass-1 flex items-center justify-between rounded-2xl p-3 px-4 text-xs">
                  <div>
                    <span className="font-bold text-muted mr-2">{m.label}:</span>
                    <span className="font-extrabold">
                      {tA?.name} ({m.scoreA}) vs {tB?.name} ({m.scoreB})
                    </span>
                  </div>
                  <span className="rounded-full bg-court-soft/20 px-2.5 py-0.5 font-black text-court-ink">
                    {winner?.name} Won
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

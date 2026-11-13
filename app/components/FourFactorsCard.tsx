import type { TeamFourFactors } from "@/lib/analytics";

export function FourFactorsCard({
  factors,
}: {
  factors: { A: TeamFourFactors; B: TeamFourFactors };
}) {
  const { A, B } = factors;

  const metrics = [
    {
      label: "Effective FG% (eFG%)",
      sub: "Shooting efficiency with 3PT weighted",
      valA: `${A.efgPct}%`,
      valB: `${B.efgPct}%`,
      leader: A.efgPct > B.efgPct ? "A" : A.efgPct < B.efgPct ? "B" : "tie",
      diffA: A.efgPct,
      diffB: B.efgPct,
    },
    {
      label: "True Shooting% (TS%)",
      sub: "Scoring efficiency including Free Throws",
      valA: `${A.tsPct}%`,
      valB: `${B.tsPct}%`,
      leader: A.tsPct > B.tsPct ? "A" : A.tsPct < B.tsPct ? "B" : "tie",
      diffA: A.tsPct,
      diffB: B.tsPct,
    },
    {
      label: "Turnover Rate (TOV%)",
      sub: "Turnovers per 100 plays (lower is better)",
      valA: `${A.tovPct}%`,
      valB: `${B.tovPct}%`,
      leader: A.tovPct < B.tovPct ? "A" : A.tovPct > B.tovPct ? "B" : "tie",
      diffA: 100 - A.tovPct,
      diffB: 100 - B.tovPct,
    },
    {
      label: "Offensive Rebound% (ORB%)",
      sub: "Second-chance glass control",
      valA: `${A.orbPct}%`,
      valB: `${B.orbPct}%`,
      leader: A.orbPct > B.orbPct ? "A" : A.orbPct < B.orbPct ? "B" : "tie",
      diffA: A.orbPct,
      diffB: B.orbPct,
    },
    {
      label: "Free Throw Factor",
      sub: "Free throw attempts per shot taken",
      valA: `${A.ftRate.toFixed(2)}`,
      valB: `${B.ftRate.toFixed(2)}`,
      leader: A.ftRate > B.ftRate ? "A" : A.ftRate < B.ftRate ? "B" : "tie",
      diffA: A.ftRate * 100,
      diffB: B.ftRate * 100,
    },
  ];

  return (
    <div className="glass-2 space-y-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <div className="label text-court-ink">Dean Oliver Analytics</div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            The Four Factors
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1.5 text-court-ink">
            <span className="h-2 w-2 rounded-full bg-court-soft" />
            Team A ({A.ortg} ORTG)
          </span>
          <span className="flex items-center gap-1.5 text-sky-950">
            <span className="h-2 w-2 rounded-full bg-away-soft" />
            Team B ({B.ortg} ORTG)
          </span>
        </div>
      </div>

      <div className="divide-y divide-black/[0.05]">
        {metrics.map((m) => (
          <div key={m.label} className="py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span
                className={`tabular text-sm font-extrabold ${
                  m.leader === "A" ? "text-court-ink font-black" : "text-muted"
                }`}
              >
                {m.valA}
              </span>
              <div className="text-center">
                <div className="font-bold text-ink">{m.label}</div>
                <div className="text-[10px] text-muted">{m.sub}</div>
              </div>
              <span
                className={`tabular text-sm font-extrabold ${
                  m.leader === "B" ? "text-sky-950 font-black" : "text-muted"
                }`}
              >
                {m.valB}
              </span>
            </div>

            {/* Visual tug of war bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="bg-court-soft transition-all"
                style={{
                  width: `${(m.diffA / Math.max(1, m.diffA + m.diffB)) * 100}%`,
                }}
              />
              <div
                className="bg-away-soft transition-all"
                style={{
                  width: `${(m.diffB / Math.max(1, m.diffA + m.diffB)) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] p-3 text-xs">
        <div>
          <span className="font-bold text-muted">Est. Possessions: </span>
          <span className="font-extrabold">{A.possessions} plays</span>
        </div>
        <div className="flex gap-4">
          <span>
            <b>Team A Net:</b>{" "}
            <span className={A.netRtg >= 0 ? "text-win font-bold" : "text-loss font-bold"}>
              {A.netRtg >= 0 ? `+${A.netRtg}` : A.netRtg}
            </span>
          </span>
          <span>
            <b>Team B Net:</b>{" "}
            <span className={B.netRtg >= 0 ? "text-win font-bold" : "text-loss font-bold"}>
              {B.netRtg >= 0 ? `+${B.netRtg}` : B.netRtg}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

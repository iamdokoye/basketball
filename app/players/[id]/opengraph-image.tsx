import { ImageResponse } from "next/og";
import { careerTotals, listGames, listPlayers } from "@/lib/queries";
import { rankPlayers } from "@/lib/rankings";
import { OG_CONTENT_TYPE, OG_SIZE, OgChip, OgFrame, ogFonts } from "@/lib/og";

// The player card preview, so a profile link opens with the numbers already in view.
export const alt = "Pickup League player profile";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 300;

const C = {
  ink: "#1c1917",
  muted: "#6f6762",
  court: "#ea580c",
  paper: "#f4f1ec",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "18px 30px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.62)",
        border: "1px solid rgba(0,0,0,0.06)",
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700, color: C.ink }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: 1.2,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  const [players, games] = await Promise.all([listPlayers(), listGames()]);
  const player = players.find((p) => p.id === playerId);
  const fonts = await ogFonts();

  if (!player) {
    return new ImageResponse(
      (
        <OgFrame>
          <div style={{ display: "flex", fontSize: 70, fontWeight: 700 }}>
            Player not found
          </div>
        </OgFrame>
      ),
      { ...size, fonts },
    );
  }

  const career = careerTotals(games, players);
  const { rows } = rankPlayers(career, "rating", games.filter((g) => g.status === "final").length);
  const row = rows.find((r) => r.playerId === playerId);
  const gp = row?.gp ?? 0;
  const per = (n: number) => (gp > 0 ? (n / gp).toFixed(1) : "–");
  const initials = player.name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return new ImageResponse(
    (
      <OgFrame footer={`${gp} games played · ${row?.wins ?? 0} wins · Pickup League`}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 34,
            marginBottom: 30,
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 9999,
              background: `linear-gradient(145deg, #fd651e 0%, ${C.court} 65%, #c2410c 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2.5,
                lineHeight: 1,
                color: C.ink,
              }}
            >
              {player.name}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <OgChip tone="court">
                {row?.rank ? `Rank #${row.rank}` : "Unranked"}
              </OgChip>
              <OgChip tone="muted">
                {(row?.rating ?? 0).toFixed(1)} rating
              </OgChip>
              {player.injured && <OgChip tone="away">Injured</OgChip>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <Stat label="PPG" value={per(row?.pts ?? 0)} />
          <Stat label="RPG" value={per(row?.reb ?? 0)} />
          <Stat label="APG" value={per(row?.ast ?? 0)} />
          <Stat
            label="FG%"
            value={
              row && row.fga > 0 ? `${Math.round((row.fgm / row.fga) * 100)}%` : "–"
            }
          />
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}

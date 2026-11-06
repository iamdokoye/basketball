import { ImageResponse } from "next/og";
import { formatGameDateTime } from "@/lib/format";
import { playerOfTheGame } from "@/lib/pog";
import { getGame } from "@/lib/queries";
import { OG_CONTENT_TYPE, OG_SIZE, OgChip, OgFrame, ogFonts } from "@/lib/og";

// The scoreboard preview for a game link, so a shared result looks like a result.
export const alt = "Pickup League box score";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 60;

const C = {
  ink: "#1c1917",
  muted: "#6f6762",
  court: "#ea580c",
  away: "#0284c7",
};

function teamNames(game: NonNullable<Awaited<ReturnType<typeof getGame>>>, t: "A" | "B") {
  const names = game.roster
    .filter((p) => p.team === t)
    .map((p) => p.name.split(" ")[0]);
  const text = names.join(" · ");
  return text.length > 44 ? `${text.slice(0, 43)}…` : text;
}

function TeamColumn({
  label,
  names,
  align,
  color,
}: {
  label: string;
  names: string;
  align: "flex-start" | "flex-end";
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        width: 300,
        textAlign: align === "flex-end" ? "right" : "left",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 21,
          fontWeight: 600,
          color: C.muted,
          marginTop: 8,
          lineHeight: 1.3,
        }}
      >
        {names}
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
  const game = await getGame(Number(id));
  const fonts = await ogFonts();

  if (!game) {
    return new ImageResponse(
      (
        <OgFrame>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 70,
              fontWeight: 700,
              letterSpacing: -2,
            }}
          >
            Game not found
          </div>
        </OgFrame>
      ),
      { ...size, fonts },
    );
  }

  const pog = playerOfTheGame(game);
  const live = game.status === "live";

  return new ImageResponse(
    (
      <OgFrame footer={`${formatGameDateTime(game.playedAt)} · Pickup League`}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <OgChip tone={live ? "win" : "court"}>{live ? "Live" : "Final"}</OgChip>
            <div
              style={{
                display: "flex",
                fontSize: 21,
                fontWeight: 700,
                color: C.muted,
              }}
            >
              {game.gameType === "timed"
                ? `${game.quarterCount} × ${game.quarterMinutes} min`
                : `First to ${game.target}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 36,
              width: "100%",
            }}
          >
            <TeamColumn
              label="TEAM A"
              names={teamNames(game, "A")}
              align="flex-end"
              color={C.court}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "0 10px",
              }}
            >
              <span
                style={{
                  fontSize: 150,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: -6,
                  color: C.court,
                }}
              >
                {game.score.A}
              </span>
              <span style={{ fontSize: 54, fontWeight: 600, color: C.muted }}>
                –
              </span>
              <span
                style={{
                  fontSize: 150,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: -6,
                  color: C.away,
                }}
              >
                {game.score.B}
              </span>
            </div>
            <TeamColumn
              label="TEAM B"
              names={teamNames(game, "B")}
              align="flex-start"
              color={C.away}
            />
          </div>

          {pog && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 26px",
                borderRadius: 22,
                background: "rgba(255,255,255,0.62)",
                border: "1px solid rgba(0,0,0,0.06)",
                fontSize: 24,
                fontWeight: 600,
                color: C.ink,
              }}
            >
              <span style={{ color: C.court, fontWeight: 700 }}>
                Player of the game
              </span>
              <span style={{ color: C.muted }}>·</span>
              <span>{pog.line.name}</span>
              <span style={{ color: C.muted }}>
                {pog.line.pts} pts, {pog.line.reb} reb, {pog.line.ast} ast
              </span>
            </div>
          )}
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}

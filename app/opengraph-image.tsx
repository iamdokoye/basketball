import { ImageResponse } from "next/og";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgChip,
  OgFrame,
  ogFonts,
} from "@/lib/og";

// The preview shown when the league link is pasted into WhatsApp, X, Slack, etc.
export const alt = "Pickup League — 3v3 stats for the crew";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <OgChip tone="court">Live scoring</OgChip>
            <OgChip tone="away">Shot charts</OgChip>
            <OgChip tone="win">Title cards</OgChip>
          </div>
          {/* Satori ignores <br />, so each headline line is its own row. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: -2.6,
              lineHeight: 1.05,
            }}
          >
            <div style={{ display: "flex" }}>Every bucket.</div>
            <div style={{ display: "flex" }}>On the record.</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              color: "#6f6762",
              maxWidth: 780,
              lineHeight: 1.4,
            }}
          >
            Score a game from your phone, get box scores, ratings, shot charts
            and shareable cards the moment the buzzer sounds.
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}

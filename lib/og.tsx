import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import type { ImageResponse } from "next/og";

// Shared look for the link-preview images (og:image). Satori only understands flexbox and a small
// slice of CSS, so everything here is explicit: no grid, no CSS variables, no external images.
// The Geist font files ship with the `geist` package; if they can't be read the bundled default
// face is used instead, so a preview always renders.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"];

let fontCache: Fonts | undefined;
let fontTried = false;

export async function ogFonts(): Promise<Fonts | undefined> {
  if (fontTried) return fontCache;
  fontTried = true;
  try {
    const dir = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
    const [regular, semibold, bold] = await Promise.all([
      readFile(join(dir, "Geist-Regular.ttf")),
      readFile(join(dir, "Geist-SemiBold.ttf")),
      readFile(join(dir, "Geist-Bold.ttf")),
    ]);
    fontCache = [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
      { name: "Geist", data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    fontCache = undefined;
  }
  return fontCache;
}

const C = {
  paper: "#f4f1ec",
  ink: "#1c1917",
  muted: "#6f6762",
  court: "#ea580c",
  courtSoft: "#fd651e",
  away: "#0284c7",
  win: "#059669",
  white: "#ffffff",
};

/** The orange ball used as the league mark, drawn with divs so it needs no asset. */
function Mark({ size = 64 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: `linear-gradient(145deg, ${C.courtSoft} 0%, ${C.court} 60%, #c2410c 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: 9999,
          border: `${Math.max(2, size * 0.045)}px solid rgba(255,255,255,0.92)`,
          display: "flex",
        }}
      />
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <Mark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: -0.5,
            color: C.ink,
          }}
        >
          Pickup League
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: C.muted,
            marginTop: 5,
          }}
        >
          3v3 stats for the crew
        </div>
      </div>
    </div>
  );
}

export function OgFrame({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: C.paper,
        padding: "56px 64px",
        position: "relative",
        fontFamily: "Geist, sans-serif",
        color: C.ink,
      }}
    >
      {/* Soft colour blobs behind the glass, matching the app's backdrop. */}
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -120,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background: "rgba(253,101,30,0.20)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -300,
          left: -200,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: "rgba(2,132,199,0.10)",
          display: "flex",
        }}
      />
      <div style={{ display: "flex", position: "relative", flexShrink: 0 }}>
        <Wordmark />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          flexGrow: 1,
          flexShrink: 1,
          justifyContent: "center",
          paddingTop: 14,
        }}
      >
        {children}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          fontSize: 20,
          fontWeight: 600,
          color: C.muted,
        }}
      >
        <span>{footer ?? "Live scores · Title cards · Records"}</span>
        <span style={{ color: C.court, fontWeight: 700 }}>pickup league</span>
      </div>
    </div>
  );
}

/** A small rounded label, e.g. "FINAL" or "MVP". */
export function OgChip({
  children,
  tone = "court",
}: {
  children: ReactNode;
  tone?: "court" | "away" | "win" | "muted";
}) {
  const bg = {
    court: "rgba(234,88,12,0.13)",
    away: "rgba(2,132,199,0.13)",
    win: "rgba(5,150,105,0.13)",
    muted: "rgba(0,0,0,0.07)",
  }[tone];
  const fg = {
    court: C.court,
    away: C.away,
    win: C.win,
    muted: C.muted,
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 18px",
        borderRadius: 9999,
        background: bg,
        color: fg,
        fontSize: 21,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

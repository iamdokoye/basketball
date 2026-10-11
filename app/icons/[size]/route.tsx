import { ImageResponse } from "next/og";

// App icons, drawn on demand: /icons/192, /icons/512, /icons/maskable (full-bleed with a safe
// zone, for Android) and /icons/apple (full-bleed, iOS rounds the corners itself).
const SPECS: Record<string, { px: number; ball: number; radius: number }> = {
  "192": { px: 192, ball: 0.62, radius: 0.22 },
  "512": { px: 512, ball: 0.62, radius: 0.22 },
  maskable: { px: 512, ball: 0.5, radius: 0 },
  apple: { px: 180, ball: 0.62, radius: 0 },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const spec = SPECS[(await params).size];
  if (!spec) return new Response("Not found", { status: 404 });
  const ball = Math.round(spec.px * spec.ball);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(145deg, #fd651e 0%, #ea580c 55%, #c2410c 100%)",
        borderRadius: Math.round(spec.px * spec.radius),
      }}
    >
      <svg
        width={ball}
        height={ball}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
      </svg>
    </div>,
    {
      width: spec.px,
      height: spec.px,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}

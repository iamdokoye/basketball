"use client";

/**
 * Last-resort boundary: only used when the root layout itself fails, so it replaces the document
 * and cannot rely on globals.css. Styles are inline to keep it readable with no CSS.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
  reset?: () => void;
}) {
  const digest =
    error instanceof Error
      ? (error as Error & { digest?: string }).digest
      : undefined;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4f1ec",
          color: "#1c1917",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}
      >
        <title>Pickup League</title>
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 28,
            padding: "32px 24px",
          }}
        >
          <div style={{ fontSize: 36 }} aria-hidden>
            🏀
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "12px 0 8px" }}>
            We lost the ball
          </h1>
          <p style={{ fontSize: 14, color: "#6f6762", margin: "0 0 20px" }}>
            The app couldn&apos;t start. Reload to try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 999,
              border: 0,
              background: "#1c1917",
              color: "#f4f1ec",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {digest ? (
            <p style={{ fontSize: 11, color: "#6f6762", marginTop: 14 }}>
              Code: {digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

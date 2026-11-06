// Draws a finished game's box score as a 1080 x 1350 PNG (4:5, the size WhatsApp and Instagram
// show without cropping). Like the award cards it is drawn on the phone, so it costs the server
// nothing and works offline.

const W = 1080;
const H = 1350;
const PAD = 56;

const INK = "#1c1917";
const PAPER = "#f4f1ec";
const MUTED = "#6f6762";
const COURT = "#ea580c";
const AWAY = "#0284c7";

export type BoxScoreRow = {
  name: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
};

export type BoxScoreImageData = {
  /** "Final" or "Live". */
  status: string;
  /** Already formatted for the league's timezone, e.g. "Fri 6 Nov · 4 × 10 min". */
  subtitle: string;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | null;
  teamA: BoxScoreRow[];
  teamB: BoxScoreRow[];
  /** Name of the player of the game, shown in the footer. */
  pogName?: string;
  /** Shown bottom-right (the site's host). */
  host: string;
};

export function boxScoreFileName(data: BoxScoreImageData): string {
  return `pickup-league-box-score-${data.scoreA}-${data.scoreB}.png`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "center" | "right" = "left",
) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/** Renders the box score to a PNG blob. */
export async function renderBoxScorePng(
  data: BoxScoreImageData,
): Promise<Blob> {
  const family =
    getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  try {
    await Promise.all(
      [800, 700, 600, 500].map((w) => document.fonts.load(`${w} 48px ${family}`)),
    );
    await document.fonts.ready;
  } catch {
    /* draw with whatever is available */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser.");

  // ---- background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // ---- dark scoreboard header
  const HEAD = 430;
  const bg = ctx.createLinearGradient(0, 0, W, HEAD);
  bg.addColorStop(0, "#1c1917");
  bg.addColorStop(1, "#302a26");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, HEAD);
  // a warm glow behind the score
  const glow = ctx.createRadialGradient(W / 2, 250, 0, W / 2, 250, 460);
  glow.addColorStop(0, "rgba(253,101,30,0.34)");
  glow.addColorStop(1, "rgba(253,101,30,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, HEAD);

  ctx.textBaseline = "alphabetic";
  ctx.font = `700 22px ${family}`;
  ctx.fillStyle = "#fdba74";
  spaced(ctx, "PICKUP LEAGUE", PAD, 66, 4);

  // status pill
  ctx.font = `700 20px ${family}`;
  const label = data.status.toUpperCase();
  const pillW = 44 + ctx.measureText(label).width + 44;
  ctx.fillStyle =
    data.status.toLowerCase() === "live"
      ? "rgba(5,150,105,0.22)"
      : "rgba(255,255,255,0.12)";
  roundRect(ctx, W - PAD - pillW, 42, pillW, 44, 22);
  ctx.fill();
  ctx.fillStyle = data.status.toLowerCase() === "live" ? "#6ee7b7" : "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(label, W - PAD - pillW / 2, 71);
  ctx.textAlign = "left";

  ctx.font = `500 21px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(data.subtitle, PAD, 118);

  // team labels
  ctx.font = `700 22px ${family}`;
  ctx.fillStyle = "#fdba74";
  spaced(ctx, "TEAM A", PAD + 8, 212, 3);
  ctx.fillStyle = "#7dd3fc";
  spaced(ctx, "TEAM B", W - PAD - 8, 212, 3, "right");

  // score
  ctx.textBaseline = "middle";
  ctx.font = `800 196px ${family}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#fd651e";
  ctx.fillText(String(data.scoreA), PAD, 318);
  ctx.textAlign = "right";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(String(data.scoreB), W - PAD, 318);
  ctx.textAlign = "center";
  ctx.font = `600 84px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.fillText("–", W / 2, 316);

  // winner marker
  if (data.winner) {
    ctx.font = `700 18px ${family}`;
    const who = data.winner === "A" ? "TEAM A WINS" : "TEAM B WINS";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    spaced(ctx, who, W / 2, 406, 3, "center");
  }

  // ---- tables
  const COLS: { key: keyof Omit<BoxScoreRow, "name">; label: string }[] = [
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
    { key: "tov", label: "TO" },
  ];
  const COL_W = 84;
  const NUM_RIGHT = W - PAD;
  const NAME_MAX = W - PAD * 2 - COL_W * COLS.length - 16;

  let y = 512;
  // A full 12-player game has to fit above the footer, so rows tighten up as the roster grows.
  const totalPlayers = data.teamA.length + data.teamB.length;
  const rowH = totalPlayers > 8 ? 44 : totalPlayers > 6 ? 50 : 58;
  // Totals need a little room; skip them only when a full 12-player game has to stay above the footer.
  const showTotals = totalPlayers <= 9;
  const drawTeam = (rows: BoxScoreRow[], team: "A" | "B") => {
    const color = team === "A" ? COURT : AWAY;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `700 20px ${family}`;
    ctx.fillStyle = color;
    spaced(ctx, `TEAM ${team}`, PAD, y, 3);

    // column headings
    ctx.font = `700 16px ${family}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    COLS.forEach((c, i) => {
      ctx.fillText(c.label, NUM_RIGHT - (COLS.length - 1 - i) * COL_W, y);
    });
    y += 22;

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 10);
    ctx.lineTo(W - PAD, y - 10);
    ctx.stroke();

    for (const r of rows) {
      y += rowH;
      const isPog = data.pogName === r.name;
      if (isPog) {
        ctx.fillStyle = "rgba(234,88,12,0.09)";
        roundRect(ctx, PAD - 10, y - rowH / 2 - 5, W - PAD * 2 + 20, rowH - 6, 12);
        ctx.fill();
      }

      ctx.textAlign = "left";
      ctx.font = `600 ${rowH >= 50 ? 24 : 21}px ${family}`;
      ctx.fillStyle = INK;
      ctx.fillText(ellipsize(ctx, r.name, NAME_MAX), PAD, y);

      ctx.textAlign = "right";
      ctx.font = `700 ${rowH >= 50 ? 25 : 22}px ${family}`;
      COLS.forEach((c, i) => {
        if (c.key === "pts") ctx.fillStyle = INK;
        else ctx.fillStyle = MUTED;
        ctx.fillText(
          String(r[c.key]),
          NUM_RIGHT - (COLS.length - 1 - i) * COL_W,
          y,
        );
      });
    }

    if (showTotals && rows.length > 0) {
      const total = rows.reduce(
        (acc, r) => {
          for (const c of COLS) acc[c.key] += r[c.key];
          return acc;
        },
        { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 } as Record<
          (typeof COLS)[number]["key"],
          number
        >,
      );
      y += rowH - 4;
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(PAD, y - rowH / 2 - 2);
      ctx.lineTo(W - PAD, y - rowH / 2 - 2);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.font = `700 18px ${family}`;
      ctx.fillStyle = color;
      spaced(ctx, "TEAM TOTAL", PAD, y, 2);

      ctx.textAlign = "right";
      ctx.font = `700 22px ${family}`;
      COLS.forEach((c, i) => {
        ctx.fillStyle = c.key === "pts" ? color : MUTED;
        ctx.fillText(
          String(total[c.key]),
          NUM_RIGHT - (COLS.length - 1 - i) * COL_W,
          y,
        );
      });
    }

    y += 62;
  };

  drawTeam(data.teamA, "A");
  drawTeam(data.teamB, "B");

  // ---- footer
  const fy = H - 66;
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 44);
  ctx.lineTo(W - PAD, fy - 44);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `600 21px ${family}`;
  ctx.fillStyle = MUTED;
  if (data.pogName) {
    const tag = "Player of the game";
    ctx.fillStyle = COURT;
    ctx.font = `700 21px ${family}`;
    ctx.fillText(tag, PAD, fy - 8);
    const tagW = ctx.measureText(tag).width;
    ctx.fillStyle = INK;
    ctx.font = `600 21px ${family}`;
    ctx.fillText(
      ellipsize(ctx, ` · ${data.pogName}`, W - PAD * 2 - tagW - 360),
      PAD + tagW + 4,
      fy - 8,
    );
  } else {
    ctx.fillText("Box score", PAD, fy - 8);
  }

  ctx.textAlign = "right";
  ctx.font = `700 21px ${family}`;
  ctx.fillStyle = COURT;
  ctx.fillText(ellipsize(ctx, data.host, 340), W - PAD, fy - 8);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Couldn't draw the picture.");
  return blob;
}

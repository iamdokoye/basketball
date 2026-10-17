import { TIER_LABEL, type AwardCardData, type Tier } from "@/lib/cards";

// Draws a title card as a PNG (1080 x 1350, 4:5, which WhatsApp and Instagram show without cropping), a
// full rectangle with no transparent corners so chat apps don't paint them black.
// It is drawn on a canvas in the browser, so it costs the server nothing, works offline, and the emoji
// come from the phone's own emoji font. The look mirrors the card on screen (AwardCard + globals.css).

const W = 1080;
const H = 1350;
const PAD = 64;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

type Palette = { stops: [string, string, string]; glow: string; edge: string };
const PALETTE: Record<Tier, Palette> = {
  week: { stops: ["#7c2d12", "#c2410c", "#fb923c"], glow: "255,255,255", edge: "rgba(255,255,255,0.28)" },
  month: { stops: ["#172554", "#1d4ed8", "#60a5fa"], glow: "255,255,255", edge: "rgba(255,255,255,0.28)" },
  year: { stops: ["#713f12", "#a16207", "#facc15"], glow: "253,224,71", edge: "rgba(253,224,71,0.8)" },
};
const STARS: Record<Tier, string> = { week: "★", month: "★★", year: "★★★" };

type Input = Pick<
  AwardCardData,
  "tier" | "emoji" | "categoryLabel" | "title" | "tagline" | "name" | "value" | "detail" | "periodLabel"
>;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Text with letter spacing, drawn by hand because ctx.letterSpacing isn't in every browser. */
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
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

/** Shrinks the font until the text fits `max` wide; returns the final size. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, min: number, max: number, family: string) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > max && size > min) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Cuts text with an ellipsis so it fits `max` wide at the current font. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/** Greedy word wrap into at most `maxLines` lines (the last one is ellipsized). */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, lines.slice(maxLines - 1).join(" "), max);
    return kept;
  }
  return lines;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export function cardFileName(c: { title: string; tier: Tier; periodKey: string }): string {
  const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `pickup-league-${slug}-${c.tier}-${c.periodKey}.png`;
}

/** Renders the card to a PNG blob. */
export async function renderCardPng(card: Input): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  // The page font must be loaded before it is used on a canvas, or the text falls back to a plain face.
  try {
    await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(`${w} 48px ${family}`)));
    await document.fonts.ready;
  } catch {
    /* draw with whatever is available */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser.");
  const pal = PALETTE[card.tier];
  const panelTop = H - 480;

  // ---- the card: gradient, border, shine
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, W * 0.27, H);
  bg.addColorStop(0, pal.stops[0]);
  bg.addColorStop(0.58, pal.stops[1]);
  bg.addColorStop(1, pal.stops[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (card.tier === "year") {
    const hi = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 720);
    hi.addColorStop(0, "rgba(253,224,71,0.5)");
    hi.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, W, H);
    // a diagonal sheen
    const sheen = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, H * 0.55);
    sheen.addColorStop(0.35, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.22)");
    sheen.addColorStop(0.65, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- header: level badge and stars
  ctx.textBaseline = "middle";
  ctx.font = `800 30px ${family}`;
  const label = TIER_LABEL[card.tier].toUpperCase();
  const badgeW = 40 + [...label].reduce((a, c) => a + ctx.measureText(c).width + 5, -5) + 40;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, PAD, PAD, badgeW, 62, 31);
  ctx.fill();
  ctx.fillStyle = "#fff";
  spaced(ctx, label, PAD + 40, PAD + 33, 5);
  ctx.font = `700 52px ${family}`;
  ctx.fillStyle = "#fde68a";
  ctx.textAlign = "right";
  ctx.fillText(STARS[card.tier], W - PAD, PAD + 33);

  // ---- the big picture
  const cy = 368;
  const glow = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, 330);
  glow.addColorStop(0, `rgba(${pal.glow},0.55)`);
  glow.addColorStop(1, `rgba(${pal.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, cy - 340, W, 680);
  ctx.textAlign = "center";
  ctx.font = `280px ${EMOJI_FONT}`;
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#fff";
  ctx.fillText(card.emoji, W / 2, cy);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ---- category, title, tagline
  ctx.font = `800 34px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  spaced(ctx, card.categoryLabel.toUpperCase(), W / 2, 602, 6, "center");

  const title = card.title.toUpperCase();
  const maxTitle = W - PAD * 2 - 20;
  let titleLines = [title];
  let titleSize = fit(ctx, title, 900, 124, 76, maxTitle, family);
  if (ctx.measureText(title).width > maxTitle) {
    // Too long for one line even small: split the words into two balanced lines.
    const words = title.split(" ");
    let best = [title];
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) [best, bestDiff] = [[a, b], diff];
    }
    titleLines = best;
    titleSize = Math.min(...titleLines.map((l) => fit(ctx, l, 900, 112, 64, maxTitle, family)));
  }
  ctx.font = `900 ${titleSize}px ${family}`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  const lineH = titleSize * 1.08;
  const titleTop = 602 + 46 + lineH / 2; // centre of the first line, just under the category
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, titleTop + i * lineH));
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.font = `600 38px ${family}`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const tagTop = titleTop + (titleLines.length - 1) * lineH + lineH / 2 + 46;
  const tagLines = wrap(ctx, card.tagline, W - PAD * 2 - 60, 2);
  // Only draw the tagline if it clears the white panel (a very long, two-line title can push it down).
  if (tagTop + (tagLines.length - 1) * 48 + 26 < panelTop - 8)
    tagLines.forEach((l, i) => ctx.fillText(l, W / 2, tagTop + i * 48));

  // ---- the white panel
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, 0, panelTop, W, H - panelTop + 4, [64, 64, 0, 0]);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(PAD + 54, panelTop + 86, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 44px ${family}`;
  ctx.textAlign = "center";
  ctx.fillText(initials(card.name), PAD + 54, panelTop + 88);

  ctx.textAlign = "left";
  ctx.fillStyle = "#1c1917";
  ctx.font = `800 58px ${family}`;
  ctx.fillText(ellipsize(ctx, card.name, W - PAD * 2 - 140), PAD + 134, panelTop + 88);

  const valueSize = fit(ctx, card.value, 900, 150, 80, W - PAD * 2, family);
  ctx.font = `900 ${valueSize}px ${family}`;
  ctx.fillStyle = "#a73a00";
  ctx.fillText(card.value, PAD, panelTop + 216);

  ctx.font = `600 38px ${family}`;
  ctx.fillStyle = "#6f6762";
  ctx.fillText(ellipsize(ctx, card.detail, W - PAD * 2), PAD, panelTop + 304);

  // ---- footer
  ctx.fillStyle = "rgba(28,25,23,0.08)";
  ctx.fillRect(PAD, H - 104, W - PAD * 2, 2);
  ctx.font = `700 28px ${family}`;
  ctx.fillStyle = "#6f6762";
  spaced(ctx, ellipsize(ctx, card.periodLabel.toUpperCase(), 420), PAD, H - 54, 3);
  ctx.font = `800 30px ${family}`;
  ctx.fillStyle = "#1c1917";
  const brand = "Pickup League";
  const bw = ctx.measureText(brand).width;
  ctx.textAlign = "right";
  ctx.fillText(brand, W - PAD, H - 54);
  ctx.font = `32px ${EMOJI_FONT}`;
  ctx.fillText("🏀", W - PAD - bw - 12, H - 54);

  ctx.restore();
  // inner edge, drawn last so it sits over everything
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = card.tier === "year" ? 10 : 4;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image."))), "image/png"),
  );
}

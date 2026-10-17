"use client";

import { useEffect, useRef } from "react";
import type { ShowTier } from "@/lib/slideshow";

export type Burst = { id: number; kind: "reveal" | "finale" };

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rect: boolean;
  rot: number;
  vr: number;
};

const CONFETTI = ["#60a5fa", "#93c5fd", "#fbbf24", "#ffffff", "#38bdf8", "#fb923c"];
const GOLD = ["#fde047", "#facc15", "#fbbf24", "#ffffff", "#fb923c", "#f87171"];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * A canvas over the slide. Months get a shower of confetti on each reveal; years get fireworks (and a
 * constant drift of gold dust). Nothing is drawn for people who ask for reduced motion.
 */
export function ShowParticles({ tier, burst }: { tier: ShowTier; burst: Burst | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useRef<P[]>([]);
  const spawn = useRef<(b: Burst) => void>(() => {});
  const lastId = useRef(0);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);

    const firework = (x: number, y: number, n: number) => {
      const color = pick(GOLD);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
        const s = rand(1.5, 5.2);
        parts.current.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.05, drag: 0.985,
          life: 0, max: rand(55, 95), size: rand(1.5, 3), color: Math.random() < 0.7 ? color : pick(GOLD),
          rect: false, rot: 0, vr: 0,
        });
      }
    };
    const confetti = (n: number, palette: string[]) => {
      for (let i = 0; i < n; i++)
        parts.current.push({
          x: rand(0, w), y: rand(-h * 0.2, -10), vx: rand(-1.2, 1.2), vy: rand(1.5, 4.2), g: 0.03, drag: 0.995,
          life: 0, max: rand(140, 230), size: rand(5, 9), color: pick(palette),
          rect: true, rot: rand(0, 6.28), vr: rand(-0.18, 0.18),
        });
    };

    spawn.current = (b) => {
      if (tier === "month") {
        confetti(b.kind === "finale" ? 150 : 90, CONFETTI);
        return;
      }
      const shots = b.kind === "finale" ? 9 : 3;
      for (let i = 0; i < shots; i++)
        setTimeout(() => firework(rand(w * 0.15, w * 0.85), rand(h * 0.12, h * 0.5), 70), i * 260);
      if (b.kind === "finale") confetti(120, GOLD);
    };

    let raf = 0;
    let dust = 0;
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      // Gold dust drifting up, all year long, on the year show.
      if (tier === "year" && ++dust % 6 === 0 && parts.current.length < 400)
        parts.current.push({
          x: rand(0, w), y: h + 6, vx: rand(-0.2, 0.2), vy: rand(-0.9, -0.3), g: 0, drag: 1,
          life: 0, max: rand(260, 420), size: rand(1, 2.4), color: "#fde68a", rect: false, rot: 0, vr: 0,
        });
      const next: P[] = [];
      for (const p of parts.current) {
        p.life++;
        if (p.life > p.max) continue;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const fade = 1 - p.life / p.max;
        ctx.globalAlpha = p.rect ? Math.min(1, fade * 2) : fade;
        ctx.fillStyle = p.color;
        if (p.rect) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 6.2832);
          ctx.fill();
        }
        next.push(p);
      }
      ctx.globalAlpha = 1;
      parts.current = next;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      spawn.current = () => {};
      parts.current = [];
    };
  }, [tier]);

  useEffect(() => {
    if (burst && burst.id !== lastId.current) {
      lastId.current = burst.id;
      spawn.current(burst);
    }
  }, [burst]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full" />;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIMING, type Show, type Slide } from "@/lib/slideshow";
import { shortName } from "./Avatar";
import { createShowMusic } from "./showMusic";
import { ShowParticles, type Burst } from "./ShowParticles";

const BUILD_AT = 300; // ms into an award slide when the drumroll starts

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => 1 - (1 - clamp01(n)) ** 3;

/** Full-screen recap of a finished month or year, with music. Tap right/left for next/previous. */
export function Slideshow({ show, backHref }: { show: Show; backHref: string }) {
  const router = useRouter();
  const { tier, slides } = show;
  const timing = TIMING[tier];
  const year = tier === "year";

  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);

  const music = useMemo(() => createShowMusic(tier), [tier]);
  const clock = useRef({ i: 0, t: 0, build: false, reveal: false });
  const burstId = useRef(0);
  const last = slides.length - 1;

  const fire = useCallback((kind: Burst["kind"]) => setBurst({ id: ++burstId.current, kind }), []);

  const enter = useCallback(
    (n: number) => {
      clock.current = { i: n, t: 0, build: false, reveal: false };
      setI(n);
      setT(0);
      if (slides[n].kind === "intro") music.accent("title");
      if (slides[n].kind === "outro" && year) fire("finale");
    },
    [slides, music, year, fire],
  );

  // The slide clock. It counts real time only while playing, so pausing freezes everything.
  useEffect(() => {
    if (!started || paused) return;
    let prev = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const c = clock.current;
      const from = c.t;
      c.t += Math.min(now - prev, 250);
      prev = now;
      const slide = slides[c.i];
      const hasReveal = slide.kind === "award" || slide.kind === "star";
      if (hasReveal && !c.build && c.t >= BUILD_AT) {
        c.build = true;
        music.accent("build");
      }
      if (hasReveal && !c.reveal && from < timing.revealMs && c.t >= timing.revealMs) {
        c.reveal = true;
        music.accent(slide.kind === "star" ? "finale" : "reveal");
        fire(slide.kind === "star" ? "finale" : "reveal");
      }
      if (c.t >= timing.slideMs[slide.kind] && c.i < last) enter(c.i + 1);
      else setT(c.t);
    }, 100);
    return () => clearInterval(id);
  }, [started, paused, slides, timing, last, music, enter, fire]);

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n > last) return;
      enter(n);
    },
    [enter, last],
  );

  const begin = () => {
    music.start();
    setStarted(true);
    enter(0);
  };

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (p) music.resume();
      else music.pause();
      return !p;
    });
  }, [music]);

  const replay = () => {
    setPaused(false);
    music.resume();
    enter(0);
  };

  // Stop the music when leaving, pause when the tab is hidden, keep the screen awake while it plays.
  useEffect(() => () => music.stop(), [music]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        setPaused(true);
        music.pause();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [music]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    if (!started) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.key === "ArrowRight") go(clock.current.i + 1);
      else if (e.key === "ArrowLeft") go(clock.current.i - 1);
      else if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Escape") router.push(backHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, go, togglePause, router, backHref]);

  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    const left = e.clientX < window.innerWidth * 0.3;
    go(clock.current.i + (left ? -1 : 1));
  };

  const slide = slides[i];
  const dur = timing.slideMs[slide.kind] || 1;
  const ctl =
    "grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur active:scale-95";

  return (
    <div
      className={`show ${year ? "show-year" : "show-month"} ${paused ? "show-paused" : ""}`}
      role="dialog"
      aria-label={`${show.periodLabel} recap`}
    >
      {year && <div className="show-rays" aria-hidden />}
      <div className="show-vignette" aria-hidden />
      <ShowParticles tier={tier} burst={burst} />

      {!started ? (
        <Cover show={show} onStart={begin} backHref={backHref} />
      ) : (
        <>
          <div className="relative z-20 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" aria-hidden>
            {slides.map((_, j) => (
              <span key={j} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                <span
                  className="block h-full origin-left bg-white"
                  style={{ transform: `scaleX(${j < i ? 1 : j === i ? clamp01(t / dur) : 0})`, transition: "transform 100ms linear" }}
                />
              </span>
            ))}
          </div>
          <div className="relative z-20 flex items-center justify-between px-3 pt-2">
            <Link href={backHref} aria-label="Close" className={ctl}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Link>
            <div className="flex gap-2">
              <button type="button" className={ctl} onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
                {paused ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
                )}
              </button>
              <button
                type="button"
                className={ctl}
                onClick={() => {
                  setMuted(!muted);
                  music.setMuted(!muted);
                }}
                aria-label={muted ? "Turn the music on" : "Turn the music off"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9v6h4l5 4V5L8 9z" />
                  {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Tapping the right side goes forward, the left edge goes back. */}
          <div className="absolute inset-0 z-[5] flex items-center justify-center px-6 pb-8 pt-24" onPointerUp={onTap}>
            <SlideView
              key={i}
              slide={slide}
              show={show}
              t={t}
              onReplay={replay}
              backHref={backHref}
            />
          </div>
          {paused && (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Paused
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- cover --------------------------------------------------------------------------------------------

function Cover({ show, onStart, backHref }: { show: Show; onStart: () => void; backHref: string }) {
  const year = show.tier === "year";
  return (
    <div className="relative z-20 flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="show-in text-7xl" style={{ ["--d" as string]: "0ms" }} aria-hidden>
        {year ? "🏆" : "🎬"}
      </div>
      <div className="show-in space-y-2" style={{ ["--d" as string]: "150ms" }}>
        <div className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/70">Pickup League</div>
        <h1 className={`text-5xl font-black tracking-tight ${year ? "show-gold-text" : ""}`}>{show.periodLabel}</h1>
        <p className="text-sm font-semibold text-white/80">{year ? "The year in review" : "The month in review"}</p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="show-in flex items-center gap-3 rounded-full bg-white px-7 py-4 text-base font-extrabold text-ink shadow-xl active:scale-95"
        style={{ ["--d" as string]: "350ms" }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        Play with sound
      </button>
      <Link href={backHref} className="show-in text-sm font-semibold text-white/70 underline-offset-4 hover:underline" style={{ ["--d" as string]: "500ms" }}>
        Back to cards
      </Link>
    </div>
  );
}

// ---- slides -------------------------------------------------------------------------------------------

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

function SlideView({
  slide,
  show,
  t,
  onReplay,
  backHref,
}: {
  slide: Slide;
  show: Show;
  t: number;
  onReplay: () => void;
  backHref: string;
}) {
  const year = show.tier === "year";
  const revealMs = TIMING[show.tier].revealMs;
  const gold = year ? "show-gold-text" : "";
  const noun = year ? "Year" : "Month";

  switch (slide.kind) {
    case "intro":
      return (
        <div className="space-y-4 text-center">
          <div className="show-in text-xs font-extrabold uppercase tracking-[0.35em] text-white/70" style={d(year ? 600 : 100)}>
            Pickup League
          </div>
          <h1
            className={`show-pop font-black leading-none tracking-tight ${gold} ${year ? "text-[clamp(72px,26vw,150px)]" : "text-[clamp(44px,13vw,84px)]"}`}
            style={d(year ? 1100 : 250)}
          >
            {slide.title}
          </h1>
          <p className="show-in text-lg font-bold text-white/85" style={d(year ? 2300 : 900)}>
            {slide.subtitle}
          </p>
          {year && (
            <div className="show-in text-5xl" style={d(3200)} aria-hidden>
              🏆
            </div>
          )}
        </div>
      );

    case "numbers":
      return (
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="show-in label text-white/70" style={d(0)}>
            {year ? "The year in numbers" : "The month in numbers"}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            {slide.stats.map((s, n) => {
              const delay = 400 + n * (year ? 700 : 350);
              const count = Math.round(s.value * ease((t - delay) / (year ? 2200 : 1400)));
              return (
                <div key={s.label} className="show-in" style={d(delay)}>
                  <div className={`tabular text-[clamp(44px,14vw,72px)] font-black leading-none ${gold}`}>{count.toLocaleString()}</div>
                  <div className="label mt-1 text-white/70">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "months":
      return (
        <div className="w-full max-w-sm space-y-4">
          <div className="show-in label text-center text-white/70" style={d(0)}>
            MVP, month by month
          </div>
          <ul className="space-y-1.5">
            {slide.rows.map((r, n) => (
              <li
                key={r.month}
                className="show-in flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm"
                style={d(500 + n * 420)}
              >
                <span className="w-9 text-xs font-extrabold uppercase tracking-wider text-amber-200">{r.month}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{r.name}</span>
                <span className="tabular text-sm font-bold text-white/70">{r.rating}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "award": {
      const c = slide.card;
      const revealed = t >= revealMs;
      return (
        <div className="w-full max-w-sm text-center">
          {!revealed ? (
            <div className="space-y-4">
              <div className="show-in label text-white/60" style={d(0)}>
                {slide.n} of {slide.of}
              </div>
              <div className="show-in text-[clamp(30px,9vw,46px)] font-black uppercase leading-tight tracking-wide" style={d(150)}>
                {c.categoryLabel}
              </div>
              <p className="show-in text-base font-semibold text-white/80" style={d(400)}>
                {c.tagline}
              </p>
              <div className="show-pulse text-6xl" aria-hidden>
                {year ? "🥁" : "🎁"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="show-in label text-amber-200" style={d(0)}>
                {c.categoryLabel} of the {year ? "year" : "month"}
              </div>
              <div className="show-pop text-[clamp(84px,28vw,140px)] leading-none drop-shadow-[0_8px_24px_rgb(0_0_0/0.45)]" style={d(80)} aria-hidden>
                {c.emoji}
              </div>
              <div className={`show-in text-[clamp(30px,9.5vw,48px)] font-black uppercase leading-tight tracking-wide ${gold}`} style={d(350)}>
                {c.title}
              </div>
              <div className="show-pop text-[clamp(30px,10vw,52px)] font-black leading-tight" style={d(800)}>
                {c.name}
              </div>
              <div className="show-in tabular text-[clamp(28px,8vw,40px)] font-black text-amber-200" style={d(1200)}>
                {c.value}
              </div>
              <div className="show-in tabular text-sm font-semibold text-white/75" style={d(1500)}>
                {c.detail}
              </div>
            </div>
          )}
        </div>
      );
    }

    case "star": {
      const revealed = t >= revealMs;
      return (
        <div className="w-full max-w-sm space-y-3 text-center">
          {!revealed ? (
            <div className="space-y-4">
              <div className="show-in label text-white/70" style={d(0)}>
                And now
              </div>
              <div className="show-in text-[clamp(30px,9vw,46px)] font-black uppercase leading-tight" style={d(200)}>
                Player of the {noun}
              </div>
              <div className="show-pulse text-6xl" aria-hidden>
                {year ? "👑" : "⭐"}
              </div>
            </div>
          ) : (
            <>
              <div className="show-pop text-[clamp(84px,28vw,130px)] leading-none" style={d(0)} aria-hidden>
                {year ? "🏆" : "🥇"}
              </div>
              <div className="show-in label text-amber-200" style={d(300)}>
                Player of the {noun}
              </div>
              <div className={`show-pop text-[clamp(38px,12vw,64px)] font-black leading-none ${gold}`} style={d(600)}>
                {slide.name}
              </div>
              <div className="show-in text-sm font-bold text-white/80" style={d(1100)}>
                {slide.titles.length} {slide.titles.length === 1 ? "title" : "titles"}
              </div>
              <ul className="flex flex-wrap justify-center gap-2 pt-1">
                {slide.titles.map((x, n) => (
                  <li key={x.title} className="show-in rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm" style={d(1400 + n * 250)}>
                    <span aria-hidden>{x.emoji}</span> {x.title}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );
    }

    case "outro":
      return (
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="space-y-1">
            <div className="show-in label text-white/70" style={d(0)}>
              {year ? "The Hall of Fame" : "The winners"}
            </div>
            <h2 className={`show-pop text-[clamp(32px,10vw,52px)] font-black leading-tight ${gold}`} style={d(200)}>
              {slide.title}
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {slide.cards.map((c, n) => (
              <li key={c.key} className="show-in rounded-2xl bg-white/12 px-3 py-2 text-left backdrop-blur-sm" style={d(500 + n * 150)}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden>{c.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold uppercase leading-tight tracking-wide text-amber-200">{c.title}</div>
                    <div className="truncate text-sm font-bold">{shortName(c.name)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="show-in flex justify-center gap-3 pt-1" style={d(500 + slide.cards.length * 150 + 300)}>
            <button type="button" onClick={onReplay} className="rounded-full bg-white px-5 py-3 text-sm font-extrabold text-ink active:scale-95">
              Watch again
            </button>
            <Link href={backHref} className="rounded-full bg-white/15 px-5 py-3 text-sm font-extrabold backdrop-blur-sm active:scale-95">
              Back to cards
            </Link>
          </div>
        </div>
      );
  }
}

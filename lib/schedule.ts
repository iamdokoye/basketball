// Pure scheduling helpers for the "open scoring window" (no server-only imports,
// so they can be unit-tested and reused).

export type WindowSpec = {
  /** 0 = Sunday ... 6 = Saturday */
  day: number;
  startMin: number;
  endMin: number;
};

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_WINDOW = "Sat 06:00-13:00";

/** Parses e.g. "Sat 06:00-13:00". Throws on anything malformed so a typo can't silently open or close editing. */
export function parseWindow(spec: string = DEFAULT_WINDOW): WindowSpec {
  const m = /^\s*([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(spec);
  const day = m ? DAYS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || day < 0) throw new Error(`Invalid LEAGUE_WINDOW "${spec}". Use e.g. "Sat 06:00-13:00".`);
  const startMin = Number(m[2]) * 60 + Number(m[3]);
  const endMin = Number(m[4]) * 60 + Number(m[5]);
  if (Number(m[2]) > 23 || Number(m[4]) > 24 || Number(m[3]) > 59 || Number(m[5]) > 59 || endMin <= startMin) {
    throw new Error(`Invalid LEAGUE_WINDOW "${spec}": the end must be after the start, on the same day.`);
  }
  return { day, startMin, endMin };
}

/** Day of week and minutes since midnight in the given IANA timezone. */
export function localTime(now: Date, timeZone: string): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    throw new Error(`Invalid LEAGUE_TIMEZONE "${timeZone}". Use an IANA name like "Africa/Lagos".`);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = DAYS.indexOf(get("weekday").toLowerCase());
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isWindowOpen(now: Date, timeZone: string, w: WindowSpec, graceMin = 0): boolean {
  const t = localTime(now, timeZone);
  return t.day === w.day && t.minutes >= w.startMin && t.minutes < w.endMin + graceMin;
}

function clock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Saturdays 6:00 AM – 1:00 PM" */
export function describeWindow(w: WindowSpec): string {
  return `${DAY_NAMES[w.day]}s ${clock(w.startMin)} – ${clock(w.endMin)}`;
}

export const windowEndLabel = (w: WindowSpec) => clock(w.endMin);

const MIN = 60_000;
const WEEK_MIN = 7 * 1440;
const startOfMinute = (d: Date) => d.getTime() - d.getUTCSeconds() * 1000 - d.getUTCMilliseconds();

/** When the window next opens, or null if it is open right now. */
export function nextOpening(now: Date, timeZone: string, w: WindowSpec, graceMin = 0): Date | null {
  if (isWindowOpen(now, timeZone, w, graceMin)) return null;
  const t = localTime(now, timeZone);
  const startAbs = w.day * 1440 + w.startMin;
  const untilStart = (((startAbs - (t.day * 1440 + t.minutes)) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;

  let est = startOfMinute(now) + untilStart * MIN;
  // A daylight-saving change between now and then shifts the local clock; nudge until it lands on the start time.
  for (let i = 0; i < 3; i++) {
    const lt = localTime(new Date(est), timeZone);
    let diff = startAbs - (lt.day * 1440 + lt.minutes);
    if (diff > WEEK_MIN / 2) diff -= WEEK_MIN;
    if (diff < -WEEK_MIN / 2) diff += WEEK_MIN;
    if (diff === 0) break;
    est += diff * MIN;
  }
  return new Date(est);
}

/** When the currently open window closes (including grace), or null if it is closed. */
export function windowClosing(now: Date, timeZone: string, w: WindowSpec, graceMin = 0): Date | null {
  if (!isWindowOpen(now, timeZone, w, graceMin)) return null;
  const t = localTime(now, timeZone);
  return new Date(startOfMinute(now) + (w.endMin + graceMin - t.minutes) * MIN);
}

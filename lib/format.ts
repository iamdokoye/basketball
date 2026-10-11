import { DEFAULT_WINDOW, parseWindow } from "./schedule";

/** The league's timezone (IANA name). Games are shown in this zone, whatever zone the server runs in. */
export function leagueTimeZone(): string {
  const tz = process.env.LEAGUE_TIMEZONE ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** "Sat, Oct 10, 2026 · 7:42 AM", in the league timezone. */
export function formatGameDateTime(
  iso: string,
  timeZone: string = leagueTimeZone(),
): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${date} · ${time}`;
}

/** Day of the week the league plays on (0 = Sunday), taken from LEAGUE_WINDOW. Weeks for MVP start on this day. */
export function leagueGameDay(): number {
  try {
    return parseWindow(process.env.LEAGUE_WINDOW ?? DEFAULT_WINDOW).day;
  } catch {
    return parseWindow(DEFAULT_WINDOW).day;
  }
}

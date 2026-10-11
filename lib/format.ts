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

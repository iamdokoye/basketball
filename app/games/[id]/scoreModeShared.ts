// Plain module (no "use client") so both the server page and the client scorekeeper can import it.

/** How the scorekeeper takes input. Kept per phone, so two scorers can each use the style they like. */
export type ScoreMode = "quick" | "pad" | "classic";

export const SCORE_MODES: { id: ScoreMode; title: string; hint: string }[] = [
  {
    id: "quick",
    title: "Quick",
    hint: "One tap per shot. Tap the assist or rebound right after.",
  },
  {
    id: "pad",
    title: "Pad",
    hint: "Pick a player once, then tap actions in the bar at the bottom.",
  },
  {
    id: "classic",
    title: "Classic",
    hint: "Tap a player, then choose from the menu.",
  },
];

/** A cookie, not localStorage, so the server renders the saved style on the first paint (no flash of another layout). */
export const SCORE_MODE_COOKIE = "pl-score-mode";

export function parseScoreMode(v: string | null | undefined): ScoreMode {
  return v === "pad" || v === "classic" || v === "quick" ? v : "quick";
}

import { isReservedWord } from "./voice";

export const MAX_NICKNAMES = 5;
export const MAX_NICKNAME_LENGTH = 20;

/** Cleans a player's nickname list: trims, drops blanks and repeats, and checks each one. */
export function cleanNicknames(
  input: unknown,
): { ok: true; list: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input))
    return { ok: false, error: "Something went wrong. Try again." };

  const list: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const nick = String(raw ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!nick) continue;
    const key = nick.toLowerCase();
    if (seen.has(key)) continue;
    if (nick.length > MAX_NICKNAME_LENGTH)
      return {
        ok: false,
        error: `"${nick}" is too long (${MAX_NICKNAME_LENGTH} letters at most).`,
      };
    if (!/[a-z]/i.test(nick))
      return { ok: false, error: `"${nick}" needs some letters in it.` };
    const word = key
      .split(" ")
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .find((w) => w && isReservedWord(w));
    if (word)
      return {
        ok: false,
        error: `"${word}" is a basketball word that voice entry listens for, so it can't be part of a nickname.`,
      };
    seen.add(key);
    list.push(nick);
  }
  if (list.length > MAX_NICKNAMES)
    return {
      ok: false,
      error: `${MAX_NICKNAMES} nicknames at most per player.`,
    };
  return { ok: true, list };
}

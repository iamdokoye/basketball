function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Neutral initials avatar. `tone="ink"` is the solid variant used for the #1 player. */
export function Avatar({
  name,
  size = "md",
  tone = "soft",
  jersey,
}: {
  /** Accepted for call-site compatibility; avatars are neutral so it is unused. */
  id?: number;
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "soft" | "ink";
  /** Optional jersey number (e.g. "23", "00", "7"). */
  jersey?: string | null;
}) {
  const dims = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  }[size];
  const look =
    tone === "ink"
      ? "bg-ink text-paper shadow-md"
      : "bg-black/[0.07] text-ink shadow-inner";

  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold ${dims} ${look}`}
      >
        {initials(name)}
      </span>
      {jersey && (
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-black text-paper bg-court-ink shadow-sm ring-1 ring-white ${
            size === "lg"
              ? "h-5 min-w-[20px] px-1 text-[10px]"
              : size === "sm"
                ? "h-3.5 min-w-[14px] px-0.5 text-[8px]"
                : "h-4 min-w-[16px] px-1 text-[9px]"
          }`}
          title={`#${jersey}`}
        >
          {jersey}
        </span>
      )}
    </span>
  );
}

/** "Marcus King" -> "Marcus K." (surname shortened, first name kept); single names are left alone. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
    : name;
}

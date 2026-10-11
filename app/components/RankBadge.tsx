// Thin metallic treatment for the top three; everything else is a plain numeral.
const MEDALS: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 ring-1 ring-amber-400",
  2: "bg-stone-100 text-stone-700 ring-1 ring-stone-400",
  3: "bg-orange-100 text-orange-800 ring-1 ring-orange-400",
};

export function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={`tabular inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
        rank ? (MEDALS[rank] ?? "text-muted") : "text-stone-300"
      }`}
      aria-label={rank ? `Rank ${rank}` : "Unranked"}
    >
      {rank ?? "–"}
    </span>
  );
}

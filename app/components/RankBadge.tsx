const MEDALS: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-stone-300 text-stone-800",
  3: "bg-orange-300 text-orange-950",
};

export function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
        rank ? (MEDALS[rank] ?? "bg-stone-100 text-stone-600") : "text-stone-300"
      }`}
      aria-label={rank ? `Rank ${rank}` : "Unranked"}
    >
      {rank ?? "–"}
    </span>
  );
}

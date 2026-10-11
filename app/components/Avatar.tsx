const PALETTE = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-600",
  "bg-cyan-600",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-stone-600",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({
  id,
  name,
  size = "md",
}: {
  id: number;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: "h-7 w-7 text-[11px]", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" }[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ${dims} ${PALETTE[id % PALETTE.length]}`}
    >
      {initials(name)}
    </span>
  );
}

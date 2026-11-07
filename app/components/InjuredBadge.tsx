export function InjuredBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const isXs = size === "xs";
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold uppercase tracking-wider transition-colors ${
        isXs
          ? "px-1.5 py-0.5 text-[8px] leading-none"
          : isSm
            ? "px-2 py-0.5 text-[9px] leading-none"
            : "px-2.5 py-0.5 text-[10px] leading-none"
      } bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/25 ${className ?? ""}`}
      title="Injured — Stats frozen (no zero-dilution)"
      aria-label="Injured — Stats frozen"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
      INJ
    </span>
  );
}

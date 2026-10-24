export function InjuredBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 font-bold tracking-wide uppercase transition-colors ${
        isSm
          ? "rounded px-1 py-0.2 text-[10px] leading-tight"
          : "rounded-md px-1.5 py-0.5 text-[11px] leading-none"
      } bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 ${className ?? ""}`}
      title="Injured — Stats frozen (no zero-dilution)"
      aria-label="Injured — Stats frozen"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" aria-hidden />
      INJ
    </span>
  );
}

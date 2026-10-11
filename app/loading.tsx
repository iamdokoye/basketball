/** Shown immediately while a page fetches its data, so taps never feel dead. */
export default function Loading() {
  const bar = "animate-pulse rounded-2xl bg-black/[0.06]";
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className={`${bar} h-9 w-44`} />
      <div className="glass-1 space-y-3 rounded-3xl p-5">
        <div className={`${bar} h-4 w-16`} />
        <div className={`${bar} h-8 w-48`} />
        <div className={`${bar} h-4 w-64 max-w-full`} />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-1 flex items-center gap-3 rounded-2xl p-3.5">
            <div className={`${bar} h-10 w-10 rounded-full`} />
            <div className="flex-1 space-y-2">
              <div className={`${bar} h-4 w-32`} />
              <div className={`${bar} h-3 w-48 max-w-full`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

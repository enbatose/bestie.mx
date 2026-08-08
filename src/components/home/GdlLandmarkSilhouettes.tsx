/**
 * Decorative GDL landmarks (Catedral + La Minerva) for the city landing hero.
 * Lime line-art PNGs — same family as the Facebook launch banner.
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex h-44 items-end justify-between sm:h-56 md:h-64 lg:h-72 ${className}`}
      aria-hidden
    >
      <img
        src="/brand/gdl/cathedral-silhouette-v2.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="h-[92%] w-auto max-w-[48%] -translate-x-[12%] object-contain object-left-bottom opacity-70 sm:-translate-x-[4%] sm:max-w-[42%] sm:opacity-75 md:max-w-[38%] lg:translate-x-0 lg:max-w-[34%]"
      />
      <img
        src="/brand/gdl/minerva-silhouette-v3.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="h-full w-auto max-w-[44%] translate-x-[10%] object-contain object-right-bottom opacity-70 sm:translate-x-[4%] sm:max-w-[38%] sm:opacity-75 md:max-w-[32%] lg:translate-x-0 lg:max-w-[28%]"
      />
    </div>
  );
}

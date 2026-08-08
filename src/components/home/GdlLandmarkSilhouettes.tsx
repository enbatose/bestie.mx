/**
 * Decorative GDL landmarks for the city landing hero (tablet/desktop).
 * La Minerva bottom-left, Catedral top-right — lime on forest green.
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[1] hidden md:block ${className}`}
      aria-hidden
    >
      <img
        src="/brand/gdl/minerva-silhouette-v4.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="absolute bottom-0 left-[6%] h-52 w-auto max-w-[34%] object-contain object-left-bottom opacity-65 lg:left-[8%] lg:h-60 lg:max-w-[30%] lg:opacity-70 xl:left-[10%] xl:h-72 xl:max-w-[26%]"
      />
      <img
        src="/brand/gdl/cathedral-silhouette-v2.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="absolute right-0 top-0 h-48 w-auto max-w-[38%] object-contain object-right-top opacity-65 lg:h-56 lg:max-w-[34%] lg:opacity-70 xl:h-64 xl:max-w-[30%]"
      />
    </div>
  );
}

/**
 * Decorative GDL landmarks (Catedral + La Minerva) for the city landing hero.
 * Lime line-art — desktop/tablet only; on mobile the detail becomes noise under CTAs.
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] hidden items-end justify-between md:flex md:h-56 lg:h-64 xl:h-72 ${className}`}
      aria-hidden
    >
      <img
        src="/brand/gdl/cathedral-silhouette-v2.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="h-[92%] w-auto max-w-[40%] object-contain object-left-bottom opacity-60 lg:max-w-[36%] lg:opacity-70 xl:max-w-[32%]"
      />
      <img
        src="/brand/gdl/minerva-silhouette-v3.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        className="h-full w-auto max-w-[34%] object-contain object-right-bottom opacity-60 lg:max-w-[30%] lg:opacity-70 xl:max-w-[26%]"
      />
    </div>
  );
}

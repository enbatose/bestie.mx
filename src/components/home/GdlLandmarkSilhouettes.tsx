/**
 * Decorative GDL landmarks for the city landing hero (tablet/desktop).
 * La Minerva bottom-left, Catedral top-right — horizontally centered in each
 * side gutter; vertically inset from the banner’s top/bottom edges.
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  // Midpoint of the side gutter: (100% - content) / 4
  const gutterMid = "calc((100% - min(42rem, 100%)) / 4)";
  // ~3× a small edge gap (was flush at 0) — pull away from top / bottom borders
  const fromVerticalEdge = "3rem";

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
        style={{ left: gutterMid, bottom: fromVerticalEdge }}
        className="absolute h-44 w-auto max-w-[min(28%,11rem)] -translate-x-1/2 object-contain object-bottom opacity-65 lg:h-56 lg:max-w-[min(26%,13rem)] lg:opacity-70 xl:h-64 xl:max-w-[min(24%,15rem)]"
      />
      <img
        src="/brand/gdl/cathedral-silhouette-v3.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        style={{ right: gutterMid, top: fromVerticalEdge }}
        className="absolute h-40 w-auto max-w-[min(30%,12rem)] translate-x-1/2 object-contain object-top opacity-65 lg:h-52 lg:max-w-[min(28%,14rem)] lg:opacity-70 xl:h-60 xl:max-w-[min(26%,16rem)]"
      />
    </div>
  );
}

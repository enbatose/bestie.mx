/**
 * Decorative GDL landmarks for the city landing hero (tablet/desktop).
 * La Minerva bottom-left, Catedral top-right — each centered in the gutter
 * between the viewport edge and the central text column (max-w-[42rem]).
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  // Midpoint of the side gutter: (100% - content) / 4
  const gutterMid =
    "calc((100% - min(42rem, 100%)) / 4)";

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
        style={{ left: gutterMid }}
        className="absolute bottom-0 h-44 w-auto max-w-[min(28%,11rem)] -translate-x-1/2 object-contain object-bottom opacity-65 lg:h-56 lg:max-w-[min(26%,13rem)] lg:opacity-70 xl:h-64 xl:max-w-[min(24%,15rem)]"
      />
      <img
        src="/brand/gdl/cathedral-silhouette-v3.png"
        alt=""
        width={320}
        height={320}
        decoding="async"
        style={{ right: gutterMid }}
        className="absolute top-0 h-40 w-auto max-w-[min(30%,12rem)] translate-x-1/2 object-contain object-top opacity-65 lg:h-52 lg:max-w-[min(28%,14rem)] lg:opacity-70 xl:h-60 xl:max-w-[min(26%,16rem)]"
      />
    </div>
  );
}

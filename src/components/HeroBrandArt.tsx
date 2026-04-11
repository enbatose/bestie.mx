import { useCallback, useState } from "react";

/**
 * Optional large graphic from Figma (illustration / pattern / secondary mark):
 * - `hero-art.svg` or `hero-art.png` — shown softly on the hero; omitted if files missing
 */
const HERO_SOURCES = ["/brand/hero-art.svg", "/brand/hero-art.png"] as const;

export function HeroBrandArt() {
  const [attempt, setAttempt] = useState(0);
  const [hidden, setHidden] = useState(false);

  const handleError = useCallback(() => {
    if (attempt < HERO_SOURCES.length - 1) {
      setAttempt((a) => a + 1);
    } else {
      setHidden(true);
    }
  }, [attempt]);

  if (hidden) return null;

  const src = HERO_SOURCES[attempt]!;

  return (
    <div
      className="pointer-events-none absolute -right-8 bottom-0 top-8 hidden w-[min(52vw,320px)] select-none md:block lg:right-0 lg:w-[min(40vw,380px)]"
      aria-hidden
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain object-right opacity-[0.22] drop-shadow-lg sm:opacity-[0.28]"
        width={380}
        height={380}
        decoding="async"
        onError={handleError}
      />
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";

/** Light backgrounds: forest wordmark (`bestie-logo-horizontal-dark` from Figma Make). */
const LOCKUP_ON_LIGHT = ["/brand/logo-lockup.svg", "/brand/logo-lockup.png"] as const;
/** Dark / primary green backgrounds: white wordmark (`bestie-logo-horizontal-white`). */
const LOCKUP_ON_DARK = [
  "/brand/logo-lockup-on-dark.svg",
  "/brand/logo-lockup-on-dark.png",
] as const;

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  /** `onLight` (default): header/footer on white. `onDark`: hero on `bg-primary`. */
  variant?: "onLight" | "onDark";
};

export function BrandLogo({
  className = "",
  imgClassName = "h-9 w-auto max-w-[200px] object-left sm:h-10 sm:max-w-[260px]",
  variant = "onLight",
}: BrandLogoProps) {
  const sources = useMemo(
    () => (variant === "onDark" ? LOCKUP_ON_DARK : LOCKUP_ON_LIGHT),
    [variant],
  );

  const [attempt, setAttempt] = useState(0);
  const [broken, setBroken] = useState(false);

  const handleError = useCallback(() => {
    if (attempt < sources.length - 1) {
      setAttempt((a) => a + 1);
    } else {
      setBroken(true);
    }
  }, [attempt, sources.length]);

  if (broken) {
    const isDark = variant === "onDark";
    return (
      <a
        href="/"
        className={`flex items-center gap-2 ${isDark ? "text-primary-fg" : "text-primary"} ${className}`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold sm:h-10 sm:w-10 sm:text-base ${
            isDark
              ? "border border-white/25 bg-white/10 text-primary-fg"
              : "bg-primary text-primary-fg"
          }`}
          aria-hidden
        >
          B
        </span>
        <span className="text-lg font-semibold tracking-tight sm:text-xl">Bestie</span>
      </a>
    );
  }

  const src = sources[attempt]!;

  return (
    <a href="/" className={`inline-flex min-w-0 items-center ${className}`}>
      <img
        src={src}
        alt="Bestie — inicio"
        className={`${imgClassName} object-contain`}
        width={260}
        height={52}
        decoding="async"
        fetchPriority="high"
        onError={handleError}
      />
    </a>
  );
}

import type { LucideProps } from "lucide-react";

function HighHeelFigure() {
  return (
    <>
      <path d="M6.25 18.35h9.35l1.05-1.65 1.35-5.55c.1-.42-.22-.8-.66-.8H9.05c-.4 0-.73.31-.78.72L6.25 18.35Z" />
      <path d="M15.95 10.35 18.15 16.85c.2.58-.18 1.18-.78 1.25H6.25v-1.2h10.55l-1.85-6.55Z" />
      <path d="M6.25 19.05h11.55c.48 0 .87.39.87.87v.58H6.25v-1.45Z" />
    </>
  );
}

function MustacheFigure() {
  return (
    <>
      <path d="M4.35 12.45c1.45-1.55 3.15-1.95 4.55-1.05.35-.25.75-.4 1.2-.4.45 0 .85.15 1.2.4 1.4-.9 3.1-.5 4.55 1.05.95 1.05.5 2.35-.5 2.65-1.25.35-2.2-.5-3.25-1-1.05.5-2 1.35-3.25 1-1-.3-1.45-1.6-.5-2.65Z" />
    </>
  );
}

/** High-heel icon for woman / Mujer gender filter. */
export function HighHeelIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <HighHeelFigure />
    </svg>
  );
}

/** Mustache icon for man / Hombre gender filter. */
export function MustacheIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <MustacheFigure />
    </svg>
  );
}

export const GENDER_MIXED_ICON_CLASS = "h-full w-[1.9rem] sm:w-[2.1rem]";

/** Mixto gender filter: high heel + mustache side by side. */
export function GenderMixedIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 44 24"
      fill="currentColor"
      className={className ?? GENDER_MIXED_ICON_CLASS}
      aria-hidden
      {...props}
    >
      <g transform="translate(1.25, 0.45) scale(0.9)">
        <HighHeelFigure />
      </g>
      <path
        d="M22.1 5.75 23.85 18.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
      <g transform="translate(24.25, 2.1) scale(0.95)">
        <MustacheFigure />
      </g>
    </svg>
  );
}

function quickAttributeGenderIconClass(id: string, mobile: boolean): string {
  if (id === "gender-mixed") {
    return mobile ? "h-4 w-[1.85rem]" : "h-[1.05rem] w-[2.05rem] sm:h-[1.1rem] sm:w-[2.15rem]";
  }
  if (id === "gender-female" || id === "gender-male") {
    return mobile ? "size-4" : "size-[1.05rem] sm:size-[1.1rem]";
  }
  return mobile ? "size-3.5" : "size-4 sm:size-[1.05rem]";
}

export { quickAttributeGenderIconClass };

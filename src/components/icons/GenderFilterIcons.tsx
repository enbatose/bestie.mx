import type { LucideProps } from "lucide-react";

const STILETTO_PUMP_PATH =
  "M0.55 18.05 0.95 16.25C1.85 11.95 5.15 8.35 9.35 7.15 11.55 6.45 13.95 6.05 16.15 4.55 16.85 4.15 17.45 4.15 17.75 4.75 17.95 9.05H19.05L19.35 21.35H20.25L20.45 8.95 17.75 3.65C16.15 2.55 13.65 2.85 10.85 4.55 7.45 6.65 4.55 9.65 3.05 12.85 2.45 14.25 1.95 15.35 1.35 16.55 0.85 17.45 0.55 18.05Z";

function MustacheFigure() {
  return (
    <path d="M4.35 12.45c1.45-1.55 3.15-1.95 4.55-1.05.35-.25.75-.4 1.2-.4.45 0 .85.15 1.2.4 1.4-.9 3.1-.5 4.55 1.05.95 1.05.5 2.35-.5 2.65-1.25.35-2.2-.5-3.25-1-1.05.5-2 1.35-3.25 1-1-.3-1.45-1.6-.5-2.65Z" />
  );
}

/** High-heel icon for woman / Mujer gender filter. */
export function HighHeelIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <path d={STILETTO_PUMP_PATH} />
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
      <g transform="translate(0.1, 0.25) scale(0.97)">
        <path d={STILETTO_PUMP_PATH} />
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
  if (id === "gender-female") {
    return mobile ? "h-[1.15rem] w-[1.45rem]" : "h-[1.2rem] w-[1.55rem] sm:h-[1.25rem] sm:w-[1.65rem]";
  }
  if (id === "gender-male") {
    return mobile ? "size-4" : "size-[1.05rem] sm:size-[1.1rem]";
  }
  return mobile ? "size-3.5" : "size-4 sm:size-[1.05rem]";
}

export { quickAttributeGenderIconClass };

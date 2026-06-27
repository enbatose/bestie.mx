import type { LucideProps } from "lucide-react";

const STILETTO_PUMP_PATH =
  "M0.55 18.05 0.95 16.25C1.85 11.95 5.15 8.35 9.35 7.15 11.55 6.45 13.95 6.05 16.15 4.55 16.85 4.15 17.45 4.15 17.75 4.75 17.95 9.05H19.05L19.35 21.35H20.25L20.45 8.95 17.75 3.65C16.15 2.55 13.65 2.85 10.85 4.55 7.45 6.65 4.55 9.65 3.05 12.85 2.45 14.25 1.95 15.35 1.35 16.55 0.85 17.45 0.55 18.05Z";

/** Handlebar mustache silhouette: upward tips, center notch, bold body. */
const HANDLEBAR_MUSTACHE_PATH =
  "M1.15 12.05C0.45 10.55 0.65 8.55 1.95 7.45 3.75 6.15 6.05 6.75 7.15 8.35 7.75 9.25 8.05 10.25 8.25 11.15 9.05 12.55 10.25 13.25 11.55 13.05 11.78 12.35 11.9 11.65 12 10.95 12.1 11.65 12.22 12.35 12.45 13.05 13.75 13.25 14.95 12.55 15.75 11.15 15.95 10.25 16.25 9.25 16.85 8.35 17.95 6.75 20.25 6.15 22.05 7.45 23.35 8.55 23.55 10.55 22.85 12.05 21.55 13.85 19.45 14.85 17.25 14.55 16.05 15.35 14.35 15.65 12.75 15.25 12.35 15.55 12.15 15.6 12 15.6 11.85 15.6 11.65 15.55 11.25 15.25 9.65 15.65 7.95 15.35 6.75 14.55 4.55 14.85 2.45 13.85 1.15 12.05Z";

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
      viewBox="0 0 24 16"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <path d={HANDLEBAR_MUSTACHE_PATH} />
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
      <g transform="translate(24.15, 3.55) scale(0.98)">
        <path d={HANDLEBAR_MUSTACHE_PATH} />
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
    return mobile ? "h-[1.05rem] w-[1.55rem]" : "h-[1.1rem] w-[1.65rem] sm:h-[1.15rem] sm:w-[1.75rem]";
  }
  return mobile ? "size-3.5" : "size-4 sm:size-[1.05rem]";
}

export { quickAttributeGenderIconClass };

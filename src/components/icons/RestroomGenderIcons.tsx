import type { LucideProps } from "lucide-react";

function FemaleFigure() {
  return (
    <>
      <circle cx="12" cy="4.75" r="2.35" />
      <path d="M11.15 7.35 8.35 15.9c-.12.38.18.75.58.75h6.14c.4 0 .7-.37.58-.75L13.85 7.35c-.24-.72-1.46-.72-1.7 0Z" />
      <rect
        x="6.15"
        y="8.1"
        width="1.35"
        height="4.6"
        rx="0.68"
        transform="rotate(-18 6.83 10.4)"
      />
      <rect
        x="16.5"
        y="8.1"
        width="1.35"
        height="4.6"
        rx="0.68"
        transform="rotate(18 17.18 10.4)"
      />
      <rect x="9.55" y="15.9" width="1.75" height="4.85" rx="0.88" />
      <rect x="12.7" y="15.9" width="1.75" height="4.85" rx="0.88" />
    </>
  );
}

function MaleFigure() {
  return (
    <>
      <circle cx="12" cy="4.75" r="2.35" />
      <rect x="9.85" y="7.35" width="4.3" height="8.4" rx="1.15" />
      <rect x="6.55" y="8.2" width="1.35" height="4.75" rx="0.68" />
      <rect x="16.1" y="8.2" width="1.35" height="4.75" rx="0.68" />
      <rect x="9.55" y="15.2" width="1.75" height="5.55" rx="0.88" />
      <rect x="12.7" y="15.2" width="1.75" height="5.55" rx="0.88" />
    </>
  );
}

const FILTER_GLYPH_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Traditional restroom woman icon: head, dress, arms, and legs. */
export function RestroomFemaleIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <FemaleFigure />
    </svg>
  );
}

/** Traditional restroom man icon: head, torso, arms, and legs. */
export function RestroomMaleIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <MaleFigure />
    </svg>
  );
}

/** Woman filter button glyph: figure + M (Mujer). */
export function RestroomFemaleFilterIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 27 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <g transform="translate(0.35, 1.2) scale(0.66)">
        <FemaleFigure />
      </g>
      <text
        x="20.35"
        y="16.15"
        fontSize="8.75"
        fontWeight="700"
        fontFamily={FILTER_GLYPH_FONT}
        fill="currentColor"
      >
        M
      </text>
    </svg>
  );
}

/** Man filter button glyph: figure + H (Hombre). */
export function RestroomMaleFilterIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 27 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <g transform="translate(0.35, 1.2) scale(0.66)">
        <MaleFigure />
      </g>
      <text
        x="20.55"
        y="16.15"
        fontSize="8.75"
        fontWeight="700"
        fontFamily={FILTER_GLYPH_FONT}
        fill="currentColor"
      >
        H
      </text>
    </svg>
  );
}

export const GENDER_FILTER_ICON_CLASS = "h-4 w-[1.38rem] sm:h-[1.05rem] sm:w-[1.48rem]";

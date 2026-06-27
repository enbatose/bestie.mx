import type { LucideProps } from "lucide-react";

const FIGURE_RX = 0.75;

function FemaleFigure() {
  return (
    <>
      <circle cx="12" cy="4.6" r="2.45" />
      <path d="M11.05 7.35 8.1 14.85c-.14.42.2.8.62.8h6.56c.42 0 .76-.38.62-.8L12.95 7.35c-.28-.78-1.62-.78-1.9 0Z" />
      <rect
        x="6.35"
        y="8.05"
        width="1.25"
        height="4.65"
        rx={FIGURE_RX}
        transform="rotate(-16 6.98 10.38)"
      />
      <rect
        x="16.4"
        y="8.05"
        width="1.25"
        height="4.65"
        rx={FIGURE_RX}
        transform="rotate(16 17.03 10.38)"
      />
      <rect x="9.55" y="14.95" width="1.65" height="6.85" rx={FIGURE_RX} />
      <rect x="12.8" y="14.95" width="1.65" height="6.85" rx={FIGURE_RX} />
    </>
  );
}

function MaleFigure() {
  return (
    <>
      <circle cx="12" cy="4.6" r="2.45" />
      <rect x="9.85" y="7.35" width="4.3" height="6.35" rx={FIGURE_RX} />
      <rect x="7.75" y="8.05" width="1.25" height="5.15" rx={FIGURE_RX} />
      <rect x="15" y="8.05" width="1.25" height="5.15" rx={FIGURE_RX} />
      <rect x="9.55" y="14.15" width="1.75" height="7.65" rx={FIGURE_RX} />
      <rect x="12.7" y="14.15" width="1.75" height="7.65" rx={FIGURE_RX} />
    </>
  );
}

/** Classic restroom woman pictogram: head, dress, arms, and legs. */
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

/** Classic restroom man pictogram: head, torso, arms, and legs. */
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

export const RESTROOM_MIXED_ICON_CLASS = "h-full w-[1.9rem] sm:w-[2.1rem]";

/** Mixed gender pictogram: woman and man figures separated by a divider. */
export function RestroomMixedIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 52 24"
      fill="currentColor"
      className={className ?? RESTROOM_MIXED_ICON_CLASS}
      aria-hidden
      {...props}
    >
      <g transform="translate(0.5, 0)">
        <FemaleFigure />
      </g>
      <rect x="25.15" y="3.25" width="1.05" height="17.5" rx="0.52" />
      <g transform="translate(27.5, 0)">
        <MaleFigure />
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

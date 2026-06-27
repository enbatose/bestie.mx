import type { LucideProps } from "lucide-react";

function FemaleFigure() {
  return (
    <>
      <circle cx="12" cy="5.5" r="3" />
      <path d="M12 9.75 6 20.75h12L12 9.75Z" />
    </>
  );
}

function MaleFigure() {
  return (
    <>
      <circle cx="12" cy="5.25" r="2.85" />
      <path d="M7.5 8.25h9L16.35 15.1H13.35V21.35H10.65V15.1H7.65L7.5 8.25Z" />
    </>
  );
}

/** Classic restroom woman pictogram: round head + triangle dress/skirt. */
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

/** Classic restroom man pictogram: round head + broad shoulders + separated trouser legs. */
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

/** Mixed gender pictogram: woman figure / man figure (like M/H with icons). */
export function RestroomMixedIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 28 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <g transform="translate(0.25, 0.85) scale(0.5)">
        <FemaleFigure />
      </g>
      <path
        d="M13.35 5.25 15.65 18.75"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        fill="none"
      />
      <g transform="translate(13.75, 0.85) scale(0.5)">
        <MaleFigure />
      </g>
    </svg>
  );
}

import type { LucideProps } from "lucide-react";

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
      <circle cx="12" cy="5.5" r="3" />
      <path d="M12 9.75 6 20.75h12L12 9.75Z" />
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
      <circle cx="12" cy="5.25" r="2.85" />
      <path d="M7.5 8.25h9L16.35 15.1H13.35V21.35H10.65V15.1H7.65L7.5 8.25Z" />
    </svg>
  );
}

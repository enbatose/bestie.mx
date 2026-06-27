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

/** Classic restroom man pictogram: round head + torso block + separated legs. */
export function RestroomMaleIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="5.5" r="3" />
      <rect x="9.15" y="9.25" width="5.7" height="6.85" rx="0.55" />
      <rect x="7.35" y="16.85" width="3.35" height="4.65" rx="0.55" />
      <rect x="13.3" y="16.85" width="3.35" height="4.65" rx="0.55" />
    </svg>
  );
}

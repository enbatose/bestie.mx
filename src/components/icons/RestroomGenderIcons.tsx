import type { LucideProps } from "lucide-react";

/** Filled restroom-style woman icon: round head + dress silhouette. */
export function RestroomFemaleIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="5.25" r="2.85" />
      <path d="M12 9.5 6 20.75h12L12 9.5Z" />
    </svg>
  );
}

/** Filled restroom-style man icon: round head + torso + separated legs. */
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
      <rect x="9.5" y="9.25" width="5" height="5.75" rx="0.85" />
      <rect x="7.75" y="15.75" width="3" height="5.25" rx="0.85" />
      <rect x="13.25" y="15.75" width="3" height="5.25" rx="0.85" />
    </svg>
  );
}

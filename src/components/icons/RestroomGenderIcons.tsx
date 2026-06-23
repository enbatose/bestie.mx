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

import type { LucideProps } from "lucide-react";

/** Compact "+1" label for shared-room filter and listing badges. */
export function PlusOneIcon({ className, ...props }: LucideProps) {
  return (
    <span
      className={`inline-flex h-full w-full items-center justify-center text-[0.62rem] font-extrabold leading-none tracking-[-0.03em] sm:text-[0.68rem] ${className ?? ""}`}
      aria-hidden
      {...props}
    >
      +1
    </span>
  );
}

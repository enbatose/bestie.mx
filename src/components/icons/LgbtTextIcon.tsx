import type { LucideProps } from "lucide-react";

/** Plain "LGBT" label for compact filter buttons (no pictogram). */
export function LgbtTextIcon({ className, ...props }: LucideProps) {
  return (
    <span
      className={`inline-flex items-center justify-center text-[0.56rem] font-extrabold leading-none tracking-[-0.04em] sm:text-[0.62rem] ${className ?? ""}`}
      aria-hidden
      {...props}
    >
      LGBT
    </span>
  );
}

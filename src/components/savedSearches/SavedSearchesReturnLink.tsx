import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  to: string;
  placement?: "top" | "bottom" | "inline";
  className?: string;
};

const topClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40";

const bottomClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:px-5 sm:text-sm";

const inlineClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40";

export function SavedSearchesReturnLink({ to, placement = "top", className = "" }: Props) {
  const base =
    placement === "bottom" ? bottomClass : placement === "inline" ? inlineClass : topClass;
  return (
    <Link
      to={to}
      className={`${base} ${className}`.trim()}
      aria-label="Volver a Mis Búsquedas"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span>Volver a Mis Búsquedas</span>
    </Link>
  );
}

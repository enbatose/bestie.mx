import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  to: string;
  placement?: "top" | "bottom" | "inline";
  className?: string;
  /** Visible label. Defaults to Mis Anuncios. */
  label?: string;
};

const topClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40";

const bottomClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:text-sm sm:px-4 sm:py-2.5";

const inlineClass =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40";

export function MyListingsReturnLink({
  to,
  placement = "top",
  className = "",
  label = "Volver a Mis anuncios",
}: Props) {
  const base =
    placement === "bottom" ? bottomClass : placement === "inline" ? inlineClass : topClass;
  return (
    <Link
      to={to}
      className={`${base} ${className}`.trim()}
      aria-label={label}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  to: string;
  placement: "top" | "bottom";
};

const topClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40";

const bottomClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:text-sm sm:px-4 sm:py-2.5";

export function SearchReturnLink({ to, placement }: Props) {
  return (
    <Link to={to} className={placement === "top" ? topClass : bottomClass} aria-label="Volver">
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span>Volver</span>
    </Link>
  );
}

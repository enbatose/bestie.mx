import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  to: string;
};

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-body shadow-md backdrop-blur-sm transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 sm:text-sm sm:px-4 sm:py-2.5";

export function SearchReturnButtons({ to }: Props) {
  return (
    <>
      <Link
        to={to}
        className={`${buttonClass} absolute left-0 top-0 z-20 -translate-x-0 sm:-left-2`}
        aria-label="Volver a buscar"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        <span>Volver a buscar</span>
      </Link>
      <Link
        to={to}
        className={`${buttonClass} fixed bottom-20 right-4 z-30 sm:bottom-8 sm:right-8`}
        aria-label="Volver a buscar"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        <span>Volver a buscar</span>
      </Link>
    </>
  );
}

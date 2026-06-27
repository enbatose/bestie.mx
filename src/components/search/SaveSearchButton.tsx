import { Bookmark } from "lucide-react";

type Props = {
  onClick: () => void;
  /** Brief spinning ring when search filters changed. */
  pulseActive?: boolean;
  /** Tighter label for narrow slots. */
  compact?: boolean;
  className?: string;
};

const MUSTARD_BTN =
  "border-[#b8933a] bg-[#d4a84b] text-[#3a2f08] shadow-sm hover:border-[#a68432] hover:bg-[#c99b42] active:bg-[#bf9238]";

export function SaveSearchButton({ onClick, pulseActive = false, compact = false, className = "" }: Props) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {pulseActive ? (
        <svg
          className="pointer-events-none absolute -inset-[3px] z-10 size-[calc(100%+6px)]"
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          aria-hidden
        >
          <rect
            x="2"
            y="2"
            width="96"
            height="40"
            rx="10"
            ry="10"
            fill="none"
            stroke="#065f46"
            strokeWidth="3"
            pathLength="1"
            strokeDasharray="0.18 0.82"
            className="animate-[autosave-ring-travel_1.5s_linear_forwards] drop-shadow-[0_0_6px_rgba(6,95,70,0.45)]"
          />
        </svg>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={`relative z-20 inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/50 sm:px-3.5 sm:text-sm ${MUSTARD_BTN}`}
      >
        <Bookmark className="size-3.5 shrink-0" aria-hidden strokeWidth={2.2} />
        <span className="truncate">{compact ? "Guardar" : "Guardar búsqueda"}</span>
      </button>
    </div>
  );
}

/** Full-width mobile variant for the filter stack. */
export function SaveSearchButtonMobile({
  onClick,
  pulseActive = false,
}: Pick<Props, "onClick" | "pulseActive">) {
  return (
    <div className="relative min-w-0 flex-1">
      {pulseActive ? (
        <svg
          className="pointer-events-none absolute -inset-[3px] z-10 size-[calc(100%+6px)]"
          viewBox="0 0 100 56"
          preserveAspectRatio="none"
          aria-hidden
        >
          <rect
            x="2"
            y="2"
            width="96"
            height="52"
            rx="14"
            ry="14"
            fill="none"
            stroke="#065f46"
            strokeWidth="3"
            pathLength="1"
            strokeDasharray="0.18 0.82"
            className="animate-[autosave-ring-travel_1.5s_linear_forwards] drop-shadow-[0_0_6px_rgba(6,95,70,0.45)]"
          />
        </svg>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={`relative z-20 inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-[1.2rem] border px-3 text-[0.86rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/50 ${MUSTARD_BTN}`}
      >
        <Bookmark className="size-4 shrink-0" aria-hidden strokeWidth={2.2} />
        <span className="truncate">Guardar búsqueda</span>
      </button>
    </div>
  );
}

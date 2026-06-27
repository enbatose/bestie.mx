import { Bookmark, Mail, X } from "lucide-react";
import { useEffect } from "react";

type SaveGroupProps = {
  onSaveClick: () => void;
  onFollowClick: () => void;
  pulseActive?: boolean;
  compact?: boolean;
  guestNudge?: {
    visible: boolean;
    onDismiss: () => void;
    onClick: () => void;
  };
  className?: string;
};

const GOLD_MAIN =
  "border-[#c9a600] bg-[#FFD700] text-[#3a2f08] shadow-sm hover:border-[#b89600] hover:bg-[#f0cc00] active:bg-[#e6c200]";
const GOLD_FOLLOW =
  "border-[#c9a600] bg-[#FFD700]/90 text-[#3a2f08] hover:bg-[#f0cc00] active:bg-[#e6c200]";

const GUEST_NUDGE_MS = 7_000;

function PulseRing({ mobile }: { mobile?: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute -inset-[3px] z-10 size-[calc(100%+6px)]"
      viewBox={mobile ? "0 0 100 56" : "0 0 100 44"}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="2"
        y="2"
        width="96"
        height={mobile ? 52 : 40}
        rx={mobile ? 14 : 10}
        ry={mobile ? 14 : 10}
        fill="none"
        stroke="#065f46"
        strokeWidth="3"
        pathLength="1"
        strokeDasharray="0.18 0.82"
        className="animate-[autosave-ring-travel_1.5s_linear_forwards] drop-shadow-[0_0_6px_rgba(6,95,70,0.45)]"
      />
    </svg>
  );
}

function GuestNudge({
  onDismiss,
  onClick,
}: {
  onDismiss: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(18rem,calc(100vw-2rem))]"
      role="status"
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border border-primary/20 bg-surface px-3 py-2.5 pr-9 text-left text-xs font-medium leading-snug text-body shadow-lg ring-1 ring-primary/10 transition hover:bg-surface-elevated"
      >
        ¡Sé el primero en ver nuevas publicaciones!
      </button>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function SaveSearchGroup({
  onSaveClick,
  onFollowClick,
  pulseActive = false,
  compact = false,
  guestNudge,
  className = "",
  mobile = false,
}: SaveGroupProps & { mobile?: boolean }) {
  useEffect(() => {
    if (!guestNudge?.visible) return;
    const t = window.setTimeout(() => guestNudge.onDismiss(), GUEST_NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [guestNudge]);

  const heightClass = mobile ? "h-14 rounded-[1.2rem]" : "h-[42px] rounded-lg";
  const textClass = mobile ? "text-[0.86rem]" : "text-xs sm:text-sm";

  return (
    <div className={`relative shrink-0 ${className}`}>
      {pulseActive ? <PulseRing mobile={mobile} /> : null}
      <div
        className={`relative z-20 inline-flex overflow-hidden border border-[#c9a600] shadow-sm ${heightClass}`}
        role="group"
        aria-label="Guardar búsqueda"
      >
        <button
          type="button"
          onClick={onSaveClick}
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 border-r border-[#c9a600]/60 px-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/50 ${GOLD_MAIN} ${textClass} ${mobile ? "flex-1" : ""}`}
        >
          <Bookmark className={mobile ? "size-4 shrink-0" : "size-3.5 shrink-0"} aria-hidden strokeWidth={2.2} />
          <span className="truncate">{compact && !mobile ? "Guardar" : "Guardar búsqueda"}</span>
        </button>
        <button
          type="button"
          onClick={onFollowClick}
          className={`inline-flex shrink-0 items-center justify-center gap-1 px-2.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46]/50 ${GOLD_FOLLOW} ${textClass}`}
          aria-label="Seguir con alertas por correo"
        >
          <Mail className={mobile ? "size-4" : "size-3.5"} aria-hidden strokeWidth={2.2} />
          <span>Seguir</span>
        </button>
      </div>
      {guestNudge?.visible ? (
        <GuestNudge onDismiss={guestNudge.onDismiss} onClick={guestNudge.onClick} />
      ) : null}
    </div>
  );
}

export function SaveSearchButton(props: SaveGroupProps) {
  return <SaveSearchGroup {...props} compact={props.compact} />;
}

export function SaveSearchButtonMobile(props: Omit<SaveGroupProps, "compact" | "className">) {
  return <SaveSearchGroup {...props} mobile className="min-w-0 flex-1" />;
}

const MOBILE_FILTER_HEIGHT = "h-14";
const MOBILE_FILTER_LABEL_CLASS =
  "mb-1 block text-[0.72rem] font-semibold uppercase leading-none tracking-wide text-primary/80";
const DESKTOP_FILTER_LABEL_CLASS =
  "block h-4 text-xs font-semibold uppercase leading-4 tracking-wide text-primary/80";
const DESKTOP_FILTER_CONTROL_CLASS = "mt-1 h-[42px]";

/** Segmented Más / Borrar under a Filtros legend. */
export function FilterActionsGroup({
  onOpenAdvanced,
  onClearFilters,
  clearDisabled,
  mobile = false,
}: {
  onOpenAdvanced: () => void;
  onClearFilters: () => void;
  clearDisabled: boolean;
  mobile?: boolean;
}) {
  const heightClass = mobile ? `w-full ${MOBILE_FILTER_HEIGHT} rounded-[1.2rem]` : "h-[42px] rounded-lg";
  const labelClass = mobile ? MOBILE_FILTER_LABEL_CLASS : DESKTOP_FILTER_LABEL_CLASS;
  const textClass = mobile ? "text-[0.86rem]" : "text-xs sm:text-sm";

  return (
    <fieldset className={mobile ? "min-w-0 flex-1" : "shrink-0"}>
      <legend className={labelClass}>Filtros</legend>
      <div
        className={`${mobile ? "" : DESKTOP_FILTER_CONTROL_CLASS} inline-flex w-full overflow-hidden border border-primary/25 bg-surface shadow-sm ${heightClass}`}
        role="group"
        aria-label="Acciones de filtros"
      >
        <button
          type="button"
          onClick={onOpenAdvanced}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 border-r border-primary/20 px-3 font-semibold text-primary transition hover:bg-bg-light/60 ${textClass}`}
        >
          <FilterIcon className={mobile ? "size-4" : "size-3.5"} />
          Más
        </button>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={clearDisabled}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 px-3 font-semibold text-primary transition hover:bg-bg-light/60 disabled:cursor-not-allowed disabled:opacity-40 ${textClass}`}
        >
          <ClearIcon className={mobile ? "size-4" : "size-3.5"} />
          Borrar
        </button>
      </div>
    </fieldset>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden strokeWidth={2.2}>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

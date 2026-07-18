import { Filter, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { SavedSearchIcon } from "@/components/icons/SavedSearchIcon";

type SaveGroupProps = {
  onSaveClick: () => void;
  pulseActive?: boolean;
  guestNudge?: {
    visible: boolean;
    onDismiss: () => void;
    onClick: () => void;
  };
  className?: string;
};

const GOLD_MAIN =
  "border-gold-edge bg-gold text-gold-fg shadow-sm hover:border-gold-edge-hover hover:bg-gold-hover active:bg-gold-active";

const GUEST_NUDGE_MS = 7_000;

/** Pulse outline: wide rect on mobile save control; square on desktop icon button. */
function PulseRing({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    const height = 40;
    const cornerRadius = 16;
    const strokeWidth = 2.53125;
    const inset = strokeWidth / 2 + 1;
    const dashArray = "0.38 0.62";
    return (
      <svg
        className="pointer-events-none absolute -inset-[5px] z-40 h-[calc(100%+10px)] w-[calc(100%+10px)] overflow-visible"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <rect
          x={inset}
          y={inset}
          width={100 - inset * 2}
          height={height - inset * 2}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="none"
          stroke="#ffffff"
          strokeWidth={strokeWidth + 1.265625}
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={dashArray}
          opacity={0.95}
          className="animate-[autosave-ring-travel_1.2s_linear_forwards] drop-shadow-[0_0_12px_rgba(255,255,255,0.95)]"
        />
        <rect
          x={inset}
          y={inset}
          width={100 - inset * 2}
          height={height - inset * 2}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="none"
          stroke="#102a43"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={dashArray}
          className="animate-[autosave-ring-travel_1.2s_linear_forwards] drop-shadow-[0_0_12px_rgba(255,255,255,0.95)]"
        />
      </svg>
    );
  }

  const size = 42;
  const cornerRadius = 10;
  const strokeWidth = 3;
  const inset = strokeWidth / 2 + 1;
  const dashArray = "0.22 0.78";

  return (
    <svg
      className="pointer-events-none absolute -inset-[3px] z-10 h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x={inset}
        y={inset}
        width={size - inset * 2}
        height={size - inset * 2}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="none"
        stroke="#065f46"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray={dashArray}
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
      className="absolute left-1/2 top-[calc(100%+0.65rem)] z-[1250] w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2"
      role="status"
    >
      <span
        className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l-2 border-t-2 border-primary bg-surface shadow-[-2px_-2px_4px_rgba(20,61,48,0.18)]"
        aria-hidden
      />
      <button
        type="button"
        onClick={onClick}
        className="relative w-full rounded-xl border border-primary/20 bg-surface px-3 py-2.5 pr-9 text-left text-xs font-medium leading-snug text-body shadow-lg ring-1 ring-primary/10 transition hover:bg-surface-elevated"
      >
        Sé el primero en ver nuevas publicaciones.
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

/** Desktop: square gold icon with Guardar label beside it (prior desktop layout). */
export function SaveSearchButton({
  onSaveClick,
  pulseActive = false,
  guestNudge,
  className = "",
}: SaveGroupProps) {
  useEffect(() => {
    if (!guestNudge?.visible) return;
    const t = window.setTimeout(() => guestNudge.onDismiss(), GUEST_NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [guestNudge]);

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <span className="flex shrink-0 items-center text-xs font-semibold leading-none text-primary sm:text-sm" aria-hidden>
        Guardar
      </span>
      <div className="relative shrink-0">
        {pulseActive ? <PulseRing /> : null}
        <button
          type="button"
          onClick={onSaveClick}
          aria-label="Guardar búsqueda"
          className={`relative z-20 inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ring/50 ${GOLD_MAIN}`}
        >
          <SavedSearchIcon className="size-3.5 shrink-0" />
        </button>
        {guestNudge?.visible ? (
          <GuestNudge onDismiss={guestNudge.onDismiss} onClick={guestNudge.onClick} />
        ) : null}
      </div>
    </div>
  );
}

const MOBILE_ROW_LABEL_CLASS =
  "flex shrink-0 items-center text-[0.86rem] font-semibold leading-none text-primary";
const MOBILE_ROW_SHELL_CLASS =
  "flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-surface px-2 shadow-sm ring-1 ring-primary/10";
const MOBILE_ROW_HEIGHT = "h-14";
const MOBILE_CONTROL_HEIGHT = "h-10";

/**
 * Mobile: Filtros + Más|Borrar and Guardar + save, with all three icon buttons
 * sharing the same width (pair takes 2 shares, gold takes 1).
 */
export function MobileCombinedFilterBar({
  onOpenAdvanced,
  onClearFilters,
  clearDisabled,
  onSaveClick,
  pulseActive = false,
  guestNudge,
}: {
  onOpenAdvanced: () => void;
  onClearFilters: () => void;
  clearDisabled: boolean;
  onSaveClick: () => void;
  pulseActive?: boolean;
  guestNudge?: SaveGroupProps["guestNudge"];
}) {
  useEffect(() => {
    if (!guestNudge?.visible) return;
    const t = window.setTimeout(() => guestNudge.onDismiss(), GUEST_NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [guestNudge]);

  const filterBtnClass =
    "inline-flex min-w-0 flex-1 items-center justify-center text-primary transition hover:bg-bg-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={`${MOBILE_ROW_SHELL_CLASS} ${MOBILE_ROW_HEIGHT} w-full min-w-0`}>
      <div
        className={`flex min-w-0 flex-1 ${MOBILE_CONTROL_HEIGHT} items-center gap-1.5 overflow-visible`}
        role="group"
        aria-label="Acciones de filtros y búsqueda guardada"
      >
        <span className={MOBILE_ROW_LABEL_CLASS}>Filtros</span>
        <div
          className={`flex min-w-0 flex-[2] overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55 shadow-sm ${MOBILE_CONTROL_HEIGHT}`}
          role="group"
          aria-label="Filtros"
        >
          <button
            type="button"
            onClick={onOpenAdvanced}
            aria-label="Más filtros"
            className={`${filterBtnClass} rounded-l-[0.95rem] border-r border-primary/20`}
          >
            <Filter className="size-4 shrink-0" aria-hidden strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={clearDisabled}
            aria-label="Borrar filtros"
            className={`${filterBtnClass} rounded-r-[0.95rem]`}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden strokeWidth={2.2} />
          </button>
        </div>

        <span className={MOBILE_ROW_LABEL_CLASS}>Guardar</span>
        <div className={`relative min-w-0 flex-1 ${MOBILE_CONTROL_HEIGHT}`}>
          {pulseActive ? <PulseRing mobile /> : null}
          <button
            type="button"
            onClick={onSaveClick}
            aria-label="Guardar búsqueda"
            className={`relative z-20 flex ${MOBILE_CONTROL_HEIGHT} w-full min-w-0 items-center justify-center rounded-[1rem] border border-gold-edge/70 font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ring/50 ${GOLD_MAIN}`}
          >
            <SavedSearchIcon className="size-4 shrink-0" />
          </button>
          {guestNudge?.visible ? (
            <GuestNudge onDismiss={guestNudge.onDismiss} onClick={guestNudge.onClick} />
          ) : null}
        </div>
      </div>
    </div>
  );
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
    <fieldset className={mobile ? "min-w-0 w-full" : "shrink-0"}>
      <legend className={mobile ? "sr-only" : labelClass}>Filtros</legend>
      <div
        className={`${mobile ? "" : DESKTOP_FILTER_CONTROL_CLASS} inline-flex w-full overflow-hidden border border-primary/25 bg-surface shadow-sm ${heightClass}`}
        role="group"
        aria-label="Acciones de filtros"
      >
        <button
          type="button"
          onClick={onOpenAdvanced}
          aria-label="Más filtros"
          className={`inline-flex flex-1 items-center justify-center gap-1.5 border-r border-primary/20 px-3 font-semibold text-primary transition hover:bg-bg-light/60 ${textClass}`}
        >
          <Filter className={mobile ? "size-4" : "size-3.5"} aria-hidden strokeWidth={2.2} />
          {mobile ? null : "Más"}
        </button>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={clearDisabled}
          aria-label="Borrar filtros"
          className={`inline-flex flex-1 items-center justify-center gap-1.5 px-3 font-semibold text-primary transition hover:bg-bg-light/60 disabled:cursor-not-allowed disabled:opacity-40 ${textClass}`}
        >
          <Trash2 className={mobile ? "size-4" : "size-3.5"} aria-hidden strokeWidth={2.2} />
          {mobile ? null : "Borrar"}
        </button>
      </div>
    </fieldset>
  );
}

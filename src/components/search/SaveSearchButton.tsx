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

function PulseRing({ mobile }: { mobile?: boolean }) {
  // Square control: square viewBox keeps rx/ry circular under preserveAspectRatio="none".
  const size = mobile ? 40 : 42;
  const cornerRadius = mobile ? 16 : 10;
  const strokeWidth = mobile ? 2.53125 : 3;
  const inset = strokeWidth / 2 + 1;
  const dashArray = mobile ? "0.28 0.72" : "0.22 0.78";
  const svgClass = mobile
    ? "pointer-events-none absolute -inset-[5px] z-40 h-[calc(100%+10px)] w-[calc(100%+10px)] overflow-visible"
    : "pointer-events-none absolute -inset-[3px] z-10 h-[calc(100%+6px)] w-[calc(100%+6px)] overflow-visible";
  const ringClass = mobile
    ? "animate-[autosave-ring-travel_1.2s_linear_forwards] drop-shadow-[0_0_12px_rgba(255,255,255,0.95)]"
    : "animate-[autosave-ring-travel_1.5s_linear_forwards] drop-shadow-[0_0_6px_rgba(6,95,70,0.45)]";
  const strokeColor = mobile ? "#102a43" : "#065f46";

  return (
    <svg
      className={svgClass}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {mobile ? (
        <rect
          x={inset}
          y={inset}
          width={size - inset * 2}
          height={size - inset * 2}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="none"
          stroke="#ffffff"
          strokeWidth={strokeWidth + 1.265625}
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={dashArray}
          opacity={0.95}
          className={ringClass}
        />
      ) : null}
      <rect
        x={inset}
        y={inset}
        width={size - inset * 2}
        height={size - inset * 2}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray={dashArray}
        className={ringClass}
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

function SaveSearchControl({
  onSaveClick,
  pulseActive = false,
  guestNudge,
  className = "",
  mobile = false,
}: SaveGroupProps & { mobile?: boolean }) {
  useEffect(() => {
    if (!guestNudge?.visible) return;
    const t = window.setTimeout(() => guestNudge.onDismiss(), GUEST_NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [guestNudge]);

  const labelClass = mobile
    ? "flex shrink-0 items-center text-[0.86rem] font-semibold leading-none text-primary"
    : "flex shrink-0 items-center text-xs font-semibold leading-none text-primary sm:text-sm";
  const buttonClass = mobile
    ? `relative z-20 inline-flex size-10 shrink-0 items-center justify-center rounded-[1rem] border border-gold-edge/70 font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ring/50 ${GOLD_MAIN}`
    : `relative z-20 inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ring/50 ${GOLD_MAIN}`;

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <span className={labelClass} aria-hidden>
        Guardar
      </span>
      <div className="relative shrink-0">
        {pulseActive ? <PulseRing mobile={mobile} /> : null}
        <button type="button" onClick={onSaveClick} aria-label="Guardar búsqueda" className={buttonClass}>
          <SavedSearchIcon className={mobile ? "size-4 shrink-0" : "size-3.5 shrink-0"} />
        </button>
        {guestNudge?.visible ? (
          <GuestNudge onDismiss={guestNudge.onDismiss} onClick={guestNudge.onClick} />
        ) : null}
      </div>
    </div>
  );
}

export function SaveSearchButton(props: SaveGroupProps) {
  return <SaveSearchControl {...props} />;
}

export function SaveSearchButtonMobile(props: Omit<SaveGroupProps, "className">) {
  return <SaveSearchControl {...props} mobile />;
}

const MOBILE_ROW_LABEL_CLASS =
  "flex shrink-0 items-center text-[0.86rem] font-semibold leading-none text-primary";
const MOBILE_ROW_SHELL_CLASS =
  "flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-surface px-2 shadow-sm ring-1 ring-primary/10";
const MOBILE_ROW_HEIGHT = "h-14";
const MOBILE_CONTROL_HEIGHT = "h-10";

/** Mobile: Más/Borrar plus a compact Guardar control inside one Filtros bar. */
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
  const filterBtnClass =
    `inline-flex ${MOBILE_CONTROL_HEIGHT} w-10 shrink-0 items-center justify-center text-primary transition hover:bg-bg-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40`;

  return (
    <div className={`${MOBILE_ROW_SHELL_CLASS} ${MOBILE_ROW_HEIGHT} w-full min-w-0`}>
      <span className={MOBILE_ROW_LABEL_CLASS}>Filtros</span>
      <div
        className={`flex min-w-0 flex-1 ${MOBILE_CONTROL_HEIGHT} items-center gap-1.5 overflow-visible`}
        role="group"
        aria-label="Acciones de filtros y búsqueda guardada"
      >
        <div
          className={`flex ${MOBILE_CONTROL_HEIGHT} w-20 shrink-0 overflow-hidden rounded-[1rem] border border-primary/15 bg-bg-light/55 shadow-sm`}
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
        <SaveSearchControl
          onSaveClick={onSaveClick}
          pulseActive={pulseActive}
          guestNudge={guestNudge}
          mobile
          className="ml-auto"
        />
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

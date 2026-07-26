import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
import { ListingThumb } from "@/components/myListings/ListingThumb";

/** Lime accent = single room post; forest accent = multi-room property. */
export type CardTone = "room" | "property";

export function cardShellClass(tone: CardTone): string {
  const base = "rounded-2xl border border-primary/40 border-l-4 bg-primary/[0.04] shadow-sm";
  return tone === "property" ? `${base} border-l-primary` : `${base} border-l-secondary`;
}

export function ListingTypeBadge({ tone }: { tone: CardTone }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === "property" ? "bg-primary text-primary-fg" : "bg-secondary text-primary"
      }`}
    >
      {tone === "property" ? "Propiedad" : "Cuarto"}
    </span>
  );
}

/**
 * Room slot occupancy inside a property. Publication is a property-level state, so
 * rooms show whether they are offered for rent rather than repeating "Publicado".
 */
export function RoomOccupancyBadge({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold ${
        available
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-bg-light text-muted"
      }`}
    >
      {available ? "Disponible" : "Ocupada"}
    </span>
  );
}

/**
 * Sliding On/Off for the card header row. Height matches the compact badges (32px)
 * so the switch centers on the badge line. Property On → forest, single room On → lime.
 */
export function CardOnOffToggle({
  active,
  onChange,
  tone,
  disabled = false,
  busy = false,
  onLabel,
  offLabel,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  tone: CardTone;
  disabled?: boolean;
  busy?: boolean;
  /** Accessible description of what On/Off does for this card. */
  onLabel: string;
  offLabel: string;
}) {
  const onShell =
    tone === "property" ? "border-primary bg-primary" : "border-secondary/80 bg-secondary";
  const labelOn = tone === "property" ? "text-primary-fg" : "text-primary";
  const focusRing =
    tone === "property" ? "focus-visible:ring-primary/40" : "focus-visible:ring-secondary/50";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-busy={busy || undefined}
      aria-label={active ? onLabel : offLabel}
      title={active ? onLabel : offLabel}
      disabled={disabled || busy}
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-8 w-[5.25rem] shrink-0 items-center rounded-full border p-[3px] transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${focusRing} ${
        active ? onShell : "border-primary/20 bg-primary/[0.06]"
      }`}
    >
      <span
        className={`relative flex h-full w-full items-center rounded-full px-1 ${
          active ? "bg-black/10" : "bg-primary/[0.08]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute left-1.5 z-0 text-[11px] font-bold uppercase tracking-wide ${labelOn} ${
            active ? "opacity-100" : "invisible"
          }`}
        >
          On
        </span>
        <span
          className={`absolute right-1.5 z-0 text-[11px] font-bold uppercase tracking-wide text-primary/70 ${
            active ? "invisible" : "opacity-100"
          }`}
        >
          Off
        </span>
        <span
          className={`relative z-10 size-5 shrink-0 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
            active ? "translate-x-[3.1rem] ring-2 ring-white/30" : "translate-x-0 ring-1 ring-primary/10"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Room-level On/Off — same sliding pattern, outlined instead of filled.
 * On = disponible (offered for rent), Off = ocupada. Forest only on the border and
 * labels; the track stays the card background. `h-7` / `w-[4.25rem]` match the badge
 * row height and the photo column width so it centers on the header line.
 */
export function RoomOnOffToggle({
  available,
  onChange,
  disabled = false,
  busy = false,
}: {
  available: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const label = available
    ? "Recámara disponible — tocar para marcar como ocupada"
    : "Recámara ocupada — tocar para ofrecerla en renta";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      aria-busy={busy || undefined}
      aria-label={label}
      title={available ? "On — disponible" : "Off — ocupada"}
      disabled={disabled || busy}
      onClick={() => onChange(!available)}
      className={`relative inline-flex h-7 w-[4.25rem] shrink-0 items-center rounded-full border bg-transparent p-[3px] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${
        available ? "border-primary" : "border-primary/50"
      }`}
    >
      <span className="relative flex h-full w-full items-center rounded-full px-1" aria-hidden>
        <span
          className={`absolute left-1.5 z-0 text-[10px] font-bold uppercase tracking-wide text-primary ${
            available ? "opacity-100" : "invisible"
          }`}
        >
          On
        </span>
        <span
          className={`absolute right-1.5 z-0 text-[10px] font-bold uppercase tracking-wide text-primary/70 ${
            available ? "invisible" : "opacity-100"
          }`}
        >
          Off
        </span>
        <span
          className={`relative z-10 size-4 shrink-0 rounded-full transition-transform duration-200 ease-out ${
            available ? "translate-x-[2.375rem] bg-primary" : "translate-x-0 bg-primary/50"
          }`}
        />
      </span>
    </button>
  );
}

type CardActionProps = {
  tone: CardTone;
  label: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Stronger forest border (e.g. Recámaras on a property card). */
  emphasizeBorder?: boolean;
  size?: "default" | "compact";
  disabled?: boolean;
  /** Router location state for contextual return (e.g. Mis Anuncios). */
  state?: unknown;
} & ({ to: string; onClick?: never } | { to?: never; onClick?: () => void });

/** Standalone pill action (e.g. Recámaras / Restaurar); use `CardActionGroup` for icon clusters. */
export function CardAction({
  tone,
  label,
  icon,
  trailingIcon,
  emphasizeBorder = false,
  size = "default",
  disabled = false,
  to,
  state,
  onClick,
}: CardActionProps) {
  const ring = emphasizeBorder
    ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
    : tone === "property"
      ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
      : "border-secondary/40 bg-secondary/20 text-primary hover:bg-secondary/30";
  const sizeClass =
    size === "compact"
      ? "min-h-7 gap-1 rounded-lg px-2 py-0.5 text-[11px] leading-none"
      : "min-h-11 gap-1.5 rounded-full px-3 text-xs";
  const className = `inline-flex shrink-0 items-center justify-center border font-semibold transition disabled:opacity-50 ${sizeClass} ${ring}`;

  if (to && !disabled) {
    return (
      <Link to={to} state={state} aria-label={label} title={label} className={className}>
        {icon}
        <span>{label}</span>
        {trailingIcon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {icon}
      <span>{label}</span>
      {trailingIcon}
    </button>
  );
}

export type CardActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Router location state for contextual return (e.g. Mis Anuncios). */
  state?: unknown;
} & ({ to: string; onClick?: never } | { to?: never; onClick?: () => void });

/**
 * Connected on mobile; restores the original separate icon-and-label pills from `sm` up.
 * Both layouts keep property (forest) vs room (lime) coloring.
 */
export function CardActionGroup({
  tone,
  size = "default",
  actions,
  "aria-label": ariaLabel = "Acciones del anuncio",
}: {
  tone: CardTone;
  size?: "default" | "compact";
  actions: readonly CardActionItem[];
  "aria-label"?: string;
}) {
  if (actions.length === 0) return null;

  const shell =
    tone === "property"
      ? "border-primary/25 bg-primary/10 text-primary"
      : "border-secondary/40 bg-secondary/20 text-primary";
  const divider =
    tone === "property" ? "divide-primary/15" : "divide-secondary/35";
  const hover =
    tone === "property" ? "hover:bg-primary/15" : "hover:bg-secondary/30";
  const sizeClass =
    size === "compact"
      ? "h-7 rounded-lg"
      : "h-11 rounded-full";
  const itemPad =
    size === "compact" ? "min-w-7 px-1.5" : "min-w-10 px-2.5 sm:min-w-11 sm:px-3";

  return (
    <>
      <div
        role="group"
        aria-label={ariaLabel}
        className={`inline-flex shrink-0 items-stretch overflow-hidden border sm:hidden ${sizeClass} ${shell} ${divider} divide-x`}
      >
        {actions.map((action) => {
          const itemClass = `inline-flex flex-1 items-center justify-center ${itemPad} transition disabled:opacity-50 ${hover}`;
          if (action.to && !action.disabled) {
            return (
              <Link
                key={action.key}
                to={action.to}
                state={action.state}
                aria-label={action.label}
                title={action.label}
                className={itemClass}
              >
                {action.icon}
                {!action.icon ? <span className="text-[11px] font-semibold">{action.label}</span> : null}
              </Link>
            );
          }
          return (
            <button
              key={action.key}
              type="button"
              aria-label={action.label}
              title={action.label}
              disabled={action.disabled}
              onClick={action.onClick}
              className={itemClass}
            >
              {action.icon}
              {!action.icon ? <span className="text-[11px] font-semibold">{action.label}</span> : null}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label={ariaLabel} className="hidden flex-wrap items-center gap-1.5 sm:flex">
        {actions.map((action) =>
          action.to ? (
            <CardAction
              key={action.key}
              tone={tone}
              size={size}
              label={action.label}
              icon={action.icon}
              disabled={action.disabled}
              to={action.to}
              state={action.state}
            />
          ) : (
            <CardAction
              key={action.key}
              tone={tone}
              size={size}
              label={action.label}
              icon={action.icon}
              disabled={action.disabled}
              onClick={action.onClick}
            />
          ),
        )}
      </div>
    </>
  );
}

/**
 * Card photo with the reference code beneath it. Rooms without saved photos omit the
 * thumb entirely and keep only the quiet reference, so empty slots don't show a
 * placeholder box.
 */
export function PhotoWithReference({
  src,
  code,
  badge,
  thumbClassName = "size-[4.25rem] rounded-xl",
}: {
  src?: string;
  code: string;
  badge?: ReactNode;
  thumbClassName?: string;
}) {
  return (
    <div className="flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5">
      {src ? (
        <div className="relative">
          <ListingThumb src={src} className={thumbClassName} />
          {badge}
        </div>
      ) : null}
      <ListingReferenceChip code={code} label="#" size="quiet" title={`Referencia: ${code}`} />
    </div>
  );
}

/**
 * Shared header stack for both card types:
 * 1) badges + On/Off on one centered row
 * 2) title + place, with the photo top edge on the vertical middle of the title line
 * 3) optional details (rent / room counts)
 */
export function CardHeader({
  badges,
  toggle,
  title,
  place,
  photo,
  details,
}: {
  badges: ReactNode;
  toggle: ReactNode;
  title: string;
  place: string;
  photo: ReactNode;
  details?: ReactNode;
}) {
  return (
    <div className="min-h-0 min-w-0 flex-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-2">{badges}</div>
        <div className="flex h-8 items-center justify-end">{toggle}</div>
      </div>

      {/*
        Photo top edge = midpoint of the title line (text-base + leading-snug → 1.375rem
        line box), so half a line is 0.6875rem.
      */}
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug text-body">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted">{place}</p>
          {details ? <div className="mt-2">{details}</div> : null}
        </div>
        <div className="mt-[0.6875rem] shrink-0">{photo}</div>
      </div>
    </div>
  );
}

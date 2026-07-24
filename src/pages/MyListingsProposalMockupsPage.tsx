import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Eye,
  LayoutGrid,
  Pencil,
  RefreshCw,
  Share2,
  Smartphone,
  Star,
  X,
} from "lucide-react";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { ListingThumb } from "@/components/myListings/ListingThumb";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  isRoomIdealParaTag,
} from "@/lib/listingTags";
import { TAG_LABELS } from "@/lib/searchFilters";
import { ROOM_SUMMARY_MAX, ROOM_SUMMARY_MIN } from "@/lib/publishWizard/publishCore";
import type { ListingTag } from "@/types/listing";

/**
 * UX proposal mockups for Mis Anuncios IA.
 * Not wired to live data — do not confuse with /mis-anuncios.
 *
 * Desktop: /mockups/mis-anuncios-proposal
 * Mobile:  /mockups/mis-anuncios-proposal?v=mobile
 */
const MOCK_PATH = "/mockups/mis-anuncios-proposal";
const MOCK_MOBILE_PATH = `${MOCK_PATH}?v=mobile`;
const MOCK_DESKTOP_PATH = `${MOCK_PATH}?v=desktop`;

/** Fixed collapsed height so Cuarto and Propiedad shells match. */
const CARD_SHELL =
  "flex h-[15.25rem] flex-col justify-between gap-3 p-4 sm:h-[14.75rem]";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect fill="#E2E8F0" width="160" height="160"/><text x="50%" y="54%" text-anchor="middle" fill="#64748B" font-family="system-ui" font-size="14">foto</text></svg>`,
  );

/** Mirrors the property-room summary placeholder in PropertyRoomManager. */
const ROOM_SUMMARY_PLACEHOLDER =
  "Describe el tamaño, la iluminación, si tiene clóset, y qué incluye.";

const ROOM_STAY_MAX = 36;

type MockRoom = {
  id: string;
  name: string;
  rentLabel: string | null;
  occupied: boolean;
  status: "published" | "paused" | "draft" | "archived";
  metrics: string;
  /** Saved room photos. Omit / empty → no photo area on the card. */
  thumb?: string;
  /**
   * Occupied rooms that never finished rental data need the full activation form
   * before they can be turned On (offered for rent).
   */
  needsActivationForm?: boolean;
};

type Viewport = "desktop" | "mobile";
type CardTone = "room" | "property";
type HubKind = "room" | "property";

type HubItem = {
  key: string;
  kind: HubKind;
  active: boolean;
};

const MOCK_SINGLE: MockRoom = {
  id: "A11111111",
  name: "Recámara iluminada cerca de Chapultepec",
  rentLabel: "$6,500 /mes",
  occupied: false,
  status: "published",
  metrics: "12 vistas · 2 mensajes",
  thumb: PLACEHOLDER,
};

const MOCK_PROPERTY_ROOMS: MockRoom[] = [
  {
    id: "A22222221",
    name: "Recámara 1",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    // Occupied + never rented → no saved photos, no photo area on the card.
    needsActivationForm: true,
  },
  {
    id: "A22222222",
    name: "Recámara 2",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    needsActivationForm: true,
  },
  {
    id: "A22222223",
    name: "Recámara 3",
    rentLabel: "$5,200 /mes",
    occupied: false,
    status: "published",
    metrics: "8 vistas · 1 mensaje",
    thumb: PLACEHOLDER,
  },
  {
    id: "A22222224",
    name: "Recámara 4",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    // Complete rental data already on file — toggles On without the form. Still no photos.
  },
  {
    id: "A22222225",
    name: "Recámara 5",
    rentLabel: "$4,800 /mes",
    occupied: false,
    status: "paused",
    metrics: "3 vistas · 0 mensajes",
    thumb: PLACEHOLDER,
  },
];

function toneShell(tone: CardTone): string {
  const base = "border-primary/40 bg-primary/[0.04]";
  return tone === "property"
    ? `${base} border-l-primary`
    : `${base} border-l-secondary`;
}

function ProposalBadge({ children, tone }: { children: string; tone: CardTone }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === "property"
          ? "bg-primary text-primary-fg"
          : "bg-secondary text-primary"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Room slot occupancy — replaces the publication badge on rooms inside a property.
 * Publication is a property-level state; a room is either offered for rent or lived in.
 */
function RoomOccupancyBadge({ available }: { available: boolean }) {
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

function LabeledAction({
  tone,
  label,
  onClick,
  icon,
  trailingIcon,
  emphasizeBorder = false,
  size = "default",
}: {
  tone: CardTone;
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Stronger forest border (e.g. Recámaras on Propiedad). */
  emphasizeBorder?: boolean;
  size?: "default" | "compact";
}) {
  const ring = emphasizeBorder
    ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
    : tone === "property"
      ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
      : "border-secondary/40 bg-secondary/20 text-primary hover:bg-secondary/30";
  const sizeClass =
    size === "compact"
      ? "min-h-7 gap-1 rounded-lg px-2 py-0.5 text-[11px] leading-none"
      : "min-h-11 gap-1.5 rounded-full px-3 text-xs";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center border font-semibold transition ${sizeClass} ${ring}`}
    >
      {icon}
      <span>{label}</span>
      {trailingIcon}
    </button>
  );
}

function ListingActionRow({
  tone,
  onToggleRooms,
  roomsOpen,
}: {
  tone: CardTone;
  onToggleRooms?: () => void;
  roomsOpen?: boolean;
  roomCount?: number;
}) {
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5">
      <LabeledAction
        tone={tone}
        label="Ver"
        icon={<Eye className="size-4 shrink-0" aria-hidden />}
      />
      <LabeledAction
        tone={tone}
        label="Edit"
        icon={<Pencil className="size-4 shrink-0" aria-hidden />}
      />
      <LabeledAction
        tone={tone}
        label="Compartir"
        icon={<Share2 className="size-4 shrink-0" aria-hidden />}
      />
      {onToggleRooms ? (
        <div className="ml-auto shrink-0 pl-2">
          <LabeledAction
            tone={tone}
            label="Recámaras"
            emphasizeBorder
            onClick={onToggleRooms}
            trailingIcon={
              <ChevronDown
                className={`size-4 shrink-0 transition ${roomsOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shared header stack for Cuarto + Propiedad:
 * 1) labels + On/Off
 * 2) title + neighborhood; photo top aligns to the vertical middle of the title text
 * 3) optional details (price / rooms) — may differ per card
 */
function CardSharedTop({
  tone,
  active,
  onActiveChange,
  labels,
  title,
  place = "Providencia · Guadalajara",
  photo,
  details,
}: {
  tone: CardTone;
  active: boolean;
  onActiveChange: (next: boolean) => void;
  labels: ReactNode;
  title: string;
  place?: string;
  photo: ReactNode;
  details?: ReactNode;
}) {
  return (
    <div className="min-h-0 min-w-0 flex-1">
      {/* Labels + toggle: shared row midpoint (toggle h-8 matches compact chips). */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-h-8 flex-wrap items-center gap-2">{labels}</div>
        <div className="flex h-8 items-center justify-end">
          <OnOffToggle active={active} onChange={onActiveChange} tone={tone} />
        </div>
      </div>

      {/*
        Photo top edge = midpoint of the title line (text-base + leading-snug → 1.375rem line box).
        Half line = 0.6875rem — matches the blue-line reference through the header text.
      */}
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-body">{title}</h3>
          <p className="mt-1 text-xs text-muted">{place}</p>
          {details ? <div className="mt-2">{details}</div> : null}
        </div>
        <div className="mt-[0.6875rem] shrink-0">{photo}</div>
      </div>
    </div>
  );
}

/**
 * Sliding On/Off on the card header row.
 * Height matches compact chips (`min-h-8` / 32px). Text bumped for readability.
 * Property On → forest; single room On → lime.
 */
function OnOffToggle({
  active,
  onChange,
  tone = "room",
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  tone?: CardTone;
}) {
  const onShell =
    tone === "property"
      ? "border-primary bg-primary"
      : "border-secondary/80 bg-secondary";
  const labelOn = tone === "property" ? "text-primary-fg" : "text-primary";
  const focusRing =
    tone === "property" ? "focus-visible:ring-primary/40" : "focus-visible:ring-secondary/50";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Publicación On — tocar para apagar" : "Publicación Off — tocar para encender"}
      title={active ? "On — visible" : "Off — pausada"}
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-8 w-[5.25rem] shrink-0 items-center rounded-full border p-[3px] transition duration-200 focus-visible:outline-none focus-visible:ring-2 ${focusRing} ${
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
            active
              ? "translate-x-[3.1rem] ring-2 ring-white/30"
              : "translate-x-0 ring-1 ring-primary/10"
          }`}
        />
      </span>
    </button>
  );
}

const MODAL_INPUT =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2";

type RoomActivationDraft = {
  title: string;
  lodgingType: "private_room" | "shared_room" | "";
  roomDimension: "small" | "medium" | "large" | "";
  rentMxn: string;
  rentIncludesUtilities: boolean;
  depositMxn: string;
  avalRequired: boolean;
  availableFrom: string;
  minimalStayMonths: number;
  roommateGenderPref: "any" | "female" | "male" | "";
  ageMin: number;
  ageMax: number;
  summary: string;
  tags: ListingTag[];
  photos: string[];
};

function emptyActivationDraft(room: MockRoom): RoomActivationDraft {
  return {
    title: room.name,
    lodgingType: "",
    roomDimension: "",
    rentMxn: "",
    rentIncludesUtilities: false,
    depositMxn: "",
    avalRequired: false,
    availableFrom: "",
    minimalStayMonths: 1,
    roommateGenderPref: "",
    ageMin: 18,
    ageMax: 99,
    summary: "",
    tags: [],
    photos: [],
  };
}

function activationDraftComplete(d: RoomActivationDraft): boolean {
  if (!d.title.trim()) return false;
  if (!d.lodgingType || !d.roomDimension) return false;
  if (!Number.isFinite(Number(d.rentMxn)) || Number(d.rentMxn) <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.availableFrom.trim())) return false;
  if (d.minimalStayMonths < 1) return false;
  if (!d.roommateGenderPref) return false;
  if (d.ageMin < 18 || d.ageMax < 18 || d.ageMax > 99 || d.ageMin > d.ageMax) return false;
  const summary = d.summary.trim();
  if (summary.length < ROOM_SUMMARY_MIN || summary.length > ROOM_SUMMARY_MAX) return false;
  if (!d.tags.some((t) => isRoomIdealParaTag(t))) return false;
  return true;
}

/**
 * Local-only photo widget that mirrors BulkImageUploader chrome for the mockup —
 * no API upload, just object URLs so the activation form looks complete.
 */
function MockRoomPhotoWidget({
  title,
  photos,
  onChange,
}: {
  title: string;
  photos: string[];
  onChange: (next: string[]) => void;
}) {
  const maxCount = 20;
  const addFiles = (files: File[]) => {
    const take = files.slice(0, Math.max(0, maxCount - photos.length));
    if (!take.length) return;
    const urls = take.map((f) => URL.createObjectURL(f));
    onChange([...photos, ...urls]);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-body">{title}</h3>
          <p className="mt-1 text-xs text-muted">
            {photos.length}/{maxCount} fotos · Solo el interior de esta recámara. No incluyas sala,
            cocina ni otras áreas comunes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-elevated">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                addFiles(files);
              }}
            />
            Subir fotos
          </label>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-elevated">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                addFiles(files);
              }}
            />
            Tomar foto
          </label>
        </div>
      </div>
      {photos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-bg-light px-3 py-6 text-center text-xs text-muted">
          Arrastra y suelta aquí… Toca la estrella para elegir la portada.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((src, i) => (
            <li key={src} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
                  Portada
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Hacer portada"
                  title="Hacer portada"
                  onClick={() => onChange([src, ...photos.filter((p) => p !== src)])}
                  className="absolute left-1 top-1 rounded-full bg-black/50 p-1 text-white"
                >
                  <Star className="size-3" aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-label="Quitar"
                onClick={() => onChange(photos.filter((p) => p !== src))}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Full property-room form (same fields/labels as AvailableRoomFields in PropertyRoomManager)
 * so turning an occupied room On does not send owners back to the wizard.
 * Portaled to `document.body` at the app-modal layer so it clears the sticky header.
 */
function RoomActivationModal({
  room,
  onCancel,
  onActivate,
}: {
  room: MockRoom;
  onCancel: () => void;
  onActivate: (draft: RoomActivationDraft) => void;
}) {
  const [draft, setDraft] = useState<RoomActivationDraft>(() => emptyActivationDraft(room));
  const patch = (next: Partial<RoomActivationDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));
  const complete = activationDraftComplete(draft);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const toggleTag = (tag: ListingTag, active: boolean) => {
    patch({
      tags: active ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag],
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Completar ${room.name} para ofrecerla en renta`}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <RoomOccupancyBadge available={false} />
            <p className="min-w-0 truncate text-sm font-semibold text-body">{draft.title || room.name}</p>
          </div>
          <h2 className="mt-2 text-base font-semibold text-body">
            Completa estos datos para ofrecerla en renta
          </h2>
          <p className="mt-1 text-xs text-muted">
            Mismos campos que al publicar una recámara disponible. Al guardar, la recámara pasa a
            Disponible dentro de la propiedad.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-medium text-body">
            Título de la recámara
            <span className="text-error"> *</span>
            <input
              type="text"
              value={draft.title}
              placeholder={`Ej. Cuarto con balcón · ${room.name}`}
              onChange={(e) => patch({ title: e.target.value })}
              className={MODAL_INPUT}
            />
          </label>

          <div>
            <h3 className="text-sm font-bold text-primary">Información principal</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                Tipo de recámara
                <span className="text-error"> *</span>
                <select
                  value={draft.lodgingType}
                  onChange={(e) =>
                    patch({ lodgingType: e.target.value as RoomActivationDraft["lodgingType"] })
                  }
                  className={MODAL_INPUT}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="private_room">Recámara privada</option>
                  <option value="shared_room">Recámara compartida</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-body">
                Tamaño de la recámara
                <span className="text-error"> *</span>
                <select
                  value={draft.roomDimension}
                  onChange={(e) =>
                    patch({
                      roomDimension: e.target.value as RoomActivationDraft["roomDimension"],
                    })
                  }
                  className={MODAL_INPUT}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="small">Individual (Cabe cama individual + buró)</option>
                  <option value="medium">Matrimonial (Cabe cama matrimonial + escritorio)</option>
                  <option value="large">Grande (Cabe cama Queen/King + área de estar)</option>
                </select>
              </label>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-body">
                    Renta (MXN / mes)
                    <span className="text-error"> *</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={draft.rentMxn}
                      onChange={(e) => patch({ rentMxn: e.target.value })}
                      className={MODAL_INPUT}
                    />
                  </label>
                  <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body">
                    <input
                      type="checkbox"
                      checked={draft.rentIncludesUtilities}
                      onChange={(e) => patch({ rentIncludesUtilities: e.target.checked })}
                      className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-body">
                        Servicios básicos incluidos
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">
                        Activa esta opción si el precio de renta ya cubre luz, agua, gas e internet
                        (Wi-Fi).
                      </span>
                    </span>
                  </label>
                </div>
                <label className="block text-sm font-medium text-body">
                  Depósito (MXN)
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={draft.depositMxn}
                    placeholder="0"
                    onChange={(e) => patch({ depositMxn: e.target.value })}
                    className={MODAL_INPUT}
                  />
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 text-body sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.avalRequired}
                    onChange={(e) => patch({ avalRequired: e.target.checked })}
                    className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-body">Se requiere aval</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      Activa esta opción si para rentar esta recámara es obligatorio presentar aval.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-primary">Disponibilidad</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                Disponible desde
                <span className="text-error"> *</span>
                <input
                  type="date"
                  value={draft.availableFrom}
                  onChange={(e) => patch({ availableFrom: e.target.value })}
                  className={MODAL_INPUT}
                />
              </label>
              <div className="block text-sm font-medium text-body">
                <span className="block">
                  Estancia mín. (meses)
                  <span className="text-error"> *</span>
                </span>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={Math.min(ROOM_STAY_MAX, Math.max(0, draft.minimalStayMonths))}
                  min={0}
                  max={ROOM_STAY_MAX}
                  onChange={(n) => patch({ minimalStayMonths: n })}
                  decrementLabel="Menos meses"
                  incrementLabel="Más meses"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-primary">Perfil buscado</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-medium text-body">
                {ROOMMATE_GENDER_PREF_FIELD_LABEL}
                <span className="text-error"> *</span>
                <select
                  value={draft.roommateGenderPref}
                  onChange={(e) =>
                    patch({
                      roommateGenderPref: e.target
                        .value as RoomActivationDraft["roommateGenderPref"],
                    })
                  }
                  className={MODAL_INPUT}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="any">Sin preferencia</option>
                  <option value="female">Mujeres</option>
                  <option value="male">Hombres</option>
                </select>
              </label>
              <div className="block text-sm font-medium text-body">
                <span className="block">
                  Edad mín.
                  <span className="text-error"> *</span>
                </span>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={draft.ageMin}
                  min={18}
                  max={99}
                  onChange={(n) =>
                    patch({
                      ageMin: n,
                      ageMax: draft.ageMax < n ? n : draft.ageMax,
                    })
                  }
                  decrementLabel="Menor edad mínima"
                  incrementLabel="Mayor edad mínima"
                />
              </div>
              <div className="block text-sm font-medium text-body">
                <span className="block">
                  Edad máx.
                  <span className="text-error"> *</span>
                </span>
                <WizardNumberStepper
                  editableCenter
                  maxInputDigits={2}
                  value={draft.ageMax}
                  min={18}
                  max={99}
                  onChange={(n) =>
                    patch({
                      ageMax: n,
                      ageMin: draft.ageMin > n ? n : draft.ageMin,
                    })
                  }
                  decrementLabel="Menor edad máxima"
                  incrementLabel="Mayor edad máxima"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-primary">
              Detalles de esta recámara
              <span className="text-error"> *</span>
            </h3>
            <textarea
              value={draft.summary}
              onChange={(e) => patch({ summary: e.target.value })}
              rows={3}
              maxLength={ROOM_SUMMARY_MAX}
              placeholder={ROOM_SUMMARY_PLACEHOLDER}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            />
            <span
              className={`block text-xs ${
                draft.summary.trim().length < ROOM_SUMMARY_MIN ? "text-warning-fg" : "text-muted"
              }`}
            >
              {draft.summary.trim().length}/{ROOM_SUMMARY_MIN}
            </span>
            <MockRoomPhotoWidget
              title={`Fotos de ${draft.title.trim() || room.name}`}
              photos={draft.photos}
              onChange={(photos) => patch({ photos })}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
            {ROOM_TAG_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-medium text-body">
                  {group.title}
                  {group.title === "Ideal para" ? <span className="text-error"> *</span> : null}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.tags.map((tag) => {
                    const active = draft.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        onClick={() => toggleTag(tag, active)}
                        className={`rounded-full px-3 py-2 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          active
                            ? "bg-primary text-primary-fg shadow-sm ring-1 ring-primary/20"
                            : "border border-border bg-surface text-body shadow-sm hover:bg-surface-elevated"
                        }`}
                      >
                        {LISTING_TAG_LABEL_OVERRIDES[tag] ?? TAG_LABELS[tag]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-body transition hover:bg-bg-light"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!complete}
            onClick={() => onActivate(draft)}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar y activar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Room-level On/Off — same sliding pattern as the card toggle, outlined instead of filled.
 * On = disponible (offered for rent), Off = ocupada. Forest only on the border and labels;
 * the track stays the card background. `h-7` / `w-[4.25rem]` match the badge row height and
 * the photo column width so it centers on the header line and above the thumb.
 */
function RoomOnOffToggle({
  available,
  onChange,
}: {
  available: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      aria-label={
        available
          ? "Recámara disponible — tocar para marcar como ocupada"
          : "Recámara ocupada — tocar para ofrecerla en renta"
      }
      title={available ? "On — disponible" : "Off — ocupada"}
      onClick={() => onChange(!available)}
      className={`relative inline-flex h-7 w-[4.25rem] shrink-0 items-center rounded-full border bg-transparent p-[3px] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
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

function PhotoThumb({
  src,
  badge,
  idCode,
  thumbClassName = "size-[4.25rem] rounded-xl",
}: {
  src?: string;
  badge?: ReactNode;
  idCode?: string;
  thumbClassName?: string;
}) {
  return (
    <div className="flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5">
      <div className="relative">
        <ListingThumb src={src ?? PLACEHOLDER} className={thumbClassName} />
        {badge}
      </div>
      {idCode ? <ListingReferenceChip code={idCode} label="#" size="quiet" /> : null}
    </div>
  );
}

function useActiveState(
  controlledActive: boolean | undefined,
  onActiveChange: ((next: boolean) => void) | undefined,
) {
  const [internal, setInternal] = useState(true);
  const active = controlledActive ?? internal;
  function setActive(next: boolean) {
    if (onActiveChange) onActiveChange(next);
    else setInternal(next);
  }
  return [active, setActive] as const;
}

function ProblemCallout() {
  return (
    <aside className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-4 text-sm text-warning-fg">
      <p className="font-semibold">Problema actual</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-warning-fg/90">
        <li>
          En posts de <strong>un solo cuarto</strong>, la tarjeta de propiedad + la fila de
          recámara repiten título, estado y acciones.
        </li>
        <li>
          En posts de <strong>propiedad</strong>, 5 recámaras abiertas de golpe ocupan casi dos
          pantallas antes de llegar al siguiente anuncio.
        </li>
      </ul>
    </aside>
  );
}

function CurrentSingleRoomPain() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border border-l-4 border-l-primary/50 bg-surface opacity-80 shadow-sm">
      <div className="border-b border-border bg-surface-elevated px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ListingStatusBadge status="published" noun="property" />
          <ListingReferenceChip code="P90F93372" label="#" size="compact" />
        </div>
        <h3 className="mt-2 text-lg font-semibold text-body">Recámara iluminada cerca de Chapultepec</h3>
        <p className="mt-1 text-xs text-muted">Providencia · Guadalajara</p>
        <p className="mt-1 text-xs text-muted">1 recámara</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            Editar anuncio
          </span>
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body">
            Ver publicación
          </span>
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body">
            Pausar propiedad
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <ListingThumb src={PLACEHOLDER} className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-body">Recámara iluminada cerca de Chapultepec</p>
          <p className="text-xs text-muted">$6,500 /mes · 12 vistas · 2 mensajes</p>
        </div>
        <ListingStatusBadge status="published" />
      </div>
      <p className="border-t border-border bg-bg-light px-4 py-2 text-xs text-muted">
        Hoy: misma info dos veces (propiedad + fila). Acciones duplicadas.
      </p>
    </section>
  );
}

/** Proposed flat single-room card — shared top alignment with Propiedad. */
function ProposedSingleRoomCard({
  room,
  active: controlledActive,
  onActiveChange,
}: {
  room: MockRoom;
  active?: boolean;
  onActiveChange?: (next: boolean) => void;
}) {
  const tone: CardTone = "room";
  const [active, setActive] = useActiveState(controlledActive, onActiveChange);
  const status = active ? room.status : "paused";

  return (
    <article
      className={`rounded-2xl border border-l-4 shadow-sm transition ${toneShell(tone)} ${
        active ? "" : "opacity-75"
      }`}
    >
      <div className={CARD_SHELL}>
        <CardSharedTop
          tone={tone}
          active={active}
          onActiveChange={setActive}
          labels={
            <>
              <ListingStatusBadge status={status} className="min-h-8 items-center" />
              <ProposalBadge tone={tone}>Cuarto</ProposalBadge>
            </>
          }
          title={room.name}
          photo={<PhotoThumb src={room.thumb} idCode={room.id} />}
          details={
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {room.rentLabel ? (
                <span className="text-sm font-semibold text-body">{room.rentLabel}</span>
              ) : null}
              <span className="text-xs text-muted">{room.metrics}</span>
            </div>
          }
        />

        <div className="flex w-full shrink-0 items-center border-t border-border/60 pt-3">
          <ListingActionRow tone={tone} />
        </div>
      </div>
    </article>
  );
}

/** Proposed compact property — same shared top as Cuarto; rooms accordion. */
function ProposedPropertyCard({
  rooms,
  defaultOpen = false,
  active: controlledActive,
  onActiveChange,
}: {
  rooms: MockRoom[];
  defaultOpen?: boolean;
  active?: boolean;
  onActiveChange?: (next: boolean) => void;
}) {
  const tone: CardTone = "property";
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useActiveState(controlledActive, onActiveChange);
  /** Room occupancy lives here so the property summary counts react to the room toggles. */
  const [occupancy, setOccupancy] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rooms.map((r) => [r.id, !r.occupied])),
  );
  const [activating, setActivating] = useState<MockRoom | null>(null);
  /** Rooms whose activation form was filled this session — don't ask twice. */
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  /** Title / rent / photo overrides after the owner fills the activation form. */
  const [overrides, setOverrides] = useState<
    Record<string, { name?: string; rentLabel?: string; thumb?: string }>
  >({});
  const displayRoom = (room: MockRoom): MockRoom => {
    const o = overrides[room.id];
    if (!o) return room;
    return {
      ...room,
      name: o.name ?? room.name,
      rentLabel: o.rentLabel ?? room.rentLabel,
      thumb: o.thumb ?? room.thumb,
    };
  };
  const isAvailable = (room: MockRoom) => occupancy[room.id] ?? !room.occupied;
  const setAvailable = (room: MockRoom, next: boolean) =>
    setOccupancy((prev) => ({ ...prev, [room.id]: next }));
  const available = rooms.filter((r) => isAvailable(r)).length;
  const occupied = rooms.length - available;
  const status = active ? "published" : "paused";

  const handleRoomToggle = (room: MockRoom, next: boolean) => {
    // Turning a room On offers it for rent, so incomplete rooms open the full form first.
    const needsData = Boolean(room.needsActivationForm) && !completed[room.id];
    if (next && needsData) {
      setActivating(room);
      return;
    }
    setAvailable(room, next);
  };

  return (
    <section
      className={`rounded-2xl border border-l-4 shadow-sm transition ${toneShell(tone)} ${
        active ? "" : "opacity-75"
      }`}
    >
      <div className={CARD_SHELL}>
        <CardSharedTop
          tone={tone}
          active={active}
          onActiveChange={setActive}
          labels={
            <>
              <ListingStatusBadge status={status} noun="property" className="min-h-8 items-center" />
              <ProposalBadge tone={tone}>Propiedad</ProposalBadge>
            </>
          }
          title="Casa amplia en Mezquitán Country"
          photo={
            <PhotoThumb
              idCode="P90F93372"
              badge={
                <span className="absolute -bottom-1 -left-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
                  {rooms.length}
                </span>
              }
            />
          }
          details={
            <>
              <p className="text-sm text-body">
                <span className="font-semibold">{rooms.length} recámaras</span>
                <span className="text-muted">
                  {" "}
                  · {available} disponible{available === 1 ? "" : "s"} · {occupied} ocupada
                  {occupied === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">23 vistas · 3 mensajes (suma)</p>
            </>
          }
        />

        <div className="flex w-full shrink-0 items-center border-t border-border/60 pt-3">
          <ListingActionRow
            tone={tone}
            roomsOpen={open}
            onToggleRooms={() => setOpen((v) => !v)}
          />
        </div>
      </div>

      {open ? (
        <ul className="divide-y divide-border border-t border-primary/20">
          {rooms.map((raw) => {
            const room = displayRoom(raw);
            const hasPhotos = Boolean(room.thumb);
            return (
              <li key={room.id} className="px-4 py-3">
                {/*
                  Right column: toggle aligned to the header line. Photo + ID only when
                  the room has saved photos — occupied slots with none omit that object.
                */}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoomOccupancyBadge available={isAvailable(room)} />
                      <p className="min-w-0 font-medium leading-snug text-body">{room.name}</p>
                    </div>
                    {isAvailable(room) ? (
                      <p className="mt-1 text-xs text-muted">
                        {[room.rentLabel, room.metrics].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <LabeledAction
                        tone={tone}
                        size="compact"
                        label="Ver"
                        icon={<Eye className="size-3.5 shrink-0" aria-hidden />}
                      />
                      <LabeledAction
                        tone={tone}
                        size="compact"
                        label="Edit"
                        icon={<Pencil className="size-3.5 shrink-0" aria-hidden />}
                      />
                      <LabeledAction
                        tone={tone}
                        size="compact"
                        label="Compartir"
                        icon={<Share2 className="size-3.5 shrink-0" aria-hidden />}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <RoomOnOffToggle
                      available={isAvailable(room)}
                      onChange={(next) => handleRoomToggle(raw, next)}
                    />
                    {hasPhotos ? (
                      <PhotoThumb
                        src={room.thumb}
                        idCode={room.id}
                        thumbClassName="size-14 rounded-lg"
                      />
                    ) : (
                      <ListingReferenceChip code={room.id} label="#" size="quiet" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {activating ? (
        <RoomActivationModal
          room={activating}
          onCancel={() => setActivating(null)}
          onActivate={(draft) => {
            const rent = Number(draft.rentMxn);
            setOverrides((prev) => ({
              ...prev,
              [activating.id]: {
                name: draft.title.trim() || activating.name,
                rentLabel: Number.isFinite(rent) && rent > 0 ? `$${rent.toLocaleString("es-MX")} /mes` : undefined,
                thumb: draft.photos[0],
              },
            }));
            setCompleted((prev) => ({ ...prev, [activating.id]: true }));
            setAvailable(activating, true);
            setActivating(null);
          }}
        />
      ) : null}
    </section>
  );
}

function sortOnFirst(items: HubItem[]): HubItem[] {
  return [...items].sort((a, b) => Number(b.active) - Number(a.active));
}

function HubComposition() {
  const [items, setItems] = useState<HubItem[]>(() =>
    sortOnFirst([
      { key: "room", kind: "room", active: true },
      { key: "property", kind: "property", active: true },
    ]),
  );

  function setActive(key: string, active: boolean) {
    setItems((prev) =>
      sortOnFirst(prev.map((item) => (item.key === key ? { ...item, active } : item))),
    );
  }

  const onCount = items.filter((i) => i.active).length;

  return (
    <div className="rounded-2xl border border-border bg-bg-light/50 p-3 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-primary sm:text-2xl">Mis anuncios</h3>
          <p className="mt-1 text-sm text-muted">
            {onCount} On · {items.length - onCount} Off (Off al final)
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg sm:flex-none">
            Publicar anuncio
          </span>
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface">
            <RefreshCw className="size-4" aria-hidden />
          </span>
        </div>
      </div>
      <div className="mb-4 border-b border-border pb-3">
        <h4 className="text-lg font-semibold text-body">Publicados</h4>
        <p className="text-sm text-muted">
          Prueba el toggle On/Off: el post Off baja al final de la lista.
        </p>
      </div>
      <div className="space-y-4">
        {items.map((item) =>
          item.kind === "room" ? (
            <ProposedSingleRoomCard
              key={item.key}
              room={MOCK_SINGLE}
              active={item.active}
              onActiveChange={(next) => setActive(item.key, next)}
            />
          ) : (
            <ProposedPropertyCard
              key={item.key}
              rooms={MOCK_PROPERTY_ROOMS}
              active={item.active}
              onActiveChange={(next) => setActive(item.key, next)}
            />
          ),
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Acciones: Edit · Ver · Compartir · (Propiedad: Cuartos ▾). On/Off en el header.
      </p>
    </div>
  );
}

function MobileFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-light shadow-sm md:rounded-[1.75rem] md:border-[6px] md:border-body/90 md:shadow-lg">
        <div className="hidden h-7 items-center justify-center bg-body/90 md:flex">
          <span className="h-1.5 w-16 rounded-full bg-surface/40" />
        </div>
        <div className="space-y-3 p-3 md:max-h-[36rem] md:overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function parseViewport(raw: string | null): Viewport | null {
  if (raw === "mobile" || raw === "desktop") return raw;
  return null;
}

export function MyListingsProposalMockupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramViewport = parseViewport(searchParams.get("v"));
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (paramViewport) return paramViewport;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "mobile";
    }
    return "desktop";
  });

  useEffect(() => {
    if (paramViewport && paramViewport !== viewport) {
      setViewport(paramViewport);
    }
  }, [paramViewport, viewport]);

  useEffect(() => {
    if (paramViewport) return;
    const mq = window.matchMedia("(max-width: 767px)");
    function sync() {
      setViewport(mq.matches ? "mobile" : "desktop");
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [paramViewport]);

  function chooseViewport(next: Viewport) {
    setViewport(next);
    setSearchParams(next === "mobile" ? { v: "mobile" } : { v: "desktop" }, { replace: true });
  }

  const isMobile = viewport === "mobile";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10 xl:max-w-6xl">
      <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body">
        <p className="font-semibold text-primary">Propuesta UX — no es la app real</p>
        <p className="mt-1 text-muted">
          Desktop:{" "}
          <Link to={MOCK_DESKTOP_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            {MOCK_DESKTOP_PATH}
          </Link>
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> · </span>
          Mobile:{" "}
          <Link to={MOCK_MOBILE_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            {MOCK_MOBILE_PATH}
          </Link>
        </p>
        <p className="mt-2 text-muted">
          Live:{" "}
          <Link to="/mis-anuncios" className="font-semibold text-primary underline-offset-2 hover:underline">
            /mis-anuncios
          </Link>
          . Nada de esto está implementado en producción todavía.
        </p>
      </div>

      <div className="sticky top-0 z-[1200] -mx-4 mt-4 border-b border-border bg-bg-light/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm font-medium text-body sm:w-auto">Vista del mockup</p>
          <button
            type="button"
            onClick={() => chooseViewport("desktop")}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold sm:flex-none ${
              !isMobile
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface text-body hover:bg-surface-elevated"
            }`}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => chooseViewport("mobile")}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold sm:flex-none ${
              isMobile
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface text-body hover:bg-surface-elevated"
            }`}
          >
            <Smartphone className="size-4" aria-hidden />
            Mobile
          </button>
        </div>
      </div>

      <header className="mt-6 sm:mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Mis anuncios · propuesta</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Menos ruido, más control por tipo de post
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Foto alineada al título · acciones con etiqueta · On/Off en el header.
        </p>
      </header>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm sm:flex-wrap">
        <a href="#single-room" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          1. Cuarto
        </a>
        <a href="#property" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          2. Propiedad
        </a>
        <a href="#hub" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          3. Hub
        </a>
        <a href="#size-compare" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          Tamaño
        </a>
      </nav>

      <div className="mt-6">
        <ProblemCallout />
      </div>

      <section id="size-compare" className="mt-10 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-lg font-semibold text-body">Misma altura · acento distinto</h2>
        <p className="mt-1 text-sm text-muted">
          Lado a lado (colapsada). Altura fija idéntica; el cuarto puede dejar espacio vacío.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
              Cuarto · lima
            </p>
            <ProposedSingleRoomCard room={MOCK_SINGLE} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Propiedad · forest
            </p>
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
          </div>
        </div>
      </section>

      <section id="single-room" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">1. Post de un solo cuarto</h2>
          <ProposalBadge tone="room">Cuarto</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          ID primero · foto alineada al título · acciones Edit/Ver/Compartir · On/Off en el header.
        </p>

        {!isMobile ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Hoy (problema)</p>
              <CurrentSingleRoomPain />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Propuesta</p>
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Hoy">
              <CurrentSingleRoomPain />
            </MobileFrame>
            <MobileFrame label="Propuesta">
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="property" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">2. Post de propiedad</h2>
          <ProposalBadge tone="property">Propiedad</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Misma composición. Accordion colapsado por defecto.
        </p>

        {!isMobile ? (
          <div className="mt-6 space-y-4">
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            <p className="text-xs text-muted">Variante abierta:</p>
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Colapsado">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            </MobileFrame>
            <MobileFrame label="Expandido">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="hub" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-xl font-bold text-primary">3. Hub mezclado · orden On → Off</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Apaga un post con el toggle: baja al final. Enciéndelo: vuelve arriba.
        </p>
        <div className="mt-6">
          {!isMobile ? (
            <HubComposition />
          ) : (
            <MobileFrame label="Hub mobile">
              <HubComposition />
            </MobileFrame>
          )}
        </div>
      </section>

      <footer className="mt-12 rounded-2xl border border-border bg-surface px-4 py-5 text-sm text-muted">
        <p className="font-semibold text-body">Siguiente paso</p>
        <p className="mt-1">
          Cuando apruebes, implementamos en{" "}
          <code className="rounded bg-bg-light px-1.5 py-0.5 text-xs">/mis-anuncios</code>.
        </p>
        <p className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Link to={MOCK_MOBILE_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            Abrir vista mobile
          </Link>
          <Link to={MOCK_DESKTOP_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            Abrir vista desktop
          </Link>
          <Link to="/mis-anuncios" className="font-semibold text-primary underline-offset-2 hover:underline">
            Mis anuncios (live)
          </Link>
        </p>
      </footer>
    </div>
  );
}

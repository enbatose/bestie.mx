import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import { WizardNumberStepper } from "@/components/WizardNumberStepper";
import { RoomOccupancyBadge } from "@/components/myListings/listingCardChrome";
import { isListingsApiConfigured, patchDraftRoom } from "@/lib/listingsApi";
import {
  LISTING_TAG_LABEL_OVERRIDES,
  ROOM_TAG_GROUPS,
  ROOMMATE_GENDER_PREF_FIELD_LABEL,
  isRoomIdealParaTag,
} from "@/lib/listingTags";
import { TAG_LABELS } from "@/lib/searchFilters";
import { ROOM_SUMMARY_MAX, ROOM_SUMMARY_MIN } from "@/lib/publishWizard/publishCore";
import {
  draftImagesToUrls,
  hydrateDraftImagesFromUrls,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";
import type {
  ListingTag,
  LodgingType,
  PropertyListing,
  RoomDimension,
  RoommateGenderPref,
} from "@/types/listing";

const ROOM_STAY_MAX = 36;

const ROOM_SUMMARY_PLACEHOLDER =
  "Describe el tamaño, la iluminación, si tiene clóset, y qué incluye.";

const FIELD_INPUT =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2";

type Draft = {
  customName: string;
  lodgingType: LodgingType | "";
  roomDimension: RoomDimension | "";
  rentMxn: string;
  rentIncludesUtilities: boolean;
  depositMxn: string;
  avalRequired: boolean;
  availableFrom: string;
  minimalStayMonths: number;
  roommateGenderPref: RoommateGenderPref | "";
  ageMin: number;
  ageMax: number;
  summary: string;
  tags: ListingTag[];
  photos: DraftImage[];
};

/**
 * Occupied rooms store demographic data instead of rental data, and the wizard writes
 * the literal title "Ocupada". Neither should be prefilled as if it were real content.
 */
function initialDraft(listing: PropertyListing): Draft {
  const storedName = listing.roomCustomName?.trim() ?? "";
  const storedTitle = listing.title?.trim() ?? "";
  const name =
    storedName || (storedTitle && !/^ocupada$/i.test(storedTitle) ? storedTitle : "");
  const lodging = listing.lodgingType;
  return {
    customName: name,
    lodgingType: lodging === "private_room" || lodging === "shared_room" ? lodging : "",
    roomDimension: listing.roomDimension ?? "",
    rentMxn: listing.rentMxn > 0 ? String(listing.rentMxn) : "",
    rentIncludesUtilities: (listing.tags ?? []).includes("servicios-incluidos"),
    depositMxn: listing.depositMxn && listing.depositMxn > 0 ? String(listing.depositMxn) : "",
    avalRequired: Boolean(listing.avalRequired),
    availableFrom: listing.availableFrom ?? "",
    minimalStayMonths:
      Number.isFinite(listing.minimalStayMonths) && (listing.minimalStayMonths ?? 0) > 0
        ? listing.minimalStayMonths!
        : 1,
    roommateGenderPref: listing.roommateGenderPref ?? "",
    ageMin: listing.ageMin >= 18 ? listing.ageMin : 18,
    ageMax: listing.ageMax >= 18 && listing.ageMax <= 99 ? listing.ageMax : 99,
    summary: listing.summary?.trim() ?? "",
    tags: (listing.tags ?? []).filter((t) => t !== "servicios-incluidos"),
    photos: hydrateDraftImagesFromUrls(listing.roomImageUrls ?? []),
  };
}

/** Mirrors `collectRoomFieldIssues` for available rooms so the modal gate matches publish. */
function missingFields(d: Draft): string[] {
  const issues: string[] = [];
  if (!d.customName.trim()) issues.push("Título de la recámara");
  if (!d.lodgingType) issues.push("Tipo de recámara");
  if (!d.roomDimension) issues.push("Tamaño de la recámara");
  const rent = Number(d.rentMxn);
  if (!Number.isFinite(rent) || rent <= 0) issues.push("Renta (MXN / mes)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.availableFrom.trim())) issues.push("Disponible desde");
  if (d.minimalStayMonths < 1) issues.push("Estancia mínima (meses)");
  if (!d.roommateGenderPref) issues.push("Preferencia de convivencia");
  if (d.ageMin < 18 || d.ageMax < 18 || d.ageMax > 99) issues.push("Edad mínima y máxima (18–99)");
  else if (d.ageMin > d.ageMax) issues.push("Edad mínima no mayor que la máxima");
  const summary = d.summary.trim();
  if (!summary) issues.push("Detalles de esta recámara");
  else if (summary.length < ROOM_SUMMARY_MIN)
    issues.push(`Detalles de esta recámara (mínimo ${ROOM_SUMMARY_MIN} caracteres)`);
  else if (summary.length > ROOM_SUMMARY_MAX)
    issues.push(`Detalles de esta recámara (máximo ${ROOM_SUMMARY_MAX} caracteres)`);
  if (!d.tags.some((t) => isRoomIdealParaTag(t))) issues.push("Ideal para (al menos una opción)");
  return issues;
}

/** True when the stored room already has everything needed to be offered for rent. */
export function roomReadyToOffer(listing: PropertyListing): boolean {
  return missingFields(initialDraft(listing)).length === 0;
}

/**
 * Collects the rental data an occupied room needs before it can be offered for rent,
 * using the same fields and labels as the publish wizard's room editor. Saves through
 * `PATCH /api/properties/:id/rooms/:roomId`, which also flips `occupancyStatus`.
 *
 * Portaled to `document.body` at the app-modal layer so it clears the sticky header.
 */
export function RoomActivationModal({
  listing,
  roomLabel,
  onCancel,
  onActivated,
}: {
  listing: PropertyListing;
  roomLabel: string;
  onCancel: () => void;
  onActivated: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(listing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const apiOn = isListingsApiConfigured();

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));
  const issues = missingFields(draft);
  const complete = issues.length === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  async function save() {
    if (!complete) {
      setShowIssues(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = draft.rentIncludesUtilities
        ? [...new Set<ListingTag>([...draft.tags, "servicios-incluidos"])]
        : draft.tags.filter((t) => t !== "servicios-incluidos");
      const deposit = Number(draft.depositMxn);
      await patchDraftRoom(listing.propertyId, listing.id, {
        occupancyStatus: "available",
        customName: draft.customName.trim(),
        title: draft.customName.trim(),
        lodgingType: draft.lodgingType as LodgingType,
        roomDimension: draft.roomDimension as RoomDimension,
        rentMxn: Number(draft.rentMxn),
        depositMxn: Number.isFinite(deposit) && deposit > 0 ? deposit : 0,
        avalRequired: draft.avalRequired,
        availableFrom: draft.availableFrom.trim(),
        minimalStayMonths: draft.minimalStayMonths,
        roommateGenderPref: draft.roommateGenderPref as RoommateGenderPref,
        ageMin: draft.ageMin,
        ageMax: draft.ageMax,
        summary: draft.summary.trim(),
        tags,
        imageUrls: draftImagesToUrls(draft.photos),
      });
      onActivated(`${draft.customName.trim()} ya está disponible para renta.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar la recámara.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onCancel()}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Completar ${roomLabel} para ofrecerla en renta`}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <RoomOccupancyBadge available={false} />
            <p className="min-w-0 truncate text-sm font-semibold text-body">
              {draft.customName.trim() || roomLabel}
            </p>
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
              value={draft.customName}
              placeholder={`Ej. Cuarto con balcón · ${roomLabel}`}
              onChange={(e) => patch({ customName: e.target.value })}
              className={FIELD_INPUT}
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
                  onChange={(e) => patch({ lodgingType: e.target.value as LodgingType })}
                  className={FIELD_INPUT}
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
                  onChange={(e) => patch({ roomDimension: e.target.value as RoomDimension })}
                  className={FIELD_INPUT}
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
                      className={FIELD_INPUT}
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
                    className={FIELD_INPUT}
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
                  className={FIELD_INPUT}
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
                    patch({ roommateGenderPref: e.target.value as RoommateGenderPref })
                  }
                  className={FIELD_INPUT}
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
                  onChange={(n) => patch({ ageMin: n, ageMax: draft.ageMax < n ? n : draft.ageMax })}
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
                  onChange={(n) => patch({ ageMax: n, ageMin: draft.ageMin > n ? n : draft.ageMin })}
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
            <BulkImageUploader
              title={`Fotos de ${draft.customName.trim() || roomLabel}`}
              images={draft.photos}
              maxCount={20}
              apiOn={apiOn}
              hint="Solo el interior de esta recámara. No incluyas sala, cocina ni otras áreas comunes."
              onImagesChange={(photos) => patch({ photos })}
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
                        onClick={() =>
                          patch({
                            tags: active
                              ? draft.tags.filter((t) => t !== tag)
                              : [...draft.tags, tag],
                          })
                        }
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

        <div className="border-t border-border px-5 py-4">
          {showIssues && issues.length ? (
            <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg" role="alert">
              Faltan: {issues.join(" · ")}.
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 text-xs text-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-body transition hover:bg-bg-light disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              aria-busy={saving || undefined}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar y activar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

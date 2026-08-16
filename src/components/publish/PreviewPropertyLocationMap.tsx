import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, MapPin, Maximize2, Pencil, X } from "lucide-react";
import { GoogleStreetViewPane } from "@/components/listing/GoogleStreetViewPane";
import { StreetViewPovEditor } from "@/components/publish/StreetViewPovEditor";
import { streetViewPovCacheKey } from "@/lib/streetView";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { PropertyMap } from "@/components/map/PropertyMap";
import { resolveApproximateRadiusMeters, clampApproximateRadiusMeters, APPROXIMATE_LOCATION_RADIUS_MIN_M, APPROXIMATE_LOCATION_RADIUS_MAX_M } from "@/lib/approximateLocationRadius";
import type { PropertyListing, StreetViewPov } from "@/types/listing";

/** Zoom de barrio (~5 km de contexto visible en pantallas típicas). */
const PREVIEW_LOCATION_MAP_ZOOM = 13;
/** Radio visual al editar ubicación en vista previa (~5 km). */
const PREVIEW_EDIT_RADIUS_M = 5000;

type Props = {
  listing: PropertyListing;
  mapCenter: [number, number];
  isApproximateLocation: boolean;
  useCustomMapPin?: boolean;
  streetViewPov?: StreetViewPov;
  /** Location belongs to the property; room-scoped editing views show it read-only. */
  canEdit?: boolean;
  onSaveCoordinates: (lat: number, lng: number) => void;
  /** Called when the user edits the Street View POV from the preview step. */
  onStreetViewPovChange?: (pov: StreetViewPov) => void;
  /** Called to enable (true) or disable (false) the Street View pane. */
  onToggleStreetView?: (enabled: boolean) => void;
  /** Called when the user opts to switch from approximate to precise location. */
  onSwitchToPrecise?: () => void;
  /** Enable/disable privacy disk and set its radius (meters). */
  onPrivacyChange?: (next: { isApproximateLocation: boolean; approximateRadiusMeters: number }) => void;
};

function LocationEditActions({
  onSave,
  onCancel,
  compact,
}: {
  onSave: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onSave}
        className={`rounded-lg bg-primary font-semibold text-primary-fg shadow-sm ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={`rounded-lg border border-border bg-surface/95 font-semibold text-body shadow-sm backdrop-blur-sm ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        Cancelar
      </button>
    </>
  );
}

export function PreviewPropertyLocationMap({
  listing,
  mapCenter,
  isApproximateLocation,
  useCustomMapPin,
  streetViewPov: streetViewPovProp,
  canEdit = true,
  onSaveCoordinates,
  onStreetViewPovChange,
  onToggleStreetView,
  onSwitchToPrecise,
  onPrivacyChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingStreetView, setEditingStreetView] = useState(false);
  const [draftPosition, setDraftPosition] = useState<[number, number]>([listing.lat, listing.lng]);
  const hideExactAddress = isApproximateLocation || Boolean(listing.isApproximateLocation);
  const privacyRadiusM = resolveApproximateRadiusMeters(listing.approximateRadiusMeters);
  const streetViewPov = streetViewPovProp ?? listing.streetViewPov;
  const showStreetView =
    !hideExactAddress && (useCustomMapPin === true || Boolean(streetViewPov));
  const gridClass = showStreetView ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4";
  const listingMapCenter = useMemo(
    (): [number, number] => [listing.lat, listing.lng],
    [listing.lat, listing.lng],
  );

  useEffect(() => {
    if (!editingLocation) {
      setDraftPosition([listing.lat, listing.lng]);
    }
  }, [listing.lat, listing.lng, editingLocation]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const saveLocationEdit = () => {
    onSaveCoordinates(draftPosition[0], draftPosition[1]);
    setEditingLocation(false);
    setExpanded(false);
  };

  const cancelLocationEdit = () => {
    setDraftPosition([listing.lat, listing.lng]);
    setEditingLocation(false);
    setExpanded(false);
  };

  const streetViewLat = editingLocation ? draftPosition[0] : listing.lat;
  const streetViewLng = editingLocation ? draftPosition[1] : listing.lng;

  const editMapProps = {
    center: mapCenter,
    position: draftPosition,
    hasDefinedLocation: true as const,
    locationLabel: null,
    onPositionChange: (lat: number, lng: number) => setDraftPosition([lat, lng]),
    showApproximateRadius: hideExactAddress,
    approximateRadiusMeters: hideExactAddress ? privacyRadiusM : PREVIEW_EDIT_RADIUS_M,
    forceDraggablePin: true,
    embed: true,
  };

  const readOnlyMap = (heightClass: string) => (
    <PropertyMap
      listings={[listing]}
      selectedId={listing.id}
      onSelect={() => {}}
      embed
      className={`${heightClass} rounded-xl border border-border`}
      defaultCenter={listingMapCenter}
      defaultZoom={PREVIEW_LOCATION_MAP_ZOOM}
      preferDefaultView
      disableSelectionSync
      approximateAsCircle={hideExactAddress}
      approximateCircleRadiusM={privacyRadiusM}
    />
  );

  const editMap = (mapHeight: number | string) => (
    <WizardLocationMap {...editMapProps} mapHeight={mapHeight} />
  );

  const mapPane = (heightClass: string, editHeight: number | string) => (
    <div className="relative">
      {editingLocation ? (
        <div className={heightClass}>{editMap(editHeight)}</div>
      ) : (
        readOnlyMap(heightClass)
      )}

      {/* Ampliar mapa — top-left to stay clear of zoom controls */}
      {!editingLocation ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          <span className="sm:hidden">Ampliar</span>
          <span className="hidden sm:inline">Ampliar mapa</span>
        </button>
      ) : null}

      {canEdit ? (
        <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5">
          {editingLocation ? (
            <LocationEditActions compact onSave={saveLocationEdit} onCancel={cancelLocationEdit} />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLocation(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar ubicación
            </button>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Approximate-location callout */}
      {hideExactAddress && canEdit && onSwitchToPrecise ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs leading-snug text-amber-800">
              Cambia tu ubicación de un aproximado a la ubicación precisa, esto te permitirá
              agregar la vista de calle.
            </p>
            <button
              type="button"
              onClick={() => {
                onSwitchToPrecise();
                setEditingLocation(true);
              }}
              className="mt-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Activar ubicación precisa
            </button>
          </div>
        </div>
      ) : null}

      <div className={gridClass}>
        <div className={showStreetView ? "" : "col-span-full"}>{mapPane("h-[260px] md:h-[320px]", 220)}</div>

        {showStreetView ? (
          <div className="relative">
            {editingStreetView && onStreetViewPovChange ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <StreetViewPovEditor
                  lat={streetViewLat}
                  lng={streetViewLng}
                  pov={streetViewPov}
                  onPovChange={onStreetViewPovChange}
                  heightClass="h-[260px] md:h-[320px]"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2">
                  <p className="min-w-0 text-xs leading-snug text-muted">
                    Gira la cámara hacia la fachada de tu propiedad.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingStreetView(false)}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg"
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <GoogleStreetViewPane
                  key={streetViewPovCacheKey(streetViewPov) || `${streetViewLat},${streetViewLng}`}
                  lat={streetViewLat}
                  lng={streetViewLng}
                  streetViewPov={streetViewPov}
                  trackingInterface="listing_preview"
                  propertyId={listing.propertyId}
                  listingId={listing.id}
                  loadEager
                />
                {canEdit ? (
                  <div className="absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5">
                    {onStreetViewPovChange ? (
                      <button
                        type="button"
                        onClick={() => setEditingStreetView(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Ajustar<span className="hidden sm:inline"> vista</span>
                      </button>
                    ) : null}
                    {onToggleStreetView ? (
                      <button
                        type="button"
                        onClick={() => onToggleStreetView(false)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
                      >
                        <EyeOff className="size-3.5" aria-hidden />
                        Quitar<span className="hidden sm:inline"> vista</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : !hideExactAddress && canEdit && onToggleStreetView ? (
          /* Precise location but no Street View yet — offer to enable */
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-bg-light">
            <div className="p-6 text-center">
              <Eye className="mx-auto mb-2 size-6 text-muted" aria-hidden />
              <p className="text-xs text-muted">Sin vista de calle</p>
              <button
                type="button"
                onClick={() => {
                  onToggleStreetView(true);
                  setEditingStreetView(true);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body shadow-sm transition hover:bg-surface-elevated"
              >
                <Eye className="size-3.5" aria-hidden />
                Agregar vista de calle
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {hideExactAddress ? (
        <p className="mt-2 text-xs text-muted">
          Ubicación aproximada por privacidad (radio ~{privacyRadiusM} m); el pin exacto no se muestra.
        </p>
      ) : null}

      {canEdit && onPrivacyChange ? (
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition hover:bg-surface-elevated">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-secondary focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0"
              checked={hideExactAddress}
              onChange={(e) => {
                const hideExact = e.target.checked;
                onPrivacyChange({
                  isApproximateLocation: hideExact,
                  approximateRadiusMeters: clampApproximateRadiusMeters(privacyRadiusM),
                });
                if (hideExact) setEditingStreetView(false);
              }}
            />
            <div>
              <span className="block text-sm font-semibold text-primary">
                Ocultar dirección exacta en el anuncio
              </span>
              <span className="block text-xs text-muted">
                El mapa público muestra un perímetro (entre {APPROXIMATE_LOCATION_RADIUS_MIN_M} y{" "}
                {APPROXIMATE_LOCATION_RADIUS_MAX_M} m) en lugar del pin exacto.
              </span>
            </div>
          </label>
          {hideExactAddress ? (
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="preview-privacy-radius" className="text-xs font-semibold text-body">
                  Radio de privacidad
                </label>
                <span className="text-xs font-medium tabular-nums text-primary">{privacyRadiusM} m</span>
              </div>
              <input
                id="preview-privacy-radius"
                type="range"
                min={APPROXIMATE_LOCATION_RADIUS_MIN_M}
                max={APPROXIMATE_LOCATION_RADIUS_MAX_M}
                step={10}
                value={privacyRadiusM}
                onChange={(e) =>
                  onPrivacyChange({
                    isApproximateLocation: true,
                    approximateRadiusMeters: clampApproximateRadiusMeters(Number(e.target.value)),
                  })
                }
                className="mt-2 h-2 w-full cursor-pointer accent-secondary"
                aria-valuemin={APPROXIMATE_LOCATION_RADIUS_MIN_M}
                aria-valuemax={APPROXIMATE_LOCATION_RADIUS_MAX_M}
                aria-valuenow={privacyRadiusM}
                aria-label="Radio de privacidad en metros"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mapa ampliado de la propiedad"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-body">
                {editingLocation ? "Editar ubicación de la propiedad" : "Ubicación de la propiedad"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {editingLocation ? (
                  <LocationEditActions onSave={saveLocationEdit} onCancel={cancelLocationEdit} />
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-full border border-border p-1.5 text-body transition hover:bg-surface-elevated"
                  aria-label="Cerrar mapa"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="p-3">
              {editingLocation ? (
                editMap("min(70vh, 560px)")
              ) : (
                readOnlyMap("h-[min(70vh,560px)] w-full")
              )}
            </div>
            {hideExactAddress ? (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                {editingLocation
                  ? `Arrastra el pin. El área pública de privacidad es de ~${privacyRadiusM} m.`
                  : `Ubicación aproximada por privacidad (radio ~${privacyRadiusM} m); el pin público no se muestra.`}
              </p>
            ) : editingLocation ? (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                Arrastra el pin para ajustar la ubicación.
                {showStreetView ? " Los cambios se reflejan en ambos mapas." : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

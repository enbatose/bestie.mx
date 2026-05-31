import { useEffect, useState } from "react";
import { Maximize2, Pencil, X } from "lucide-react";
import { GoogleStreetViewPane } from "@/components/listing/GoogleStreetViewPane";
import { WizardLocationMap, PREVIEW_APPROXIMATE_RADIUS_M } from "@/components/WizardLocationMap";
import { PropertyMap } from "@/components/map/PropertyMap";
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
  onSaveCoordinates: (lat: number, lng: number) => void;
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
  onSaveCoordinates,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftPosition, setDraftPosition] = useState<[number, number]>([listing.lat, listing.lng]);
  const hideExactAddress = isApproximateLocation || Boolean(listing.isApproximateLocation);
  const streetViewPov = streetViewPovProp ?? listing.streetViewPov;
  const showStreetView =
    !hideExactAddress && (useCustomMapPin === true || Boolean(streetViewPov));
  const gridClass = showStreetView ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4";

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
    approximateRadiusMeters: hideExactAddress ? PREVIEW_APPROXIMATE_RADIUS_M : PREVIEW_EDIT_RADIUS_M,
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
      defaultCenter={[listing.lat, listing.lng]}
      defaultZoom={PREVIEW_LOCATION_MAP_ZOOM}
      preferDefaultView
      approximateAsCircle={hideExactAddress}
      approximateCircleRadiusM={PREVIEW_APPROXIMATE_RADIUS_M}
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

      {!editingLocation ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          Ampliar mapa
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className={gridClass}>
        <div className={showStreetView ? "" : "col-span-full"}>{mapPane("h-[260px] md:h-[320px]", 220)}</div>
        {showStreetView ? (
          <GoogleStreetViewPane
            key={`${streetViewLat},${streetViewLng},${streetViewPov?.heading ?? ""},${streetViewPov?.pitch ?? ""},${streetViewPov?.zoom ?? ""}`}
            lat={streetViewLat}
            lng={streetViewLng}
            streetViewPov={streetViewPov}
            trackingInterface="listing_preview"
            propertyId={listing.propertyId}
            listingId={listing.id}
            loadEager
          />
        ) : null}
      </div>

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
                  ? `Arrastra el pin dentro del área (~${PREVIEW_APPROXIMATE_RADIUS_M} m). La ubicación pública puede variar por privacidad.`
                  : `Ubicación aproximada por privacidad (radio ~${PREVIEW_APPROXIMATE_RADIUS_M} m); el pin público no se muestra.`}
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

import { useEffect, useState } from "react";
import { Maximize2, Pencil, X } from "lucide-react";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { PropertyMap } from "@/components/map/PropertyMap";
import type { PropertyListing } from "@/types/listing";

/** Zoom de barrio (~5 km de contexto visible en pantallas típicas). */
const PREVIEW_LOCATION_MAP_ZOOM = 13;

type Props = {
  listing: PropertyListing;
  mapCenter: [number, number];
  isApproximateLocation: boolean;
  onSaveCoordinates: (lat: number, lng: number) => void;
};

export function PreviewPropertyLocationMap({
  listing,
  mapCenter,
  isApproximateLocation,
  onSaveCoordinates,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftPosition, setDraftPosition] = useState<[number, number]>([listing.lat, listing.lng]);

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
  };

  const cancelLocationEdit = () => {
    setDraftPosition([listing.lat, listing.lng]);
    setEditingLocation(false);
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
    />
  );

  const mapPanel = (heightClass: string, compact: boolean) => (
    <div className={`relative flex flex-col ${compact ? "min-h-[220px] md:min-h-[280px]" : ""}`}>
      {editingLocation ? (
        <div className={heightClass}>
          <WizardLocationMap
            center={mapCenter}
            position={draftPosition}
            hasDefinedLocation
            locationLabel={null}
            onPositionChange={(lat, lng) => setDraftPosition([lat, lng])}
            showApproximateRadius={isApproximateLocation}
          />
        </div>
      ) : (
        readOnlyMap(heightClass)
      )}

      <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5">
        {editingLocation ? (
          <>
            <button
              type="button"
              onClick={saveLocationEdit}
              className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-fg shadow-sm"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={cancelLocationEdit}
              className="rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm"
            >
              Cancelar
            </button>
          </>
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
      {mapPanel("h-[220px] md:h-full md:min-h-[280px]", true)}

      {expanded && !editingLocation ? (
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
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-body">Ubicación de la propiedad</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full border border-border p-1.5 text-body transition hover:bg-surface-elevated"
                aria-label="Cerrar mapa"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="p-3">{readOnlyMap("h-[min(70vh,560px)] w-full")}</div>
            {isApproximateLocation ? (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                Ubicación aproximada por privacidad; el pin puede variar dentro del área.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

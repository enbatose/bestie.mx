import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, MapPin, Maximize2, Pencil, X } from "lucide-react";
import { GoogleStreetViewPane } from "@/components/listing/GoogleStreetViewPane";
import { StreetViewPovEditor } from "@/components/publish/StreetViewPovEditor";
import { WizardAddressSearch, cityToCode } from "@/components/publish/WizardAddressSearch";
import { streetViewPovCacheKey } from "@/lib/streetView";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { PropertyMap } from "@/components/map/PropertyMap";
import {
  resolveApproximateRadiusMeters,
  clampApproximateRadiusMeters,
  APPROXIMATE_LOCATION_RADIUS_MIN_M,
  APPROXIMATE_LOCATION_RADIUS_MAX_M,
} from "@/lib/approximateLocationRadius";
import { CITY_ANCHOR } from "@/lib/publishWizard/publishCore";
import { streetCityFromNominatim, type NominatimAddress } from "@/lib/nominatimAddress";
import type { PropertyListing, StreetViewPov } from "@/types/listing";

/** Zoom de barrio (~5 km de contexto visible en pantallas típicas). */
const PREVIEW_LOCATION_MAP_ZOOM = 13;

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
  const [mapZoom, setMapZoom] = useState(CITY_ANCHOR.Guadalajara.zoom);
  const [addressFieldText, setAddressFieldText] = useState("");
  const locationSourceRef = useRef<"search" | "map">("map");
  const addressFieldTextRef = useRef(addressFieldText);
  addressFieldTextRef.current = addressFieldText;
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
  const cityLabel = listing.city?.trim() || "Guadalajara";

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
      if (e.key === "Escape") {
        if (editingLocation) return;
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, editingLocation]);

  useEffect(() => {
    if (!editingLocation) return;
    const [lat, lng] = draftPosition;
    const latKey = lat.toFixed(6);
    const lngKey = lng.toFixed(6);
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
              signal: ac.signal,
              headers: { "User-Agent": "bestie.mx-publish-wizard" },
            },
          );
          if (!res.ok) return;
          const data = (await res.json()) as { address?: NominatimAddress };
          if (ac.signal.aborted) return;
          const summary = streetCityFromNominatim(data.address, cityLabel);
          if (locationSourceRef.current === "search" && addressFieldTextRef.current.trim()) return;
          setAddressFieldText(summary);
        } catch {
          /* abort or network */
        }
      })();
    }, 180);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [editingLocation, draftPosition, cityLabel]);

  const beginLocationEdit = (opts?: { privacy?: boolean }) => {
    const privacy = opts?.privacy ?? hideExactAddress;
    locationSourceRef.current = "map";
    setAddressFieldText("");
    setMapZoom(privacy ? PREVIEW_LOCATION_MAP_ZOOM : CITY_ANCHOR.Guadalajara.zoom);
    if (!editingLocation) {
      setDraftPosition([listing.lat, listing.lng]);
    }
    setEditingLocation(true);
  };

  const saveLocationEdit = () => {
    onSaveCoordinates(draftPosition[0], draftPosition[1]);
    setEditingLocation(false);
    setExpanded(false);
  };

  const cancelLocationEdit = () => {
    setDraftPosition([listing.lat, listing.lng]);
    setAddressFieldText("");
    locationSourceRef.current = "map";
    setEditingLocation(false);
    setExpanded(false);
  };

  const streetViewLat = editingLocation ? draftPosition[0] : listing.lat;
  const streetViewLng = editingLocation ? draftPosition[1] : listing.lng;

  const renderAddressSearch = () => (
    <div className="mb-3">
      <WizardAddressSearch
        cityCode={cityToCode(cityLabel)}
        syncAddress={addressFieldText}
        onQueryChange={(query) => {
          if (query.trim()) {
            locationSourceRef.current = "search";
            setAddressFieldText(query);
          } else {
            locationSourceRef.current = "map";
            setAddressFieldText("");
          }
        }}
        onSelect={({ lat, lng, zoom, label }) => {
          locationSourceRef.current = "search";
          setAddressFieldText(label);
          setMapZoom(zoom);
          setDraftPosition([lat, lng]);
        }}
      />
      <p className="mt-2 text-xs text-muted">
        {hideExactAddress
          ? "Mueve el mapa para colocar el área de privacidad. La dirección se completa al mover el mapa."
          : "Escribe tu dirección o mueve el mapa. La dirección se completa sola al colocar el pin."}
      </p>
    </div>
  );

  const editMapProps = {
    center: mapCenter,
    position: draftPosition,
    hasDefinedLocation: true as const,
    locationLabel: null as string | null,
    onPositionChange: (lat: number, lng: number) => {
      locationSourceRef.current = "map";
      setDraftPosition([lat, lng]);
    },
    showApproximateRadius: hideExactAddress,
    approximateRadiusMeters: privacyRadiusM,
    radiusEditable: hideExactAddress,
    embed: true,
    showAddressFooter: false,
    interactionMode: "crosshair" as const,
    zoom: mapZoom,
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

  const locationEditorMap = (mapHeight: number | string) => (
    <WizardLocationMap
      key={`${cityLabel}-${hideExactAddress ? "approx" : "exact"}`}
      {...editMapProps}
      mapHeight={mapHeight}
    />
  );

  const mapPane = (heightClass: string, editHeight: number | string) => (
    <div>
      {editingLocation ? renderAddressSearch() : null}
      <div className="relative">
        {editingLocation ? (
          <div className={heightClass}>{locationEditorMap(editHeight)}</div>
        ) : (
          readOnlyMap(heightClass)
        )}

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
              onClick={beginLocationEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar ubicación
            </button>
          )}
        </div>
      ) : null}
    </div>
    </div>
  );

  const expandedDialog =
    expanded && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mapa ampliado de la propiedad"
            className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55 p-4"
            onClick={() => {
              if (editingLocation) return;
              setExpanded(false);
            }}
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
                  <div>
                    {renderAddressSearch()}
                    {locationEditorMap("min(70vh, 560px)")}
                  </div>
                ) : (
                  readOnlyMap("h-[min(70vh,560px)] w-full")
                )}
              </div>
              {hideExactAddress ? (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">
                  {editingLocation
                    ? `Mueve el mapa para colocar el área. El perímetro público es de ~${privacyRadiusM} m.`
                    : `Ubicación aproximada por privacidad (radio ~${privacyRadiusM} m); el pin público no se muestra.`}
                </p>
              ) : editingLocation ? (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">
                  Mueve el mapa para colocar el pin.
                  {showStreetView ? " Los cambios se reflejan en ambos mapas." : ""}
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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
                beginLocationEdit({ privacy: false });
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

      {hideExactAddress && !editingLocation ? (
        <p className="mt-2 text-xs text-muted">
          Ubicación aproximada por privacidad (radio ~{privacyRadiusM} m); el pin exacto no se muestra.
        </p>
      ) : null}

      {canEdit && onPrivacyChange ? (
        <div className="mt-3 space-y-3">
          <h3 className="text-sm font-bold text-primary border-b border-border pb-1">
            Nivel de privacidad
          </h3>
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
                if (hideExact) {
                  setEditingStreetView(false);
                  beginLocationEdit({ privacy: true });
                }
              }}
            />
            <div>
              <span className="block text-sm font-semibold text-primary">
                Ocultar dirección exacta en el anuncio
              </span>
              <span className="block text-xs text-muted">
                Para proteger tu dirección exacta, el marcador público aparecerá en un punto aleatorio
                dentro del perímetro que elijas en el mapa (entre {APPROXIMATE_LOCATION_RADIUS_MIN_M} y{" "}
                {APPROXIMATE_LOCATION_RADIUS_MAX_M} m).
              </span>
            </div>
          </label>
          {hideExactAddress ? (
            <div className="space-y-3">
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
                  onChange={(e) => {
                    onPrivacyChange({
                      isApproximateLocation: true,
                      approximateRadiusMeters: clampApproximateRadiusMeters(Number(e.target.value)),
                    });
                    if (!editingLocation) beginLocationEdit({ privacy: true });
                  }}
                  className="mt-2 h-2 w-full cursor-pointer accent-secondary"
                  aria-valuemin={APPROXIMATE_LOCATION_RADIUS_MIN_M}
                  aria-valuemax={APPROXIMATE_LOCATION_RADIUS_MAX_M}
                  aria-valuenow={privacyRadiusM}
                  aria-label="Radio de privacidad en metros"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted">
                  <span>{APPROXIMATE_LOCATION_RADIUS_MIN_M} m</span>
                  <span>{APPROXIMATE_LOCATION_RADIUS_MAX_M} m</span>
                </div>
              </div>
              <p className="rounded-lg border border-border bg-surface-elevated p-3 text-xs text-muted">
                El mapa de búsqueda mostrará un pin con una ubicación aleatoria dentro del perímetro de{" "}
                {privacyRadiusM} m. Mueve el mapa para ubicar el área y usa el control de radio para
                ajustar el tamaño del perímetro.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {expandedDialog}
    </>
  );
}

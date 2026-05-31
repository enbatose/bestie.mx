import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { GoogleStreetViewPane } from "@/components/listing/GoogleStreetViewPane";
import { PREVIEW_APPROXIMATE_RADIUS_M } from "@/components/WizardLocationMap";
import { PropertyMap } from "@/components/map/PropertyMap";
import type { PropertyListing } from "@/types/listing";

/** Zoom de barrio (~5 km de contexto visible en pantallas típicas). */
const PUBLIC_LOCATION_MAP_ZOOM = 13;

type Props = {
  listing: PropertyListing;
  isApproximateLocation?: boolean;
};

function ReadOnlyLocationMap({
  listing,
  isApproximateLocation,
  heightClass,
}: {
  listing: PropertyListing;
  isApproximateLocation: boolean;
  heightClass: string;
}) {
  return (
    <PropertyMap
      listings={[listing]}
      selectedId={listing.id}
      onSelect={() => {}}
      embed
      className={`${heightClass} rounded-xl border border-border`}
      defaultCenter={[listing.lat, listing.lng]}
      defaultZoom={PUBLIC_LOCATION_MAP_ZOOM}
      preferDefaultView
      approximateAsCircle={isApproximateLocation}
      approximateCircleRadiusM={PREVIEW_APPROXIMATE_RADIUS_M}
    />
  );
}

export function PublicListingLocationMap({ listing, isApproximateLocation = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hideExactAddress = isApproximateLocation || Boolean(listing.isApproximateLocation);
  const showStreetView = !hideExactAddress;
  const gridClass = showStreetView ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4";

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

  return (
    <>
      <div className={gridClass}>
        <div className={`relative ${showStreetView ? "" : "col-span-full"}`}>
          <ReadOnlyLocationMap
            listing={listing}
            isApproximateLocation={hideExactAddress}
            heightClass="h-[260px] md:h-[320px]"
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-body shadow-sm backdrop-blur-sm transition hover:bg-surface-elevated"
          >
            <Maximize2 className="size-3.5" aria-hidden />
            Ampliar mapa
          </button>
        </div>
        {showStreetView ? (
          <GoogleStreetViewPane
            key={`${listing.lat},${listing.lng},${listing.streetViewPov?.heading ?? ""},${listing.streetViewPov?.pitch ?? ""},${listing.streetViewPov?.zoom ?? ""}`}
            lat={listing.lat}
            lng={listing.lng}
            streetViewPov={listing.streetViewPov}
            trackingInterface="public_listing"
            propertyId={listing.propertyId}
            listingId={listing.id}
            loadEager
          />
        ) : null}
      </div>

      {hideExactAddress ? (
        <p className="mt-2 text-xs text-muted">
          Ubicación aproximada por privacidad (radio ~{PREVIEW_APPROXIMATE_RADIUS_M} m); el pin exacto no se
          muestra.
        </p>
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
            <div className="p-3">
              <ReadOnlyLocationMap
                listing={listing}
                isApproximateLocation={hideExactAddress}
                heightClass="h-[min(70vh,560px)] w-full"
              />
            </div>
            {hideExactAddress ? (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                Ubicación aproximada por privacidad (radio ~{PREVIEW_APPROXIMATE_RADIUS_M} m).
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

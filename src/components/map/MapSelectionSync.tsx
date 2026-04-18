import { useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { PropertyListing } from "@/types/listing";

type Props = {
  selectedId: string | null;
  listings: PropertyListing[];
};

export function MapSelectionSync({ selectedId, listings }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const hit = listings.find((l) => l.id === selectedId);
    if (!hit) return;
    try {
      const el = map.getDiv();
      if (!el.isConnected) return;
      map.panTo({ lat: hit.lat, lng: hit.lng });
      const z = map.getZoom();
      if (z != null && z < 12) map.setZoom(12);
    } catch {
      /* map/markers may be mid-teardown (StrictMode / navigation) */
    }
  }, [listings, map, selectedId]);

  return null;
}
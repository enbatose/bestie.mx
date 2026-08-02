import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { SearchListingCard } from "@/components/search/SearchListingCard";
import { listingCardHref } from "@/lib/listingKeyLabels";
import { listingNavigationState, type SearchReturnContext } from "@/lib/searchReturn";
import { listingMapPosition } from "@/map/listingMapPosition";
import type { PropertyListing } from "@/types/listing";

const CARD_GAP_PX = 8;
const CARD_MAX_WIDTH_PX = 240;
const CARD_EDGE_PADDING_PX = 8;

type Props = {
  hostRef: RefObject<HTMLElement | null>;
  selectedId: string | null;
  listings: PropertyListing[];
  onClose: () => void;
  searchReturn?: SearchReturnContext;
};

export function MapListingPopupOverlay({
  hostRef,
  selectedId,
  listings,
  onClose,
  searchReturn,
}: Props) {
  const map = useMap();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setPoint(null);
      return;
    }

    const update = () => {
      const listing = listings.find((l) => l.id === selectedId);
      if (!listing) {
        setPoint(null);
        return;
      }
      const pt = map.latLngToContainerPoint(listingMapPosition(listing));
      setPoint({ x: pt.x, y: pt.y });
    };

    update();
    map.on("move", update);
    map.on("zoom", update);
    map.on("resize", update);
    window.addEventListener("resize", update);

    return () => {
      map.off("move", update);
      map.off("zoom", update);
      map.off("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [listings, map, selectedId]);

  const host = hostRef.current;
  if (!selectedId || !point || !host) return null;

  const listing = listings.find((l) => l.id === selectedId);
  if (!listing) return null;

  const cardWidth = Math.min(host.clientWidth * 0.84, CARD_MAX_WIDTH_PX);
  const halfCard = cardWidth / 2;
  const clampedX = Math.min(
    Math.max(point.x, halfCard + CARD_EDGE_PADDING_PX),
    host.clientWidth - halfCard - CARD_EDGE_PADDING_PX,
  );

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[1300] overflow-visible">
      <div
        className="pointer-events-auto absolute"
        style={{
          left: clampedX,
          top: point.y - CARD_GAP_PX,
          transform: "translate(-50%, -100%)",
        }}
      >
        <SearchListingCard
          listing={listing}
          variant="popup"
          to={listingCardHref(listing)}
          state={searchReturn ? listingNavigationState(searchReturn) : undefined}
          onClose={onClose}
        />
      </div>
    </div>,
    host,
  );
}

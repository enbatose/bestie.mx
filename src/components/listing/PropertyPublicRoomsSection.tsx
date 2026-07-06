import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ListingPhotoCarousel } from "@/components/listing/ListingPhotoCarousel";
import { ListingPhotoPlaceholder } from "@/components/listing/ListingPhotoPlaceholder";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingTagChips } from "@/components/listing/ListingTagChips";
import { filterRoomScopeTags, sortRoomScopeTags } from "@/lib/listingTags";
import { listingPublicPath } from "@/lib/listingReference";
import {
  isRoomAvailableForRent,
  occupancyStatusLabel,
  roomDisplayName,
} from "@/lib/roomDisplay";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import type { Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Props = {
  rooms: Room[];
  highlightRoomId?: string | null;
  commonAreaUrls: readonly string[];
  failedImageUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
};

export function PropertyPublicRoomsSection({
  rooms,
  highlightRoomId,
  commonAreaUrls,
  failedImageUrls,
  onImageError,
}: Props) {
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightRoomId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightRoomId, rooms.length]);

  const sorted = [...rooms].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {commonAreaUrls.length ? (
        <ListingSection title="Áreas comunes" subtitle="Espacios compartidos de la propiedad.">
          <ListingPhotoCarousel
            urls={commonAreaUrls}
            failedUrls={failedImageUrls}
            onImageError={onImageError}
          />
        </ListingSection>
      ) : null}

      <ListingSection title="Recámaras" subtitle="Cuartos de esta propiedad.">
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((room, index) => {
            const available = isRoomAvailableForRent(room);
            const highlighted = highlightRoomId === room.id;
            const name = roomDisplayName(room, index);
            const photos = (room.imageUrls ?? []).map((u) => apiAbsoluteUrl(u));
            const tags = sortRoomScopeTags(filterRoomScopeTags(room.tags ?? []));

            return (
              <article
                key={room.id}
                id={`property-room-${room.id}`}
                ref={highlighted ? highlightRef : undefined}
                className={`overflow-hidden rounded-2xl border bg-surface shadow-sm transition ${
                  highlighted
                    ? "border-primary ring-2 ring-primary/40 shadow-md"
                    : "border-border"
                }`}
              >
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-body">{name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        available
                          ? "bg-secondary/15 text-primary"
                          : "bg-bg-light text-muted ring-1 ring-border"
                      }`}
                    >
                      {occupancyStatusLabel(available ? "available" : "occupied")}
                    </span>
                  </div>
                  {available ? (
                    <>
                      <p className="mt-2 text-lg font-bold text-primary">{money.format(room.rentMxn)} / mes</p>
                      {photos.length ? (
                        <div className="mt-3">
                          <ListingPhotoCarousel
                            urls={photos}
                            failedUrls={failedImageUrls}
                            onImageError={onImageError}
                          />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <ListingPhotoPlaceholder />
                        </div>
                      )}
                      {room.summary.trim() ? (
                        <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-4">{room.summary}</p>
                      ) : null}
                      {tags.length ? (
                        <div className="mt-3">
                          <ListingTagChips tags={tags} />
                        </div>
                      ) : null}
                      {room.status === "published" ? (
                        <Link
                          to={listingPublicPath(room.id)}
                          className="mt-4 inline-flex w-full justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110"
                        >
                          Ver anuncio de esta recámara
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      Actualmente ocupada
                      {room.occupantAge != null
                        ? ` · ocupante de ${room.occupantAge} años`
                        : ""}
                      .
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </ListingSection>
    </div>
  );
}

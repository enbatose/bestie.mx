import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { ListingKeyLabelsGrid } from "@/components/listing/postExperience/ListingKeyLabelsGrid";
import { ListingPhotoCarousel } from "@/components/listing/ListingPhotoCarousel";
import { SingleRoomHeader } from "@/components/listing/postExperience/ListingPostHeaders";
import { RoomSecondaryTagSections } from "@/components/listing/postExperience/RoomSecondaryTagSections";
import { buildRoomKeyLabels, KEY_LABEL_ROOM_TAG_SLUGS } from "@/lib/listingKeyLabels";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import type { Property, PropertyListing, Room } from "@/types/listing";

type Props = {
  room: Room;
  property: Property;
  listingForHeader: PropertyListing;
  menCount: number;
  womenCount: number;
  shareActions?: ReactNode;
  failedImageUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  onContact: () => void;
  onClose: () => void;
};

export function PropertyRoomDetailModal({
  room,
  property,
  listingForHeader,
  menCount,
  womenCount,
  shareActions,
  failedImageUrls,
  onImageError,
  onContact,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const photos = (room.imageUrls ?? room.photos ?? []).map((url) => apiAbsoluteUrl(url));

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [room.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const headerListing: PropertyListing = {
    ...listingForHeader,
    id: room.id,
    title: room.customName || room.title,
    rentMxn: room.rentMxn,
    depositMxn: room.depositMxn,
    roommateGenderPref: room.roommateGenderPref,
    availableFrom: room.availableFrom,
    roomDimension: room.roomDimension,
    avalRequired: room.avalRequired,
    summary: room.summary,
    tags: room.tags,
    lodgingType: room.lodgingType,
    ageMin: room.ageMin,
    ageMax: room.ageMax,
    neighborhood: property.neighborhood,
    propertyKind: property.propertyKind,
  };

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${room.customName || room.title}`}
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-2 space-y-5">
          <SingleRoomHeader
            listing={headerListing}
            menCount={menCount}
            womenCount={womenCount}
            shareActions={shareActions}
          />

          {photos.length ? (
            <ListingPhotoCarousel urls={photos} failedUrls={failedImageUrls} onImageError={onImageError} />
          ) : null}

          <ListingKeyLabelsGrid items={buildRoomKeyLabels(room)} />

          <div>
            <h4 className="text-sm font-semibold text-muted">Descripción</h4>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-body">{room.summary}</p>
          </div>

          <RoomSecondaryTagSections
            tags={room.tags.filter(
              (tag) => tag !== "servicios-incluidos" && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag),
            )}
          />

          <div className="space-y-3 pt-2">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onContact}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-95"
              >
                <MessageCircle className="size-4" aria-hidden />
                Contactar al anunciante
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}

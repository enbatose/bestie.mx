import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ListingKeyLabelsGrid } from "@/components/listing/postExperience/ListingKeyLabelsGrid";
import { PropertyHeader, SingleRoomHeader } from "@/components/listing/postExperience/ListingPostHeaders";
import { PostExperienceContactSection } from "@/components/listing/postExperience/PostExperienceContactSection";
import { PropertyRoomDetailModal } from "@/components/listing/postExperience/PropertyRoomDetailModal";
import { PropertyRoomsOfferSection } from "@/components/listing/postExperience/PropertyRoomsOfferSection";
import { RoomSecondaryTagSections } from "@/components/listing/postExperience/RoomSecondaryTagSections";
import { ListingPhotoCarousel } from "@/components/listing/ListingPhotoCarousel";
import { ListingPhotoPlaceholder } from "@/components/listing/ListingPhotoPlaceholder";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingShareActions } from "@/components/listing/ListingShareActions";
import { PublicListingLocationMap } from "@/components/listing/PublicListingLocationMap";
import type { AuthMe } from "@/lib/authApi";
import {
  buildPropertyKeyLabels,
  buildSingleRoomKeyLabels,
  KEY_LABEL_ROOM_TAG_SLUGS,
  mergePropertyScopeTagsFromRooms,
} from "@/lib/listingKeyLabels";
import { listingPublicPath, propertyPublicPath } from "@/lib/listingReference";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import type { Property, PropertyListing, PropertyWithRooms, Room } from "@/types/listing";

type ShareProps = {
  shareMsg: string | null;
  onShareListing: () => void;
  isPropertyPost: boolean;
  propertyId: string;
  roomShareLinks: readonly { id: string; label: string }[];
  currentListingId: string;
  onSharePath: (path: string, label: string) => void;
};

type ContactProps = {
  canContact: boolean;
  messagingOn: boolean;
  viewer: AuthMe | null | undefined;
  msgBusy: boolean;
  msgErr: string | null;
  onSendSingle: (message: string) => void;
  onSendProperty: (message: string, roomIds: string[], availableRooms: readonly Room[]) => void;
};

type Props = {
  listing: PropertyListing;
  propertyPack: PropertyWithRooms | null;
  isPropertyPost: boolean;
  galleryUrls: readonly string[];
  propertySummary: string;
  isApproximateLocation: boolean;
  failedImageUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  share: ShareProps;
  contact: ContactProps;
  ownerActions?: ReactNode;
  statusBadge?: ReactNode;
};

const DEFAULT_SINGLE_MESSAGE = "Hola, me interesa este cuarto. ¿Podemos agendar visita entre semana?";
const DEFAULT_PROPERTY_MESSAGE =
  "Hola, me interesa(n) este/los cuarto(s). ¿Podemos agendar visita entre semana?";

function sortRooms(rooms: readonly Room[]): Room[] {
  return [...rooms].sort((a, b) => a.sortOrder - b.sortOrder);
}

function publishedRooms(rooms: readonly Room[]): Room[] {
  return sortRooms(rooms.filter((room) => room.status === "published"));
}

function propertyRoomSharePath(listingRoomId: string, roomId: string): string {
  return `${listingPublicPath(listingRoomId)}?roomId=${encodeURIComponent(roomId)}#property-available-rooms`;
}

export function PublicPostExperienceListing({
  listing,
  propertyPack,
  isPropertyPost,
  galleryUrls,
  propertySummary,
  isApproximateLocation,
  failedImageUrls,
  onImageError,
  share,
  contact,
  ownerActions,
  statusBadge,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [singleMessage, setSingleMessage] = useState(DEFAULT_SINGLE_MESSAGE);
  const [propertyMessage, setPropertyMessage] = useState(DEFAULT_PROPERTY_MESSAGE);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [expandedRoom, setExpandedRoom] = useState<Room | null>(null);

  const property = propertyPack?.property;
  const allRooms = propertyPack ? publishedRooms(propertyPack.rooms) : [];
  const occupiedRooms = allRooms.filter((room) => !isRoomAvailableForRent(room));
  const availableRooms = allRooms.filter((room) => isRoomAvailableForRent(room));
  const propertyTags = useMemo(() => mergePropertyScopeTagsFromRooms(allRooms), [allRooms]);

  const menCount = property?.occupiedByMenCount ?? 0;
  const womenCount = property?.occupiedByWomenCount ?? 0;

  const shareActions = (
    <ListingShareActions
      shareMsg={share.shareMsg}
      onShareListing={share.onShareListing}
      isPropertyPost={share.isPropertyPost}
      propertyId={share.propertyId}
      roomShareLinks={share.roomShareLinks}
      currentListingId={share.currentListingId}
      onSharePath={share.onSharePath}
    />
  );

  const closeExpandedRoom = useCallback(() => {
    setExpandedRoom(null);
    if (searchParams.get("roomId")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("roomId");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const contactFromExpandedRoom = useCallback(
    (room: Room) => {
      setSelectedRoomIds((prev) => (prev.includes(room.id) ? prev : [...prev, room.id]));
      closeExpandedRoom();
      window.setTimeout(() => {
        document.getElementById("property-contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [closeExpandedRoom],
  );

  useEffect(() => {
    if (!isPropertyPost) return;
    const roomId = searchParams.get("roomId");
    if (!roomId) return;

    const room = availableRooms.find((entry) => entry.id === roomId);
    if (!room) return;

    document.getElementById("property-available-rooms")?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setExpandedRoom(room), 350);
    return () => window.clearTimeout(timer);
  }, [availableRooms, isPropertyPost, searchParams]);

  const photosBlock = galleryUrls.length ? (
    <ListingPhotoCarousel urls={galleryUrls} failedUrls={failedImageUrls} onImageError={onImageError} />
  ) : (
    <ListingPhotoPlaceholder />
  );

  const currentRoomOccupied =
    isPropertyPost &&
    propertyPack &&
    !isRoomAvailableForRent(propertyPack.rooms.find((room) => room.id === listing.id) ?? {});

  if (currentRoomOccupied) {
    return (
      <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        Esta recámara está marcada como ocupada y no se ofrece en renta en este momento.
      </p>
    );
  }

  if (isPropertyPost) {
    if (!property) {
      return (
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          No se pudieron cargar los detalles de la propiedad.
        </p>
      );
    }

    const mapListing: PropertyListing = {
      ...listing,
      title: property.title,
      city: property.city,
      neighborhood: property.neighborhood,
      lat: property.lat,
      lng: property.lng,
      summary: property.summary,
      contactWhatsApp: property.contactWhatsApp,
      propertyKind: property.propertyKind,
      propertyPostMode: "property",
      propertyBedroomsTotal: property.bedroomsTotal,
      propertyBathrooms: property.bathrooms,
      propertyImageUrls: property.commonAreaPhotos ?? property.imageUrls,
      showWhatsApp: property.showWhatsApp,
      isApproximateLocation: property.isApproximateLocation,
      streetViewPov: property.streetViewPov,
    };

    return (
      <section className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {ownerActions ? <div className="flex flex-wrap items-center justify-end gap-2">{ownerActions}</div> : null}
        {statusBadge}

        <PropertyHeader property={property} availableRooms={availableRooms} shareActions={shareActions} />

        <ListingSection title="Fotos">{photosBlock}</ListingSection>

        <ListingKeyLabelsGrid items={buildPropertyKeyLabels(propertyTags, availableRooms)} />

        <ListingSection title="Descripción" titleMuted>
          <p className="text-sm font-semibold leading-relaxed text-body">
            {propertySummary || <span className="italic text-muted">Sin descripción de la propiedad.</span>}
          </p>
        </ListingSection>

        <PropertyRoomsOfferSection
          occupiedRooms={occupiedRooms}
          availableRooms={availableRooms}
          onOpenRoom={setExpandedRoom}
        />

        <ListingSection title="Mapa y Street View">
          <PublicListingLocationMap listing={mapListing} isApproximateLocation={isApproximateLocation} />
        </ListingSection>

        <PostExperienceContactSection
          mode="property"
          canContact={contact.canContact}
          messagingOn={contact.messagingOn}
          viewer={contact.viewer}
          msgBusy={contact.msgBusy}
          msgErr={contact.msgErr}
          message={propertyMessage}
          onMessageChange={setPropertyMessage}
          selectedRoomIds={selectedRoomIds}
          onToggleRoom={(roomId) =>
            setSelectedRoomIds((prev) =>
              prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
            )
          }
          availableRooms={availableRooms}
          onRoomClick={setExpandedRoom}
          onSend={() => contact.onSendProperty(propertyMessage, selectedRoomIds, availableRooms)}
        />

        {expandedRoom ? (
          <PropertyRoomDetailModal
            room={expandedRoom}
            property={property}
            listingForHeader={listing}
            menCount={menCount}
            womenCount={womenCount}
            failedImageUrls={failedImageUrls}
            onImageError={onImageError}
            onContact={() => contactFromExpandedRoom(expandedRoom)}
            onClose={closeExpandedRoom}
            shareActions={
              <ListingShareActions
                shareMsg={share.shareMsg}
                onShareListing={() =>
                  share.onSharePath(
                    propertyRoomSharePath(listing.id, expandedRoom.id),
                    `Link de ${expandedRoom.customName || expandedRoom.title}`,
                  )
                }
                onSharePath={() => {}}
              />
            }
          />
        ) : null}
      </section>
    );
  }

  const singleSecondaryTags = listing.tags.filter((tag) => !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {ownerActions ? <div className="flex flex-wrap items-center justify-end gap-2">{ownerActions}</div> : null}
      {statusBadge}

      <SingleRoomHeader
        listing={listing}
        menCount={menCount}
        womenCount={womenCount}
        shareActions={shareActions}
      />

      <ListingSection title="Fotos">{photosBlock}</ListingSection>

      <ListingKeyLabelsGrid items={buildSingleRoomKeyLabels(listing)} />

      <ListingSection title="Descripción" titleMuted>
        <p className="text-sm font-semibold leading-relaxed text-body">
          {listing.summary.trim() || <span className="italic text-muted">Sin descripción de la recámara.</span>}
        </p>
      </ListingSection>

      <RoomSecondaryTagSections tags={singleSecondaryTags} />

      <ListingSection title="Mapa y Street View">
        <PublicListingLocationMap listing={listing} isApproximateLocation={isApproximateLocation} />
      </ListingSection>

      <PostExperienceContactSection
        mode="single"
        canContact={contact.canContact}
        messagingOn={contact.messagingOn}
        viewer={contact.viewer}
        msgBusy={contact.msgBusy}
        msgErr={contact.msgErr}
        message={singleMessage}
        onMessageChange={setSingleMessage}
        onSend={() => contact.onSendSingle(singleMessage)}
      />
    </section>
  );
}

export function listingSharePath(listing: PropertyListing, isPropertyPost: boolean): string {
  return isPropertyPost ? propertyPublicPath(listing.propertyId) : listingPublicPath(listing.id);
}

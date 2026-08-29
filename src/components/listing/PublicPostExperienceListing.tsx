import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { ReportModal } from "@/components/report/ReportModal";
import { POST_REPORT_CATEGORIES } from "@/lib/reportCategories";
import { reportListing, reportProperty } from "@/lib/reportsApi";
import { propertyReferenceCode, roomReferenceCode } from "@/lib/listingReference";
import { ListingKeyLabelsGrid } from "@/components/listing/postExperience/ListingKeyLabelsGrid";
import { PropertyHeader, SingleRoomHeader } from "@/components/listing/postExperience/ListingPostHeaders";
import { LISTING_HERO_SHELL_CLASS, ListingHeroPhone } from "@/components/listing/PublicListingHeader";
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
import type { PropertyListing, PropertyWithRooms, Room } from "@/types/listing";
import { SearchReturnLink } from "@/components/listing/SearchReturnButtons";
import { MyListingsReturnLink } from "@/components/myListings/MyListingsReturnLink";

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
  /**
   * When set on a property post, open that room's detail modal.
   * Room share URLs (`/anuncio/A…`) pass the room id; property hub (`/propiedad/P…`) passes null.
   */
  focusedRoomId?: string | null;
  galleryUrls: readonly string[];
  propertySummary: string;
  isApproximateLocation: boolean;
  failedImageUrls?: ReadonlySet<string>;
  onImageError?: (url: string) => void;
  share: ShareProps;
  contact: ContactProps;
  ownerActions?: ReactNode;
  statusBadge?: ReactNode;
  /** When set, show inline return-to-search controls (hidden for direct URL visits). */
  searchRestorePath?: string | null;
  /** When set, show return-to-Mis-Anuncios (takes precedence over search return). */
  myListingsRestorePath?: string | null;
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

function ListingTopActions({
  searchRestorePath,
  myListingsRestorePath,
  ownerActions,
}: {
  searchRestorePath?: string | null;
  myListingsRestorePath?: string | null;
  ownerActions?: ReactNode;
}) {
  const returnLink = myListingsRestorePath ? (
    <MyListingsReturnLink to={myListingsRestorePath} placement="top" />
  ) : searchRestorePath ? (
    <SearchReturnLink to={searchRestorePath} placement="top" />
  ) : null;
  if (!returnLink && !ownerActions) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        returnLink && ownerActions ? "justify-between" : returnLink ? "justify-start" : "justify-end"
      }`}
    >
      {returnLink}
      {ownerActions}
    </div>
  );
}

function ListingBottomReturn({
  searchRestorePath,
  myListingsRestorePath,
}: {
  searchRestorePath?: string | null;
  myListingsRestorePath?: string | null;
}) {
  if (myListingsRestorePath) {
    return (
      <div className="flex justify-start pt-1">
        <MyListingsReturnLink to={myListingsRestorePath} placement="bottom" />
      </div>
    );
  }
  if (!searchRestorePath) return null;
  return (
    <div className="flex justify-start pt-1">
      <SearchReturnLink to={searchRestorePath} placement="bottom" />
    </div>
  );
}

export function PublicPostExperienceListing({
  listing,
  propertyPack,
  isPropertyPost,
  focusedRoomId = null,
  galleryUrls,
  propertySummary,
  isApproximateLocation,
  failedImageUrls,
  onImageError,
  share,
  contact,
  ownerActions,
  statusBadge,
  searchRestorePath,
  myListingsRestorePath,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [singleMessage, setSingleMessage] = useState(DEFAULT_SINGLE_MESSAGE);
  const [propertyMessage, setPropertyMessage] = useState(DEFAULT_PROPERTY_MESSAGE);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPhoto, setReportPhoto] = useState<{ index: number; url: string } | null>(null);

  const submitPostReport = useCallback(
    async (input: { categories: string[]; detailText: string }) => {
      const payload = {
        categories: input.categories,
        detailText: input.detailText || undefined,
        photoUrl: reportPhoto?.url,
        photoIndex: reportPhoto?.index,
      };
      if (isPropertyPost && !focusedRoomId) {
        await reportProperty(propertyReferenceCode(share.propertyId), payload);
      } else {
        const roomId = focusedRoomId ?? listing.id;
        await reportListing(roomReferenceCode(roomId), payload);
      }
    },
    [focusedRoomId, isPropertyPost, listing.id, reportPhoto, share.propertyId],
  );

  const onReportPhoto = useCallback((index: number, url: string) => {
    setReportPhoto({ index, url });
    setReportOpen(true);
  }, []);

  const property = propertyPack?.property;
  const allRooms = propertyPack ? publishedRooms(propertyPack.rooms) : [];
  const occupiedRooms = allRooms.filter((room) => !isRoomAvailableForRent(room));
  const availableRooms = allRooms.filter((room) => isRoomAvailableForRent(room));
  const propertyTags = useMemo(() => mergePropertyScopeTagsFromRooms(allRooms), [allRooms]);

  const expandedRoom = useMemo(() => {
    if (!isPropertyPost || !focusedRoomId) return null;
    return availableRooms.find((entry) => entry.id === focusedRoomId) ?? null;
  }, [availableRooms, focusedRoomId, isPropertyPost]);

  const openRoom = useCallback(
    (room: Room) => {
      navigate(listingPublicPath(room.id), { state: location.state });
    },
    [location.state, navigate],
  );

  const closeExpandedRoom = useCallback(() => {
    navigate(propertyPublicPath(share.propertyId), { state: location.state });
  }, [location.state, navigate, share.propertyId]);

  const menCount = property?.occupiedByMenCount ?? 0;
  const womenCount = property?.occupiedByWomenCount ?? 0;

  /** Anyone can report — including the publisher (useful for QA; admins can dismiss false reports). */
  const reportButton = (
    <button
      type="button"
      onClick={() => {
        setReportPhoto(null);
        setReportOpen(true);
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-error/30 bg-surface px-3.5 py-2 text-sm font-semibold text-error hover:bg-error/5"
    >
      <Flag className="size-4 shrink-0" aria-hidden />
      Reportar anuncio
    </button>
  );

  /** Keep share in the header; report sits in its own row so it is not clipped by max-w-[45%]. */
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

  const reportRow = reportButton;

  const reportModal = (
    <ReportModal
      open={reportOpen}
      title={reportPhoto ? "Reportar foto" : "Reportar anuncio"}
      categories={POST_REPORT_CATEGORIES}
      onClose={() => {
        setReportOpen(false);
        setReportPhoto(null);
      }}
      onSubmit={submitPostReport}
    />
  );

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

  useLayoutEffect(() => {
    if (!isPropertyPost || !focusedRoomId) return;
    document.getElementById("property-available-rooms")?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [focusedRoomId, isPropertyPost]);

  const scrollToPropertyPostTop = useCallback(() => {
    document.getElementById("property-post-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const photosBlock = galleryUrls.length ? (
    <ListingPhotoCarousel
      urls={galleryUrls}
      failedUrls={failedImageUrls}
      onImageError={onImageError}
      onReportPhoto={onReportPhoto}
    />
  ) : (
    <ListingPhotoPlaceholder />
  );

  const currentRoomOccupied =
    isPropertyPost &&
    focusedRoomId &&
    propertyPack &&
    !isRoomAvailableForRent(propertyPack.rooms.find((room) => room.id === focusedRoomId) ?? {});

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
      ...(property.approximateRadiusMeters != null
        ? { approximateRadiusMeters: property.approximateRadiusMeters }
        : {}),
      streetViewPov: property.streetViewPov,
    };

    return (
      <div id="property-post-top" className="scroll-mt-24 space-y-6">
        <header className={LISTING_HERO_SHELL_CLASS}>
          <ListingTopActions
            searchRestorePath={searchRestorePath}
            myListingsRestorePath={myListingsRestorePath}
            ownerActions={ownerActions}
          />
          {statusBadge ? <div className="mt-3">{statusBadge}</div> : null}

          <div className="mt-3">
            <PropertyHeader
              property={property}
              availableRooms={availableRooms}
              shareActions={shareActions}
              tags={propertyTags}
              phone={<ListingHeroPhone listing={listing} viewer={contact.viewer} />}
              reportActions={reportRow}
            />
          </div>
        </header>

        <section className="space-y-6 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
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
          onOpenRoom={openRoom}
          onViewPropertyDetails={scrollToPropertyPostTop}
        />

        <ListingSection title="Mapa y Street View">
          <PublicListingLocationMap listing={mapListing} isApproximateLocation={isApproximateLocation} />
        </ListingSection>

        <PostExperienceContactSection
          mode="property"
          canContact={contact.canContact}
          messagingOn={contact.messagingOn}
          viewer={contact.viewer}
          listingId={listing.id}
          propertyId={share.propertyId}
          hasContactPhone={false}
          hideWhenUnavailable={Boolean(listing.claimPreview || listing.contactDisabled)}
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
          onRoomClick={openRoom}
          onSend={() => contact.onSendProperty(propertyMessage, selectedRoomIds, availableRooms)}
        />

        <ListingBottomReturn
          searchRestorePath={searchRestorePath}
          myListingsRestorePath={myListingsRestorePath}
        />
        </section>

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
            viewerIsOwner={Boolean(listing.viewerIsOwner)}
            onReportPhoto={onReportPhoto}
            reportActions={reportRow}
            shareActions={
              <ListingShareActions
                shareMsg={share.shareMsg}
                onShareListing={() =>
                  share.onSharePath(
                    listingPublicPath(expandedRoom.id),
                    `Link de ${expandedRoom.customName || expandedRoom.title}`,
                  )
                }
                onSharePath={() => {}}
              />
            }
          />
        ) : null}
        {reportModal}
      </div>
    );
  }

  const singleSecondaryTags = listing.tags.filter((tag) => !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));

  return (
    <div className="space-y-6">
      <header className={LISTING_HERO_SHELL_CLASS}>
        <ListingTopActions
          searchRestorePath={searchRestorePath}
          myListingsRestorePath={myListingsRestorePath}
          ownerActions={ownerActions}
        />
        {statusBadge ? <div className="mt-3">{statusBadge}</div> : null}
        <div className="mt-3">
          <SingleRoomHeader
            listing={listing}
            menCount={menCount}
            womenCount={womenCount}
            shareActions={shareActions}
            phone={<ListingHeroPhone listing={listing} viewer={contact.viewer} />}
            reportActions={reportRow}
          />
        </div>
      </header>

      <section className="space-y-6 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
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
          listingId={listing.id}
          propertyId={listing.propertyId}
          hasContactPhone={false}
          hideWhenUnavailable={Boolean(listing.claimPreview || listing.contactDisabled)}
          msgBusy={contact.msgBusy}
          msgErr={contact.msgErr}
          message={singleMessage}
          onMessageChange={setSingleMessage}
          onSend={() => contact.onSendSingle(singleMessage)}
        />

        <ListingBottomReturn
          searchRestorePath={searchRestorePath}
          myListingsRestorePath={myListingsRestorePath}
        />
      </section>
      {reportModal}
    </div>
  );
}

export function listingSharePath(listing: PropertyListing, isPropertyPost: boolean): string {
  return isPropertyPost ? propertyPublicPath(listing.propertyId) : listingPublicPath(listing.id);
}

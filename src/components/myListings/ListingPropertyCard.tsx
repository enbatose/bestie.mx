import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Eye, Pencil, Share2, Trash2 } from "lucide-react";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { MissingFieldsCallout } from "@/components/myListings/MissingFieldsCallout";
import {
  CardAction,
  CardActionGroup,
  CardHeader,
  CardOnOffToggle,
  cardShellClass,
  ListingTypeBadge,
  PhotoWithReference,
  RoomOccupancyBadge,
  RoomOnOffToggle,
  type CardActionItem,
  type CardTone,
} from "@/components/myListings/listingCardChrome";
import {
  formatAvailableFrom,
  formatRentMxn,
  listingThumbSrc,
} from "@/components/myListings/listingFormat";
import { PublisherMetricChips } from "@/components/myListings/PublisherMetricChips";
import { ShareAiCopyModal } from "@/components/share/ShareAiCopyModal";
import {
  listingPublicPath,
  propertyPublicPath,
  propertyReferenceCode,
  publishWizardEditPath,
  roomReferenceCode,
} from "@/lib/listingReference";
import { messagesInboxPath, messagesInboxSearchQuery } from "@/lib/messagesApi";
import {
  myListingsNavigationState,
  myListingsPropertyDomId,
  myListingsReturnFromLocation,
} from "@/lib/myListingsReturn";
import type { ListingStatus, PropertyListing } from "@/types/listing";

export type ListingPropertyCardProps = {
  propertyId: string;
  head: PropertyListing;
  list: PropertyListing[];
  propSt: ListingStatus;
  roomTitle: (l: PropertyListing) => string;
  propertyBusy: boolean;
  rowBusy: (l: PropertyListing) => boolean;
  /** Draft-only completeness summary, already `·`-joined. */
  missingFields?: string;
  localError?: string;
  legalChecked: boolean;
  onLegalChange: (next: boolean) => void;
  onPublishDraft: () => void;
  /** Single-room cards: On = publicado, Off = pausado. */
  onSingleRoomActive: (next: boolean) => void;
  /** Property cards: Off asks for confirmation, then marks every available room occupied. */
  onPropertyActive: (next: boolean) => void;
  onPropertyStatus: (status: Extract<ListingStatus, "published" | "paused">) => void;
  onArchiveProperty: () => void;
  onRoomOccupancy: (l: PropertyListing, available: boolean) => void;
  /** Restore an archived room to published (property-room rows only). */
  onRestoreRoom: (l: PropertyListing) => void;
  onArchiveRoom: (l: PropertyListing) => void;
  defaultRoomsOpen?: boolean;
};

function isAvailable(l: PropertyListing): boolean {
  return (l.roomOccupancyStatus ?? "available") === "available";
}

export function ListingPropertyCard({
  propertyId,
  head,
  list,
  propSt,
  roomTitle,
  propertyBusy,
  rowBusy,
  missingFields,
  localError,
  legalChecked,
  onLegalChange,
  onPublishDraft,
  onSingleRoomActive,
  onPropertyActive,
  onPropertyStatus,
  onArchiveProperty,
  onRoomOccupancy,
  onRestoreRoom,
  onArchiveRoom,
  defaultRoomsOpen = false,
}: ListingPropertyCardProps) {
  const location = useLocation();
  const returnState = myListingsNavigationState(
    myListingsReturnFromLocation(location.pathname, location.search),
  );
  const isProperty = head.propertyPostMode === "property";
  const tone: CardTone = isProperty ? "property" : "room";
  const [roomsOpen, setRoomsOpen] = useState(defaultRoomsOpen);
  const [shareOpen, setShareOpen] = useState<{
    scope: "property" | "room";
    propertyId: string | null;
    roomId: string | null;
    title: string;
  } | null>(null);

  const first = list[0]!;
  const availableCount = list.filter(isAvailable).length;
  const propRef = propertyReferenceCode(propertyId);

  // For a property post, "Ver" opens the property hub URL (`/propiedad/P…`).
  const editPath = publishWizardEditPath(propertyId);
  // Property posts share/open via `/propiedad/…` so social scrapers get property-level OG
  // (cover, price range, room count). Room posts use `/anuncio/…`.
  const publicPath = isProperty
    ? propertyPublicPath(propertyId)
    : listingPublicPath(first.id);
  const viewPath = publicPath;
  const canEdit = propSt === "draft" || propSt === "published" || propSt === "paused";
  const canShare = propSt === "published";
  const canArchive = propSt === "draft" || propSt === "published" || propSt === "paused";

  // The header switch always tracks publication. For property posts, pausing also
  // marks every available room as occupied after the user confirms the room list.
  const active = propSt === "published";
  const toggleDisabled = propSt === "draft" || propSt === "archived" || propertyBusy;

  const summedViews = list.reduce((n, l) => n + (l.viewsCount ?? 0), 0);
  const summedInquiries = list.reduce((n, l) => n + (l.inquiryCount ?? 0), 0);

  function openShare(opts: {
    scope: "property" | "room";
    propertyId?: string | null;
    roomId?: string | null;
    title: string;
  }) {
    setShareOpen({
      scope: opts.scope,
      propertyId: opts.propertyId ?? null,
      roomId: opts.roomId ?? null,
      title: opts.title,
    });
  }

  const cardActions: CardActionItem[] = [
    {
      key: "view",
      label: propSt === "published" ? "Ver" : "Vista previa",
      to: viewPath,
      state: returnState,
      icon: <Eye className="size-4 shrink-0" aria-hidden />,
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            label: "Editar",
            to: editPath,
            state: returnState,
            icon: <Pencil className="size-4 shrink-0" aria-hidden />,
          } satisfies CardActionItem,
        ]
      : []),
    ...(canShare
      ? [
          {
            key: "share",
            label: "Compartir",
            onClick: () =>
              void openShare({
                scope: isProperty ? "property" : "room",
                propertyId: isProperty ? propertyId : null,
                roomId: isProperty ? null : first.id,
                title: head.propertyTitle ?? head.title,
              }),
            icon: <Share2 className="size-4 shrink-0" aria-hidden />,
          } satisfies CardActionItem,
        ]
      : []),
    ...(canArchive
      ? [
          {
            key: "archive",
            label: "Archivar",
            disabled: propertyBusy,
            onClick: onArchiveProperty,
            icon: <Trash2 className="size-4 shrink-0" aria-hidden />,
          } satisfies CardActionItem,
        ]
      : []),
    ...(propSt === "archived"
      ? [
          {
            key: "restore",
            label: "Restaurar",
            disabled: propertyBusy,
            onClick: () =>
              isProperty ? onPropertyActive(true) : onPropertyStatus("published"),
          } satisfies CardActionItem,
        ]
      : []),
  ];

  return (
    <section
      id={myListingsPropertyDomId(propertyId)}
      aria-labelledby={`prop-heading-${propertyId}`}
      className={`${cardShellClass(tone)} scroll-mt-14 transition ${active || propSt === "draft" ? "" : "opacity-75"}`}
    >
      <div className="flex flex-col gap-3 p-4">
        <CardHeader
          badges={
            <>
              <ListingStatusBadge
                status={propSt}
                noun={isProperty ? "property" : "room"}
                className="min-h-8 items-center"
              />
              <ListingTypeBadge tone={tone} />
            </>
          }
          toggle={
            <CardOnOffToggle
              tone={tone}
              active={active}
              busy={propertyBusy}
              disabled={toggleDisabled}
              onChange={isProperty ? onPropertyActive : onSingleRoomActive}
              onLabel={
                isProperty
                  ? "Propiedad publicada — tocar para pausar y marcar sus recámaras como ocupadas"
                  : "Anuncio publicado — tocar para pausar"
              }
              offLabel={
                isProperty
                  ? "Propiedad pausada — tocar para publicar y ofrecer recámaras en renta"
                  : "Anuncio pausado — tocar para publicar"
              }
            />
          }
          title={head.propertyTitle ?? head.title}
          place={`${head.neighborhood} · ${head.city}`}
          photo={
            <PhotoWithReference
              src={
                isProperty
                  ? (head.propertyImageUrls?.[0] ?? listingThumbSrc(first))
                  : listingThumbSrc(first)
              }
              code={propRef}
              badge={
                isProperty ? (
                  <span className="absolute -bottom-1 -left-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
                    {list.length}
                  </span>
                ) : undefined
              }
            />
          }
          details={
            isProperty ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-body">
                <span className="font-semibold">
                  {list.length} recámara{list.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted">
                  · {availableCount} disponible{availableCount === 1 ? "" : "s"}
                </span>
                <PublisherMetricChips
                  summed
                  viewsCount={summedViews}
                  inquiryCount={summedInquiries}
                  messagesTo={messagesInboxPath({
                    q: messagesInboxSearchQuery(
                      head.propertyTitle ?? head.title,
                      propertyReferenceCode(propertyId),
                    ),
                  })}
                  messagesState={returnState}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {formatRentMxn(first.rentMxn) ? (
                  <span className="text-sm font-semibold text-body">
                    {formatRentMxn(first.rentMxn)}
                  </span>
                ) : null}
                <PublisherMetricChips
                  viewsCount={first.viewsCount}
                  inquiryCount={first.inquiryCount}
                  messagesTo={messagesInboxPath({
                    q: messagesInboxSearchQuery(first.title, roomReferenceCode(first.id)),
                  })}
                  messagesState={returnState}
                />
                {formatAvailableFrom(first.availableFrom) ? (
                  <span className="text-xs text-muted">
                    {formatAvailableFrom(first.availableFrom)}
                  </span>
                ) : null}
              </div>
            )
          }
        />

        {propSt === "draft" && missingFields ? (
          <MissingFieldsCallout fields={missingFields} />
        ) : null}

        {propSt === "draft" ? (
          <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
            <label
              htmlFor={`legal-publish-${propertyId}`}
              className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-body"
            >
              <input
                id={`legal-publish-${propertyId}`}
                type="checkbox"
                checked={legalChecked}
                onChange={(e) => onLegalChange(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
              />
              <span>
                Confirmo que la información es verídica y acepto los{" "}
                <Link
                  to="/legal/terminos"
                  state={returnState}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Términos de uso
                </Link>{" "}
                para publicar.
              </span>
            </label>
            <button
              type="button"
              disabled={propertyBusy}
              aria-busy={propertyBusy || undefined}
              onClick={onPublishDraft}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {propertyBusy ? "Publicando…" : "Publicar"}
            </button>
          </div>
        ) : null}

        {localError ? (
          <p className="text-xs text-error" role="alert">
            {localError}
          </p>
        ) : null}

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <CardActionGroup tone={tone} actions={cardActions} />
          {isProperty ? (
            <div className="ml-auto flex shrink-0 items-center pl-2">
              <CardAction
                tone={tone}
                label="Recámaras"
                emphasizeBorder
                onClick={() => setRoomsOpen((v) => !v)}
                trailingIcon={
                  <ChevronDown
                    className={`size-4 shrink-0 transition ${roomsOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      {isProperty && roomsOpen ? (
        <ul className="divide-y divide-border border-t border-primary/20">
          {list.map((l) => {
            const available = isAvailable(l);
            const roomSt = l.status ?? "published";
            const thumb = l.roomImageUrls?.[0];
            const label = roomTitle(l);
            const busy = rowBusy(l);
            const roomPath = listingPublicPath(l.id);
            const roomActions: CardActionItem[] = [
              {
                key: "view",
                label: "Ver",
                to: roomPath,
                state: returnState,
                icon: <Eye className="size-3.5 shrink-0" aria-hidden />,
              },
              ...(canEdit
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      to: `${editPath}&room=${encodeURIComponent(l.id)}`,
                      state: returnState,
                      icon: <Pencil className="size-3.5 shrink-0" aria-hidden />,
                    } satisfies CardActionItem,
                  ]
                : []),
              ...(available && propSt === "published"
                ? [
                    {
                      key: "share",
                      label: "Compartir",
                      onClick: () =>
                        void openShare({
                          scope: "room",
                          roomId: l.id,
                          title: label,
                        }),
                      icon: <Share2 className="size-3.5 shrink-0" aria-hidden />,
                    } satisfies CardActionItem,
                  ]
                : []),
              ...(roomSt === "archived"
                ? [
                    {
                      key: "restore",
                      label: "Restaurar",
                      disabled: busy,
                      onClick: () => onRestoreRoom(l),
                    } satisfies CardActionItem,
                  ]
                : [
                    {
                      key: "archive",
                      label: "Archivar",
                      disabled: busy || propSt === "archived",
                      onClick: () => onArchiveRoom(l),
                      icon: <Trash2 className="size-3.5 shrink-0" aria-hidden />,
                    } satisfies CardActionItem,
                  ]),
            ];

            return (
              <li key={l.id} className={`px-4 py-3 ${busy ? "opacity-60" : ""}`}>
                {/*
                  Right column leads with the switch: it and the badge row are both h-7 and
                  start at the same y, so the switch centers on the header line. The photo
                  is omitted entirely when the room has no saved images.
                */}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoomOccupancyBadge available={available} />
                      {roomSt === "archived" ? (
                        <ListingStatusBadge status={roomSt} className="min-h-7 items-center" />
                      ) : null}
                      <p className="min-w-0 break-words font-medium leading-snug text-body">
                        {label}
                      </p>
                    </div>
                    {available ? (
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {formatRentMxn(l.rentMxn) ? (
                          <span className="text-xs font-semibold text-body">
                            {formatRentMxn(l.rentMxn)}
                          </span>
                        ) : null}
                        <PublisherMetricChips
                          viewsCount={l.viewsCount}
                          inquiryCount={l.inquiryCount}
                          messagesTo={messagesInboxPath({
                            q: messagesInboxSearchQuery(label, roomReferenceCode(l.id)),
                          })}
                          messagesState={returnState}
                        />
                        {formatAvailableFrom(l.availableFrom) ? (
                          <span className="text-xs text-muted">
                            {formatAvailableFrom(l.availableFrom)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <CardActionGroup tone={tone} size="compact" actions={roomActions} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <RoomOnOffToggle
                      available={available}
                      busy={busy}
                      disabled={propSt === "draft" || propSt === "archived" || roomSt === "archived"}
                      onChange={(next) => onRoomOccupancy(l, next)}
                    />
                    <PhotoWithReference
                      src={thumb}
                      code={roomReferenceCode(l.id)}
                      thumbClassName="size-14 rounded-lg"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ShareAiCopyModal
        open={Boolean(shareOpen)}
        onClose={() => setShareOpen(null)}
        scope={shareOpen?.scope ?? "room"}
        propertyId={shareOpen?.propertyId}
        roomId={shareOpen?.roomId}
        title={shareOpen?.title}
      />
    </section>
  );
}

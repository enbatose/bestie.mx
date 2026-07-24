import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Eye, MoreHorizontal, Pencil, Share2 } from "lucide-react";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { MissingFieldsCallout } from "@/components/myListings/MissingFieldsCallout";
import {
  CardAction,
  CardHeader,
  CardOnOffToggle,
  cardShellClass,
  ListingTypeBadge,
  PhotoWithReference,
  RoomOccupancyBadge,
  RoomOnOffToggle,
  type CardTone,
} from "@/components/myListings/listingCardChrome";
import {
  formatAvailableFrom,
  formatPublisherMetrics,
  formatRentMxn,
  listingThumbSrc,
} from "@/components/myListings/listingFormat";
import { shareListingLink } from "@/components/myListings/shareListing";
import {
  listingPublicPath,
  propertyReferenceCode,
  roomReferenceCode,
} from "@/lib/listingReference";
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
  onRoomStatus: (l: PropertyListing, status: Extract<ListingStatus, "published" | "paused">) => void;
  onArchiveRoom: (l: PropertyListing) => void;
  onShared: (mode: "shared" | "copied") => void;
  onShareFailed: () => void;
  defaultRoomsOpen?: boolean;
};

function isAvailable(l: PropertyListing): boolean {
  return (l.roomOccupancyStatus ?? "available") === "available";
}

/** Small overflow menu for the lifecycle actions that don't fit the card footer. */
function CardMenu({
  label,
  size = "default",
  items,
}: {
  label: string;
  size?: "default" | "compact";
  items: { key: string; label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return null;

  const triggerSize =
    size === "compact"
      ? "min-h-7 min-w-7 rounded-lg"
      : "min-h-11 min-w-11 rounded-full";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center border border-border bg-surface text-body transition hover:bg-surface-elevated ${triggerSize}`}
      >
        <MoreHorizontal className={size === "compact" ? "size-3.5" : "size-4"} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-2 min-w-[13rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition hover:bg-surface-elevated ${
                item.danger ? "text-error" : "text-body"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Unified Mis Anuncios card for both viewports. A single-room post renders as one card
 * with a lime accent; a multi-room property renders with a forest accent plus a rooms
 * accordion where each room carries its own occupancy switch.
 */
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
  onRoomStatus,
  onArchiveRoom,
  onShared,
  onShareFailed,
  defaultRoomsOpen = false,
}: ListingPropertyCardProps) {
  const isProperty = head.propertyPostMode === "property";
  const tone: CardTone = isProperty ? "property" : "room";
  const [roomsOpen, setRoomsOpen] = useState(defaultRoomsOpen);

  const first = list[0]!;
  const availableCount = list.filter(isAvailable).length;
  const occupiedCount = list.length - availableCount;
  const propRef = propertyReferenceCode(propertyId);

  const editPath = `/publicar?edit=${encodeURIComponent(propertyId)}`;
  const publicPath = isProperty
    ? `${listingPublicPath(first.id)}?roomId=${encodeURIComponent(first.id)}`
    : listingPublicPath(first.id);
  const canEdit = propSt === "draft" || propSt === "published" || propSt === "paused";
  const canShare = propSt === "published";

  // The header switch always tracks publication. For property posts, pausing also
  // marks every available room as occupied after the user confirms the room list.
  const active = propSt === "published";
  const toggleDisabled = propSt === "draft" || propSt === "archived" || propertyBusy;

  const summedViews = list.reduce((n, l) => n + (l.viewsCount ?? 0), 0);
  const summedInquiries = list.reduce((n, l) => n + (l.inquiryCount ?? 0), 0);
  const propertyMetrics = formatPublisherMetrics(summedViews, summedInquiries);

  async function share(path: string, title: string) {
    const result = await shareListingLink(path, title);
    if (result === "shared" || result === "copied") onShared(result);
    else if (result === "failed") onShareFailed();
  }

  const propertyMenuItems: { key: string; label: string; onClick: () => void; danger?: boolean }[] =
    [];
  if (propSt === "published") {
    propertyMenuItems.push({
      key: "pause",
      label: isProperty ? "Pausar propiedad" : "Pausar anuncio",
      onClick: () => (isProperty ? onPropertyActive(false) : onPropertyStatus("paused")),
    });
  }
  if (propSt === "paused" || propSt === "archived") {
    propertyMenuItems.push({
      key: "republish",
      label: propSt === "archived" ? "Restaurar" : "Republicar",
      onClick: () =>
        isProperty
          ? onPropertyActive(true)
          : onPropertyStatus("published"),
    });
  }
  if (propSt === "published" || propSt === "paused") {
    propertyMenuItems.push({
      key: "archive",
      label: isProperty ? "Archivar propiedad" : "Archivar anuncio",
      onClick: onArchiveProperty,
      danger: true,
    });
  }

  return (
    <section
      aria-labelledby={`prop-heading-${propertyId}`}
      className={`${cardShellClass(tone)} transition ${active || propSt === "draft" ? "" : "opacity-75"}`}
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
              <>
                <p className="text-sm text-body">
                  <span className="font-semibold">
                    {list.length} recámara{list.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted">
                    {" "}
                    · {availableCount} disponible{availableCount === 1 ? "" : "s"} ·{" "}
                    {occupiedCount} ocupada{occupiedCount === 1 ? "" : "s"}
                  </span>
                </p>
                {propertyMetrics ? (
                  <p className="mt-1 text-xs text-muted">{propertyMetrics} (suma)</p>
                ) : null}
              </>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {formatRentMxn(first.rentMxn) ? (
                  <span className="text-sm font-semibold text-body">
                    {formatRentMxn(first.rentMxn)}
                  </span>
                ) : null}
                {formatPublisherMetrics(first.viewsCount, first.inquiryCount) ? (
                  <span className="text-xs text-muted">
                    {formatPublisherMetrics(first.viewsCount, first.inquiryCount)}
                  </span>
                ) : null}
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

        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <CardAction
            tone={tone}
            label={propSt === "published" ? "Ver" : "Vista previa"}
            to={publicPath}
            icon={<Eye className="size-4 shrink-0" aria-hidden />}
          />
          {canEdit ? (
            <CardAction
              tone={tone}
              label="Editar"
              to={editPath}
              icon={<Pencil className="size-4 shrink-0" aria-hidden />}
            />
          ) : null}
          {canShare ? (
            <CardAction
              tone={tone}
              label="Compartir"
              onClick={() => void share(publicPath, head.propertyTitle ?? head.title)}
              icon={<Share2 className="size-4 shrink-0" aria-hidden />}
            />
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <CardMenu label="Más acciones" items={propertyMenuItems} />
            {isProperty ? (
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
            ) : null}
          </div>
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
            const roomPath = `${listingPublicPath(l.id)}?roomId=${encodeURIComponent(l.id)}`;
            const roomMenuItems: {
              key: string;
              label: string;
              onClick: () => void;
              danger?: boolean;
            }[] = [];
            if (roomSt === "published") {
              roomMenuItems.push({
                key: "pause",
                label: "Pausar recámara",
                onClick: () => onRoomStatus(l, "paused"),
              });
            }
            if (roomSt === "paused" || roomSt === "archived") {
              roomMenuItems.push({
                key: "republish",
                label: roomSt === "archived" ? "Restaurar recámara" : "Republicar recámara",
                onClick: () => onRoomStatus(l, "published"),
              });
            }
            if (roomSt === "published" || roomSt === "paused") {
              roomMenuItems.push({
                key: "archive",
                label: "Archivar recámara",
                onClick: () => onArchiveRoom(l),
                danger: true,
              });
            }

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
                      {roomSt !== propSt ? (
                        <ListingStatusBadge status={roomSt} className="min-h-7 items-center" />
                      ) : null}
                      <p className="min-w-0 break-words font-medium leading-snug text-body">
                        {label}
                      </p>
                    </div>
                    {available ? (
                      <p className="mt-1 text-xs text-muted">
                        {[
                          formatRentMxn(l.rentMxn),
                          formatPublisherMetrics(l.viewsCount, l.inquiryCount),
                          formatAvailableFrom(l.availableFrom),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <CardAction
                        tone={tone}
                        size="compact"
                        label="Ver"
                        to={roomPath}
                        icon={<Eye className="size-3.5 shrink-0" aria-hidden />}
                      />
                      {canEdit ? (
                        <CardAction
                          tone={tone}
                          size="compact"
                          label="Editar"
                          to={`${editPath}&room=${encodeURIComponent(l.id)}`}
                          icon={<Pencil className="size-3.5 shrink-0" aria-hidden />}
                        />
                      ) : null}
                      {roomSt === "published" && propSt === "published" ? (
                        <CardAction
                          tone={tone}
                          size="compact"
                          label="Compartir"
                          onClick={() => void share(roomPath, label)}
                          icon={<Share2 className="size-3.5 shrink-0" aria-hidden />}
                        />
                      ) : null}
                      <CardMenu label={`Más acciones de ${label}`} size="compact" items={roomMenuItems} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <RoomOnOffToggle
                      available={available}
                      busy={busy}
                      disabled={propSt === "draft" || propSt === "archived"}
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
    </section>
  );
}

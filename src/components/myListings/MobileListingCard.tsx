import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Share2 } from "lucide-react";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { ListingThumb } from "@/components/myListings/ListingThumb";
import {
  formatAvailableFrom,
  formatPublisherMetrics,
  formatRentMxn,
  listingThumbSrc,
} from "@/components/myListings/listingFormat";
import { listingPublicPath, roomReferenceCode } from "@/lib/listingReference";
import { occupancyStatusLabel } from "@/lib/roomDisplay";
import type { ListingStatus, PropertyListing } from "@/types/listing";

type Props = {
  listing: PropertyListing;
  head: PropertyListing;
  title: string;
  propertyId: string;
  propSt: ListingStatus;
  acting: boolean;
  onPause: () => void;
  onRepublish: () => void;
  onArchive: () => void;
  onShared?: (mode: "shared" | "copied") => void;
  onShareFailed?: () => void;
  onRestore?: () => void;
};

const actionBtn =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full px-3 py-2 text-sm font-semibold transition disabled:opacity-50";

async function shareListingLink(
  path: string,
  title: string,
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const url = `${window.location.origin}${path}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // fall through
  }
  return "failed";
}

/**
 * Mobile room/listing card for Mis Anuncios: thumb, rent, metrics, status, primary actions + overflow.
 */
export function MobileListingCard({
  listing: l,
  head,
  title,
  propertyId,
  propSt,
  acting,
  onPause,
  onRepublish,
  onArchive,
  onShared,
  onShareFailed,
  onRestore,
}: Props) {
  const st = l.status ?? "published";
  const roomRef = roomReferenceCode(l.id);
  const rentLabel = formatRentMxn(l.rentMxn);
  const availableLabel = formatAvailableFrom(l.availableFrom);
  const metricsLabel = formatPublisherMetrics(l.viewsCount, l.inquiryCount);
  const meta =
    head.propertyPostMode === "property"
      ? occupancyStatusLabel(l.roomOccupancyStatus ?? "available")
      : l.city;
  const previewPath =
    head.propertyPostMode === "property"
      ? `${listingPublicPath(l.id)}?roomId=${encodeURIComponent(l.id)}`
      : listingPublicPath(l.id);
  const previewLabel = st === "published" && propSt === "published" ? "Ver publicación" : "Vista previa";
  const canEdit = propSt === "draft" || propSt === "published" || propSt === "paused";
  const canArchive = st === "published" || st === "paused";
  const canShare = st === "published" && propSt === "published";
  const canRestore = st === "archived" || propSt === "archived";
  const showOverflow = canEdit || canArchive || canShare || canRestore;
  const hasSecondAction = st === "published" || st === "paused" || (canEdit && st !== "archived");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(ev: MouseEvent) {
      if (!menuRef.current?.contains(ev.target as Node)) closeMenu();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeMenu();
        return;
      }
      if (ev.key === "Tab") {
        closeMenu();
        return;
      }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        const items = [
          ...(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []),
        ];
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next =
          ev.key === "ArrowDown"
            ? items[(idx + 1) % items.length]
            : items[(idx - 1 + items.length) % items.length];
        next?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const firstItem = menuRef.current?.querySelector<HTMLElement>("[role='menuitem']");
    firstItem?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  const gridClass = showOverflow
    ? hasSecondAction
      ? "grid-cols-[1fr_1fr_auto]"
      : "grid-cols-[1fr_auto]"
    : hasSecondAction
      ? "grid-cols-2"
      : "grid-cols-1";

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex gap-3">
        <ListingThumb src={listingThumbSrc(l)} className="size-16" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ListingReferenceChip
              code={roomRef}
              label="Anuncio"
              title={`Referencia del anuncio: ${roomRef}`}
            />
            <ListingStatusBadge status={st} />
          </div>
          <p className="break-words font-medium text-body">{title}</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted">
            {rentLabel ? <span className="text-sm font-semibold text-body">{rentLabel}</span> : null}
            <span>{meta}</span>
          </div>
          {availableLabel ? <p className="text-xs text-muted">{availableLabel}</p> : null}
          {metricsLabel ? <p className="text-xs text-muted">{metricsLabel}</p> : null}
        </div>
      </div>

      <div className={`grid gap-2 ${gridClass}`}>
        {canEdit ? (
          <Link
            to={`/publicar?edit=${encodeURIComponent(propertyId)}&room=${encodeURIComponent(l.id)}`}
            className={`${actionBtn} bg-primary/10 text-primary hover:bg-primary/15`}
          >
            Editar
          </Link>
        ) : (
          <Link
            to={previewPath}
            className={`${actionBtn} border border-border text-body hover:bg-surface-elevated`}
          >
            {previewLabel}
          </Link>
        )}

        {st === "published" ? (
          <button
            type="button"
            disabled={acting}
            aria-busy={acting}
            aria-label={acting ? "Pausando anuncio" : "Pausar anuncio"}
            onClick={onPause}
            className={`${actionBtn} bg-primary/10 text-primary hover:bg-primary/15`}
          >
            {acting ? "Pausando…" : "Pausar"}
          </button>
        ) : st === "paused" ? (
          <button
            type="button"
            disabled={acting}
            aria-busy={acting}
            aria-label={acting ? "Republicando anuncio" : "Republicar anuncio"}
            onClick={onRepublish}
            className={`${actionBtn} border border-border text-body hover:bg-surface-elevated`}
          >
            {acting ? "Republicando…" : "Republicar"}
          </button>
        ) : canEdit ? (
          <Link
            to={previewPath}
            className={`${actionBtn} border border-border text-body hover:bg-surface-elevated`}
          >
            {previewLabel}
          </Link>
        ) : null}

        {showOverflow ? (
          <div className="relative" ref={menuRef}>
            <button
              ref={triggerRef}
              type="button"
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-body transition hover:bg-surface-elevated"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 bottom-full z-10 mb-2 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
              >
                {canEdit ? (
                  <Link
                    role="menuitem"
                    to={previewPath}
                    onClick={closeMenu}
                    className="flex min-h-11 items-center px-4 text-sm font-medium text-body hover:bg-surface-elevated"
                  >
                    {previewLabel}
                  </Link>
                ) : null}
                {canShare ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void shareListingLink(previewPath, title).then((result) => {
                        closeMenu();
                        if (result === "copied" || result === "shared") onShared?.(result);
                        else if (result === "failed") onShareFailed?.();
                      });
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-body hover:bg-surface-elevated"
                  >
                    <Share2 className="size-4 shrink-0" aria-hidden />
                    Compartir enlace
                  </button>
                ) : null}
                {canRestore ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={acting}
                    onClick={() => {
                      closeMenu();
                      onRestore?.();
                    }}
                    className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-body hover:bg-surface-elevated disabled:opacity-50"
                  >
                    Restaurar
                  </button>
                ) : null}
                {canArchive ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={acting}
                    onClick={() => {
                      closeMenu();
                      onArchive();
                    }}
                    className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
                  >
                    Archivar
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

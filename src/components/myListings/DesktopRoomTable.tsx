import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
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
import { occupancyStatusLabel, roomDisplayName } from "@/lib/roomDisplay";
import type { ListingStatus, PropertyListing } from "@/types/listing";

type Props = {
  propertyId: string;
  head: PropertyListing;
  list: PropertyListing[];
  propSt: ListingStatus;
  rowBusy: (l: PropertyListing) => boolean;
  onPause: (id: string) => void;
  onRepublish: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
};

type MenuCoords = {
  top: number;
  right: number;
  openUp: boolean;
};

/**
 * Compact desktop row actions: one primary CTA + overflow menu.
 * Menu is portaled to document.body so it is never clipped by table overflow/thead.
 */
function DesktopRowActions({
  l,
  head,
  propSt,
  propertyId,
  acting,
  st,
  onPause,
  onRepublish,
  onArchive,
  onRestore,
}: {
  l: PropertyListing;
  head: PropertyListing;
  propSt: ListingStatus;
  propertyId: string;
  acting: boolean;
  st: ListingStatus;
  onPause: () => void;
  onRepublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const actionClass =
    "inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";
  const previewPath =
    head.propertyPostMode === "property"
      ? `${listingPublicPath(l.id)}?roomId=${encodeURIComponent(l.id)}`
      : listingPublicPath(l.id);
  const previewLabel = st === "published" && propSt === "published" ? "Ver publicación" : "Vista previa";
  const canEdit = propSt === "draft" || propSt === "published" || propSt === "paused";
  const canArchive = st === "published" || st === "paused";
  const canRestore = st === "archived" || propSt === "archived";

  const [menuOpen, setMenuOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setCoords(null);
    triggerRef.current?.focus();
  }, []);

  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedMenuHeight = 168;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      right: Math.max(8, window.innerWidth - rect.right),
      openUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateCoords();
  }, [menuOpen, updateCoords]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(ev: MouseEvent) {
      const t = ev.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      closeMenu();
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
    function onReposition() {
      updateCoords();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    // Capture scroll from nested overflow-x-auto table wrappers.
    window.addEventListener("scroll", onReposition, true);
    const t = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [menuOpen, closeMenu, updateCoords]);

  const primary =
    canEdit ? (
      <Link
        to={`/publicar?edit=${encodeURIComponent(propertyId)}&room=${encodeURIComponent(l.id)}`}
        className={`${actionClass} bg-primary/10 text-primary hover:bg-primary/15`}
      >
        Editar
      </Link>
    ) : st === "paused" ? (
      <button
        type="button"
        disabled={acting}
        aria-busy={acting}
        onClick={onRepublish}
        className={`${actionClass} border border-border text-body hover:bg-surface-elevated`}
      >
        {acting ? "Republicando…" : "Republicar"}
      </button>
    ) : canRestore ? (
      <button
        type="button"
        disabled={acting}
        aria-busy={acting}
        onClick={onRestore}
        className={`${actionClass} border border-border text-body hover:bg-surface-elevated`}
      >
        {acting ? "Restaurando…" : "Restaurar"}
      </button>
    ) : (
      <Link
        to={previewPath}
        className={`${actionClass} border border-border text-body hover:bg-surface-elevated`}
      >
        {previewLabel}
      </Link>
    );

  // Preview lives in the overflow when the primary CTA is already Edit / Republish / Restaurar.
  const menuHasPreview = canEdit || st === "paused" || canRestore;
  const menuHasPause = st === "published";
  const menuHasRestore = canRestore && canEdit;
  const menuHasArchive = canArchive;
  const showOverflow = menuHasPreview || menuHasPause || menuHasRestore || menuHasArchive || st === "paused";

  const menu =
    menuOpen && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{
              position: "fixed",
              top: coords.openUp ? undefined : coords.top,
              bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
              right: coords.right,
            }}
            className="z-[1850] min-w-[11rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
          >
            {menuHasPreview ? (
              <Link
                role="menuitem"
                to={previewPath}
                onClick={closeMenu}
                className="flex min-h-10 items-center px-4 text-sm font-medium text-body hover:bg-surface-elevated"
              >
                {previewLabel}
              </Link>
            ) : null}
            {menuHasPause ? (
              <button
                type="button"
                role="menuitem"
                disabled={acting}
                onClick={() => {
                  closeMenu();
                  onPause();
                }}
                className="flex min-h-10 w-full items-center px-4 text-left text-sm font-medium text-body hover:bg-surface-elevated disabled:opacity-50"
              >
                {acting ? "Pausando…" : "Pausar"}
              </button>
            ) : null}
            {st === "paused" && canEdit ? (
              <button
                type="button"
                role="menuitem"
                disabled={acting}
                onClick={() => {
                  closeMenu();
                  onRepublish();
                }}
                className="flex min-h-10 w-full items-center px-4 text-left text-sm font-medium text-body hover:bg-surface-elevated disabled:opacity-50"
              >
                {acting ? "Republicando…" : "Republicar"}
              </button>
            ) : null}
            {menuHasRestore ? (
              <button
                type="button"
                role="menuitem"
                disabled={acting}
                onClick={() => {
                  closeMenu();
                  onRestore();
                }}
                className="flex min-h-10 w-full items-center px-4 text-left text-sm font-medium text-body hover:bg-surface-elevated disabled:opacity-50"
              >
                Restaurar
              </button>
            ) : null}
            {menuHasArchive ? (
              <button
                type="button"
                role="menuitem"
                disabled={acting}
                onClick={() => {
                  closeMenu();
                  onArchive();
                }}
                className="flex min-h-10 w-full items-center px-4 text-left text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
              >
                Archivar
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
      {primary}
      {showOverflow ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-border text-body transition hover:bg-surface-elevated"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
          {menu}
        </>
      ) : null}
    </div>
  );
}

const stickyActionHead =
  "sticky right-0 z-20 bg-surface px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.12)]";
const stickyActionCell =
  "sticky right-0 z-10 bg-surface px-3 py-3 text-right align-middle shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.12)] group-hover:bg-surface-elevated group-focus-within:bg-surface-elevated";

/** Desktop room table for a property group on Mis Anuncios. */
export function DesktopRoomTable({
  propertyId,
  head,
  list,
  propSt,
  rowBusy,
  onPause,
  onRepublish,
  onArchive,
  onRestore,
}: Props) {
  const caption = head.propertyTitle ?? head.title;

  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Recámaras de {caption}</caption>
          <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="w-14 px-3 py-3">
                <span className="sr-only">Foto</span>
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3">
                Referencia
              </th>
              <th scope="col" className="min-w-[8rem] px-3 py-3">
                {head.propertyPostMode === "property" ? "Recámara" : "Cuarto / título"}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3">
                Renta
              </th>
              {head.propertyPostMode === "property" ? (
                <th scope="col" className="hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                  Disponibilidad
                </th>
              ) : (
                <th scope="col" className="hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                  Ciudad
                </th>
              )}
              <th scope="col" className="whitespace-nowrap px-3 py-3">
                Estado
              </th>
              <th scope="col" className="hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                Métricas
              </th>
              <th scope="col" className={`${stickyActionHead} whitespace-nowrap`}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-body">
            {list.map((l, roomIdx) => {
              const st = l.status ?? "published";
              const acting = rowBusy(l);
              const roomRef = roomReferenceCode(l.id);
              const title =
                head.propertyPostMode === "property"
                  ? roomDisplayName(
                      { customName: l.roomCustomName, title: l.title },
                      roomIdx,
                    )
                  : l.title;
              const rentLabel = formatRentMxn(l.rentMxn);
              const occupied = l.roomOccupancyStatus === "occupied";
              const availableLabel = formatAvailableFrom(l.availableFrom);
              const metricsLabel = formatPublisherMetrics(l.viewsCount, l.inquiryCount);
              const metricsDisplay =
                metricsLabel ??
                (st === "published" ? "Sin actividad aún" : "—");

              return (
                <tr
                  key={l.id}
                  className="group transition-colors hover:bg-surface-elevated/80 focus-within:bg-surface-elevated/80"
                >
                  <td className="px-3 py-3">
                    <ListingThumb src={listingThumbSrc(l)} className="size-10 rounded-lg" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <ListingReferenceChip
                      code={roomRef}
                      label="Anuncio"
                      title={`Referencia del anuncio: ${roomRef}`}
                      size="compact"
                    />
                  </td>
                  <th scope="row" className="max-w-[10rem] px-3 py-3 text-left font-medium xl:max-w-[14rem]">
                    <p className="truncate" title={title}>
                      {title}
                    </p>
                    {availableLabel ? (
                      <p className="mt-0.5 truncate text-xs font-normal text-muted">{availableLabel}</p>
                    ) : null}
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                    {occupied ? (
                      <span className="text-muted">Ocupada</span>
                    ) : rentLabel ? (
                      <span className="font-semibold text-body">{rentLabel}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-muted xl:table-cell">
                    {head.propertyPostMode === "property"
                      ? occupancyStatusLabel(l.roomOccupancyStatus ?? "available")
                      : l.city}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <ListingStatusBadge status={st} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-muted xl:table-cell">
                    {metricsDisplay}
                  </td>
                  <td className={`w-[1%] whitespace-nowrap ${stickyActionCell}`}>
                    <DesktopRowActions
                      l={l}
                      head={head}
                      propSt={propSt}
                      propertyId={propertyId}
                      acting={acting}
                      st={st}
                      onPause={() => onPause(l.id)}
                      onRepublish={() => onRepublish(l.id)}
                      onArchive={() => onArchive(l.id)}
                      onRestore={() => onRestore(l.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

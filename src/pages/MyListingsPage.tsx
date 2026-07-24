import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Home, RefreshCw, X } from "lucide-react";
import { AppConfirmDialog } from "@/components/AppConfirmDialog";
import { ListingPropertyCard } from "@/components/myListings/ListingPropertyCard";
import {
  RoomActivationModal,
  roomReadyToOffer,
} from "@/components/myListings/RoomActivationModal";
import {
  fetchMyListings,
  patchDraftRoom,
  updateListingStatus,
  updateProperty,
  fetchPropertyWithRooms,
} from "@/lib/listingsApi";
import {
  listingPublicPath,
  MY_LISTINGS_SECTIONS,
  propertyStatusSortKey,
} from "@/lib/listingReference";
import { authLinkPublisher, authMe, type AuthMe } from "@/lib/authApi";
import { track } from "@/lib/analytics";
import { roomDisplayName } from "@/lib/roomDisplay";
import type { ListingStatus, PropertyListing } from "@/types/listing";

type PropertyGroup = { propertyId: string; list: PropertyListing[] };

type FlashMessage = {
  text: string;
  to?: string;
  linkText?: string;
};

type PendingConfirm =
  | { kind: "archive-room"; id: string }
  | { kind: "archive-property"; id: string }
  | { kind: "deactivate-property"; propertyId: string; rooms: PropertyListing[] }
  | null;

function listingRowTitle(head: PropertyListing, l: PropertyListing, list: PropertyListing[]): string {
  if (head.propertyPostMode === "property") {
    return roomDisplayName(
      { customName: l.roomCustomName, title: l.title },
      list.findIndex((x) => x.id === l.id),
    );
  }
  return l.title;
}

function isRoomAvailable(l: PropertyListing): boolean {
  return (l.roomOccupancyStatus ?? "available") === "available";
}

function ListingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando anuncios">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-bg-light">
          <div className="min-h-[12.5rem] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function MyListingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<PropertyListing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionPropertyId, setActionPropertyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [legalPublishByProperty, setLegalPublishByProperty] = useState<Record<string, boolean>>({});
  const [missingByProperty, setMissingByProperty] = useState<Record<string, string>>({});
  const [localErrByProperty, setLocalErrByProperty] = useState<Record<string, string>>({});
  const [me, setMe] = useState<AuthMe | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  /** Room whose rental data must be completed before it can be offered for rent. */
  const [activatingRoom, setActivatingRoom] = useState<PropertyListing | null>(null);

  const computeMissing = useCallback((bundle: Awaited<ReturnType<typeof fetchPropertyWithRooms>>): string[] => {
    if (!bundle) return ["No se pudo leer la propiedad"];
    const m: string[] = [];
    const p = bundle.property;
    const isRoomPost = p.postMode === "room";
    if (!isRoomPost && (!p.title?.trim() || p.title.trim().toLowerCase() === "sin título")) {
      m.push("Nombre de propiedad");
    }
    if (!p.neighborhood?.trim()) m.push("Colonia");
    if (!p.city?.trim()) m.push("Ciudad");
    if (!isRoomPost && (!p.summary?.trim() || p.summary.trim().length < 20)) m.push("Descripción de la propiedad");
    if (!bundle.rooms?.length) m.push("Al menos 1 cuarto");
    for (const [index, r] of (bundle.rooms ?? []).entries()) {
      const roomSuffix = bundle.rooms.length > 1 ? ` ${index + 1}` : "";
      if (r.occupancyStatus === "occupied") {
        if (r.occupantAge == null || r.occupantAge < 18) m.push(`Edad del ocupante${roomSuffix}`);
        continue;
      }
      if (!r.customName?.trim() && !r.title?.trim()) m.push(`Nombre del cuarto${roomSuffix}`);
      if (!r.summary?.trim()) m.push(`Descripción del cuarto${roomSuffix}`);
      if (!Number.isFinite(r.rentMxn) || r.rentMxn <= 0) m.push(`Renta del cuarto${roomSuffix}`);
    }
    return [...new Set(m)];
  }, []);

  const propertyGroups = useMemo((): PropertyGroup[] => {
    if (!rows?.length) return [];
    const m = new Map<string, PropertyListing[]>();
    for (const l of rows) {
      const list = m.get(l.propertyId) ?? [];
      list.push(l);
      m.set(l.propertyId, list);
    }
    return [...m.entries()]
      .map(([propertyId, list]) => ({ propertyId, list }))
      .sort((a, b) => {
        const sa = propertyStatusSortKey(a.list[0]?.propertyStatus);
        const sb = propertyStatusSortKey(b.list[0]?.propertyStatus);
        if (sa !== sb) return sa - sb;
        const ta = a.list[0]?.propertyTitle ?? a.propertyId;
        const tb = b.list[0]?.propertyTitle ?? b.propertyId;
        return ta.localeCompare(tb, "es");
      });
  }, [rows]);

  const sectionsWithGroups = useMemo(
    () =>
      MY_LISTINGS_SECTIONS.map((section) => ({
        ...section,
        groups: propertyGroups.filter(
          (g) => (g.list[0]?.propertyStatus ?? "published") === section.status,
        ),
      })).filter((section) => section.groups.length > 0),
    [propertyGroups],
  );

  const summaryParts = useMemo(() => {
    const counts = { published: 0, draft: 0, paused: 0, archived: 0 };
    for (const g of propertyGroups) {
      const st = g.list[0]?.propertyStatus ?? "published";
      counts[st]++;
    }
    const parts: string[] = [];
    if (counts.published) parts.push(`${counts.published} publicado${counts.published === 1 ? "" : "s"}`);
    if (counts.draft) parts.push(`${counts.draft} borrador${counts.draft === 1 ? "" : "es"}`);
    if (counts.paused) parts.push(`${counts.paused} pausado${counts.paused === 1 ? "" : "s"}`);
    if (counts.archived) parts.push(`${counts.archived} archivado${counts.archived === 1 ? "" : "s"}`);
    return parts;
  }, [propertyGroups]);

  useEffect(() => {
    const st = location.state as { draftSaved?: boolean } | null;
    if (st?.draftSaved) {
      setFlash({ text: "Borrador guardado. Puedes publicarlo cuando esté listo." });
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 8000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const data = await fetchMyListings();
      setRows(data);
      const propIds = [...new Set(data.map((l) => l.propertyId))];
      const draftPropIds = propIds.filter((pid) => {
        const any = data.find((l) => l.propertyId === pid);
        const ps = any?.propertyStatus ?? "published";
        return ps === "draft";
      });
      const nextMissing: Record<string, string> = {};
      for (const pid of draftPropIds) {
        const bundle = await fetchPropertyWithRooms(pid).catch(() => null);
        const missing = computeMissing(bundle);
        if (missing.length) nextMissing[pid] = missing.join(" · ");
      }
      setMissingByProperty(nextMissing);
    } catch {
      setErr("No se pudieron cargar tus anuncios.");
      setRows([]);
      setMissingByProperty({});
    } finally {
      setBusy(false);
    }
  }, [computeMissing]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void authMe()
      .then((user) => {
        setMe(user);
        if (user) void authLinkPublisher().catch(() => undefined);
      })
      .catch(() => setMe(null));
  }, []);

  function setPropertyError(propertyId: string, e: unknown, fallback: string) {
    setLocalErrByProperty((m) => ({
      ...m,
      [propertyId]: e instanceof Error ? e.message : fallback,
    }));
  }

  function clearPropertyError(propertyId: string) {
    setLocalErrByProperty((m) => {
      const next = { ...m };
      delete next[propertyId];
      return next;
    });
  }

  async function setRoomStatus(
    l: PropertyListing,
    status: "published" | "paused" | "archived",
  ) {
    setActionId(l.id);
    setErr(null);
    clearPropertyError(l.propertyId);
    try {
      await updateListingStatus(l.id, status);
      track("my_listing_status_changed", { listing_id: l.id, status });
      await load();
      if (status === "paused") setFlash({ text: "Anuncio pausado. Puedes republicarlo cuando quieras." });
      else if (status === "archived") setFlash({ text: "Anuncio archivado. Lo encuentras en Archivados." });
      else
        setFlash({
          text: "El anuncio ya está publicado.",
          to: listingPublicPath(l.id),
          linkText: "Ver anuncio publicado",
        });
    } catch (e) {
      setPropertyError(l.propertyId, e, "No se pudo actualizar el anuncio.");
    } finally {
      setActionId(null);
      setPendingConfirm(null);
    }
  }

  async function setPropertyStatus(propertyId: string, status: ListingStatus) {
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    const publicListingId = rows?.find((l) => l.propertyId === propertyId)?.id;
    try {
      await updateProperty(propertyId, { status });
      await load();
      if (status === "paused") setFlash({ text: "Propiedad pausada. Puedes republicarla cuando quieras." });
      else if (status === "archived") setFlash({ text: "Propiedad archivada. La encuentras en Archivados." });
      else
        setFlash({
          text: "La propiedad ya está publicada.",
          to: publicListingId ? listingPublicPath(publicListingId) : undefined,
          linkText: "Ver publicación",
        });
    } catch (e) {
      setPropertyError(propertyId, e, "No se pudo actualizar la propiedad.");
    } finally {
      setActionPropertyId(null);
      setPendingConfirm(null);
    }
  }

  /** Flips one room between offered-for-rent and lived-in. */
  async function setRoomAvailability(l: PropertyListing, available: boolean) {
    setActionId(l.id);
    setErr(null);
    clearPropertyError(l.propertyId);
    try {
      await patchDraftRoom(l.propertyId, l.id, {
        occupancyStatus: available ? "available" : "occupied",
      });
      track("my_room_occupancy_changed", {
        listing_id: l.id,
        occupancy: available ? "available" : "occupied",
      });
      await load();
      setFlash({
        text: available
          ? "Recámara marcada como disponible."
          : "Recámara marcada como ocupada. Ya no se ofrece en renta.",
      });
    } catch (e) {
      setPropertyError(l.propertyId, e, "No se pudo actualizar la recámara.");
    } finally {
      setActionId(null);
    }
  }

  /**
   * Turning a room On publishes it for rent, so it must carry complete rental data.
   * Incomplete rooms open the activation form instead of failing server-side.
   */
  function handleRoomOccupancy(l: PropertyListing, available: boolean) {
    if (available && !roomReadyToOffer(l)) {
      setActivatingRoom(l);
      return;
    }
    void setRoomAvailability(l, available);
  }

  /** Marks every currently available room in a property as occupied. */
  async function deactivatePropertyRooms(propertyId: string, roomsToClose: PropertyListing[]) {
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    try {
      for (const room of roomsToClose) {
        await patchDraftRoom(propertyId, room.id, { occupancyStatus: "occupied" });
        track("my_room_occupancy_changed", { listing_id: room.id, occupancy: "occupied" });
      }
      await load();
      setFlash({
        text: `${roomsToClose.length} recámara${
          roomsToClose.length === 1 ? "" : "s"
        } marcada${roomsToClose.length === 1 ? "" : "s"} como ocupada${
          roomsToClose.length === 1 ? "" : "s"
        }.`,
      });
    } catch (e) {
      setPropertyError(propertyId, e, "No se pudieron marcar las recámaras como ocupadas.");
    } finally {
      setActionPropertyId(null);
      setPendingConfirm(null);
    }
  }

  /** Re-offers every occupied room that already has complete rental data. */
  async function activatePropertyRooms(propertyId: string, ready: PropertyListing[]) {
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    try {
      for (const room of ready) {
        await patchDraftRoom(propertyId, room.id, { occupancyStatus: "available" });
        track("my_room_occupancy_changed", { listing_id: room.id, occupancy: "available" });
      }
      await load();
      setFlash({
        text: `${ready.length} recámara${ready.length === 1 ? "" : "s"} disponible${
          ready.length === 1 ? "" : "s"
        } para renta.`,
      });
    } catch (e) {
      setPropertyError(propertyId, e, "No se pudieron activar las recámaras.");
    } finally {
      setActionPropertyId(null);
    }
  }

  /**
   * The property switch reflects room occupancy: On means at least one room is offered
   * for rent. Turning it Off closes every available room, so it always confirms first.
   */
  function handlePropertyActive(propertyId: string, list: PropertyListing[], next: boolean) {
    if (!next) {
      const openRooms = list.filter(isRoomAvailable);
      if (!openRooms.length) return;
      setPendingConfirm({ kind: "deactivate-property", propertyId, rooms: openRooms });
      return;
    }
    const occupied = list.filter((l) => !isRoomAvailable(l));
    const ready = occupied.filter((l) => roomReadyToOffer(l));
    if (ready.length) {
      void activatePropertyRooms(propertyId, ready);
      return;
    }
    // Nothing can be re-offered as-is; collect the missing data for the first room.
    const first = occupied[0];
    if (first) setActivatingRoom(first);
  }

  async function publishDraftProperty(propertyId: string) {
    if (!legalPublishByProperty[propertyId]) {
      setLocalErrByProperty((m) => ({
        ...m,
        [propertyId]: "Marca la confirmación legal antes de publicar.",
      }));
      return;
    }
    if (missingByProperty[propertyId]) {
      setLocalErrByProperty((m) => ({
        ...m,
        [propertyId]: `Completa: ${missingByProperty[propertyId]}`,
      }));
      return;
    }
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    const publicListingId = rows?.find((l) => l.propertyId === propertyId)?.id;
    try {
      await updateProperty(propertyId, { status: "published" });
      await load();
      setLegalPublishByProperty((m) => ({ ...m, [propertyId]: false }));
      setFlash({
        text: "Ya está publicado.",
        to: publicListingId ? listingPublicPath(publicListingId) : undefined,
        linkText: "Ver publicación",
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo publicar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  function rowBusy(l: PropertyListing): boolean {
    return actionId === l.id || actionPropertyId === l.propertyId;
  }

  function confirmPending() {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === "archive-room") {
      const room = rows?.find((r) => r.id === pendingConfirm.id);
      if (room) void setRoomStatus(room, "archived");
      return;
    }
    if (pendingConfirm.kind === "archive-property") {
      void setPropertyStatus(pendingConfirm.id, "archived");
      return;
    }
    void deactivatePropertyRooms(pendingConfirm.propertyId, pendingConfirm.rooms);
  }

  const confirmBusy =
    pendingConfirm?.kind === "archive-room"
      ? actionId === pendingConfirm.id
      : pendingConfirm?.kind === "archive-property"
        ? actionPropertyId === pendingConfirm.id
        : pendingConfirm?.kind === "deactivate-property"
          ? actionPropertyId === pendingConfirm.propertyId
          : false;

  const confirmCopy = (() => {
    if (pendingConfirm?.kind === "deactivate-property") {
      const names = pendingConfirm.rooms
        .map((r) => {
          const list = rows?.filter((x) => x.propertyId === r.propertyId) ?? [];
          const head = list[0] ?? r;
          return listingRowTitle(head, r, list);
        })
        .join(", ");
      return {
        title: "Marcar todas como ocupadas",
        message: `Estas recámaras dejarán de ofrecerse en renta y quedarán como ocupadas: ${names}. Podrás volver a activarlas una por una cuando quieras.`,
        confirmLabel: confirmBusy ? "Aplicando…" : "Marcar como ocupadas",
        intent: "default" as const,
      };
    }
    if (pendingConfirm?.kind === "archive-property") {
      return {
        title: "Archivar propiedad",
        message:
          "La propiedad y sus recámaras dejarán de verse en la búsqueda. Puedes volver a publicarlas cuando quieras.",
        confirmLabel: confirmBusy ? "Archivando…" : "Archivar",
        intent: "danger" as const,
      };
    }
    return {
      title: "Archivar anuncio",
      message:
        "El anuncio ya no será visible en la búsqueda. Puedes volver a publicarlo en cualquier momento.",
      confirmLabel: confirmBusy ? "Archivando…" : "Archivar",
      intent: "danger" as const,
    };
  })();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-10 xl:max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          {me ? (
            <p className="mb-1 text-sm text-muted">
              Hola, <span className="font-semibold text-body">{me.displayName}</span>
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Mis anuncios</h1>
          {summaryParts.length ? (
            <p className="mt-2 text-sm font-medium text-body">{summaryParts.join(" · ")}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {me
                ? "Administra borradores y anuncios activos."
                : "Los borradores se pueden crear sin cuenta. Para publicar necesitas iniciar sesión."}
            </p>
          )}
          {summaryParts.length && !me ? (
            <p className="mt-1 text-xs text-muted sm:hidden">
              Para publicar necesitas iniciar sesión.
            </p>
          ) : null}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Link
            to="/publicar"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 sm:flex-none"
          >
            Publicar anuncio
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            aria-label="Actualizar anuncios"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border text-body transition enabled:hover:bg-surface-elevated disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          </button>
        </div>
      </div>

      {flash ? (
        <div
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[1800] mx-auto flex max-w-4xl items-start gap-3 rounded-xl border border-secondary/40 bg-surface px-4 py-3 text-sm text-body shadow-lg sm:left-6 sm:right-6 lg:bottom-auto lg:left-auto lg:right-6 lg:top-[4.5rem] lg:mx-0 lg:w-full lg:max-w-sm"
          role="status"
        >
          <p className="min-w-0 flex-1">
            {flash.text}
            {flash.to ? (
              <>
                {" "}
                <Link to={flash.to} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {flash.linkText ?? "Ver publicación"}
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setFlash(null)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {err ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-8 space-y-10" aria-busy={busy && rows !== null ? true : undefined}>
        {busy && rows !== null ? (
          <p className="sr-only" aria-live="polite">
            Actualizando anuncios…
          </p>
        ) : null}
        {busy && rows === null ? (
          <ListingsSkeleton />
        ) : rows?.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center shadow-sm">
            <Home className="mx-auto size-8 text-muted" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm font-medium text-body">Aún no tienes anuncios.</p>
            <p className="mt-1 text-sm text-muted">Publica un cuarto y adminístralo aquí.</p>
            <Link
              to="/publicar"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99]"
            >
              Publicar anuncio
            </Link>
          </div>
        ) : (
          sectionsWithGroups.map((section) => {
            const sectionBody = (
              <div className="space-y-6">
                {section.groups.map(({ propertyId, list }) => {
                  const head = list[0]!;
                  const propSt = head.propertyStatus ?? "published";
                  return (
                    <ListingPropertyCard
                      key={propertyId}
                      propertyId={propertyId}
                      head={head}
                      list={list}
                      propSt={propSt}
                      roomTitle={(l) => listingRowTitle(head, l, list)}
                      propertyBusy={actionPropertyId === propertyId}
                      rowBusy={rowBusy}
                      missingFields={missingByProperty[propertyId]}
                      localError={localErrByProperty[propertyId]}
                      legalChecked={Boolean(legalPublishByProperty[propertyId])}
                      onLegalChange={(next) => {
                        setLegalPublishByProperty((m) => ({ ...m, [propertyId]: next }));
                        clearPropertyError(propertyId);
                      }}
                      onPublishDraft={() => void publishDraftProperty(propertyId)}
                      onSingleRoomActive={(next) =>
                        void setPropertyStatus(propertyId, next ? "published" : "paused")
                      }
                      onPropertyActive={(next) => handlePropertyActive(propertyId, list, next)}
                      onPropertyStatus={(status) => void setPropertyStatus(propertyId, status)}
                      onArchiveProperty={() =>
                        setPendingConfirm({ kind: "archive-property", id: propertyId })
                      }
                      onRoomOccupancy={handleRoomOccupancy}
                      onRoomStatus={(l, status) => void setRoomStatus(l, status)}
                      onArchiveRoom={(l) => setPendingConfirm({ kind: "archive-room", id: l.id })}
                      onShared={(mode) =>
                        setFlash({
                          text:
                            mode === "shared"
                              ? "Enlace listo para compartir."
                              : "Enlace del anuncio copiado.",
                        })
                      }
                      onShareFailed={() =>
                        setFlash({ text: "No se pudo copiar el enlace. Intenta de nuevo." })
                      }
                    />
                  );
                })}
              </div>
            );

            if (section.key === "archived") {
              return (
                <details key={section.key} className="group">
                  <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3 marker:content-none [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      className="size-4 shrink-0 text-muted transition group-open:rotate-180"
                      aria-hidden
                    />
                    <h2 className="text-lg font-semibold text-body">{section.title}</h2>
                    <span className="rounded-full bg-bg-light px-2.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-border">
                      {section.groups.length}
                    </span>
                    <span className="text-sm text-muted group-open:hidden">Mostrar</span>
                    <span className="hidden text-sm text-muted group-open:inline">Ocultar</span>
                    <p className="w-full text-sm text-muted">{section.description}</p>
                  </summary>
                  {sectionBody}
                </details>
              );
            }

            return (
              <div key={section.key}>
                <div className="mb-4 border-b border-border pb-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold text-body">{section.title}</h2>
                    <span className="rounded-full bg-bg-light px-2.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-border">
                      {section.groups.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{section.description}</p>
                </div>
                {sectionBody}
              </div>
            );
          })
        )}
      </div>

      {activatingRoom ? (
        <RoomActivationModal
          listing={activatingRoom}
          roomLabel={(() => {
            const list = rows?.filter((x) => x.propertyId === activatingRoom.propertyId) ?? [];
            const head = list[0] ?? activatingRoom;
            return listingRowTitle(head, activatingRoom, list);
          })()}
          onCancel={() => setActivatingRoom(null)}
          onActivated={(message) => {
            setActivatingRoom(null);
            setFlash({ text: message });
            void load();
          }}
        />
      ) : null}

      <AppConfirmDialog
        open={pendingConfirm != null}
        intent={confirmCopy.intent}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        busy={confirmBusy}
        onConfirm={confirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}

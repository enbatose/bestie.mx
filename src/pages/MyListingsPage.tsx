import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, X } from "lucide-react";
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
  propertyStatusSortKey,
} from "@/lib/listingReference";
import {
  buildListingSearchIndex,
  listingMatchesQuery,
  parseMyListingsQuery,
} from "@/lib/myListingsSearch";
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

/** Primary hub tabs — published (includes paused inline), drafts, archived. */
type ListingsTab = "published" | "draft" | "archived";

const PRIMARY_TABS: readonly {
  key: ListingsTab;
  title: string;
}[] = [
  { key: "published", title: "Publicados" },
  { key: "draft", title: "Borradores" },
  { key: "archived", title: "Archivados" },
];

function listingRowTitle(head: PropertyListing, l: PropertyListing, list: PropertyListing[]): string {
  if (head.propertyPostMode === "property") {
    // Use the room's own title (never the concatenated "{property} · {room}"
    // public display title) so every room row reads consistently.
    return roomDisplayName(
      { customName: l.roomCustomName, title: l.roomTitle },
      list.findIndex((x) => x.id === l.id),
    );
  }
  return l.title;
}

function isRoomAvailable(l: PropertyListing): boolean {
  return (l.roomOccupancyStatus ?? "available") === "available";
}

function groupByStatus(groups: readonly PropertyGroup[]): Record<ListingStatus, PropertyGroup[]> {
  const map: Record<ListingStatus, PropertyGroup[]> = {
    published: [],
    draft: [],
    paused: [],
    archived: [],
  };
  for (const g of groups) {
    map[g.list[0]?.propertyStatus ?? "published"].push(g);
  }
  return map;
}

function countByStatus(groups: readonly PropertyGroup[]): Record<ListingStatus, number> {
  const byStatus = groupByStatus(groups);
  return {
    published: byStatus.published.length,
    draft: byStatus.draft.length,
    paused: byStatus.paused.length,
    archived: byStatus.archived.length,
  };
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
  /** Parent to publish after the activation modal makes its first room available. */
  const [activatingPropertyId, setActivatingPropertyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ListingsTab | null>(null);
  const [query, setQuery] = useState("");

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

  const parsedQuery = useMemo(() => parseMyListingsQuery(query), [query]);
  const searching = parsedQuery.terms.length > 0;

  /** One search corpus per property, rebuilt only when the listings change. */
  const searchIndexByProperty = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildListingSearchIndex>>();
    for (const g of propertyGroups) map.set(g.propertyId, buildListingSearchIndex(g.list));
    return map;
  }, [propertyGroups]);

  const matchedGroups = useMemo(() => {
    if (!searching) return propertyGroups;
    return propertyGroups.filter((g) => {
      const index = searchIndexByProperty.get(g.propertyId);
      return index ? listingMatchesQuery(index, parsedQuery) : false;
    });
  }, [propertyGroups, searchIndexByProperty, parsedQuery, searching]);

  const allCounts = useMemo(() => countByStatus(propertyGroups), [propertyGroups]);
  const groupsByStatus = useMemo(() => groupByStatus(matchedGroups), [matchedGroups]);

  const tabCounts = useMemo(
    () => ({
      archived: groupsByStatus.archived.length,
      // Paused stay in Publicados (same sort order); only the card shows paused state.
      published: groupsByStatus.published.length + groupsByStatus.paused.length,
      draft: groupsByStatus.draft.length,
    }),
    [groupsByStatus],
  );

  const matchCount = tabCounts.archived + tabCounts.published + tabCounts.draft;

  const resolvedTab: ListingsTab = activeTab ?? "published";

  const summaryParts = useMemo(() => {
    const counts = allCounts;
    const parts: string[] = [];
    if (counts.published) parts.push(`${counts.published} publicado${counts.published === 1 ? "" : "s"}`);
    if (counts.draft) parts.push(`${counts.draft} borrador${counts.draft === 1 ? "" : "es"}`);
    if (counts.paused) parts.push(`${counts.paused} pausado${counts.paused === 1 ? "" : "s"}`);
    if (counts.archived) parts.push(`${counts.archived} archivado${counts.archived === 1 ? "" : "s"}`);
    return parts;
  }, [allCounts]);

  useEffect(() => {
    const st = location.state as { draftSaved?: boolean } | null;
    if (st?.draftSaved) {
      setActiveTab("draft");
      setFlash({ text: "Borrador guardado. Puedes publicarlo cuando esté listo." });
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  /** Pick a sensible default tab once listings load (prefer publicados, else borradores). */
  useEffect(() => {
    if (activeTab !== null || rows === null) return;
    if (allCounts.published > 0 || allCounts.paused > 0) setActiveTab("published");
    else if (allCounts.draft > 0) setActiveTab("draft");
    else if (allCounts.archived > 0) setActiveTab("archived");
    else setActiveTab("published");
  }, [activeTab, rows, allCounts]);

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
      else if (status === "archived") setFlash({ text: "Recámara archivada." });
      else {
        setActiveTab("published");
        setFlash({
          text: "El anuncio ya está publicado.",
          to: listingPublicPath(l.id),
          linkText: "Ver anuncio publicado",
        });
      }
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
      else if (status === "archived") {
        setActiveTab("archived");
        setFlash({ text: "Propiedad archivada. La encuentras en Archivados." });
      } else {
        setActiveTab("published");
        setFlash({
          text: "La propiedad ya está publicada.",
          to: publicListingId ? listingPublicPath(publicListingId) : undefined,
          linkText: "Ver publicación",
        });
      }
    } catch (e) {
      setPropertyError(propertyId, e, "No se pudo actualizar la propiedad.");
    } finally {
      setActionPropertyId(null);
      setPendingConfirm(null);
    }
  }

  /**
   * Flips one room between offered-for-rent and lived-in. Closing the final
   * available room in a property post also pauses its parent property.
   */
  async function setRoomAvailability(l: PropertyListing, available: boolean) {
    setActionId(l.id);
    setErr(null);
    clearPropertyError(l.propertyId);
    try {
      const propertyRooms = rows?.filter((row) => row.propertyId === l.propertyId) ?? [];
      const closesLastAvailablePropertyRoom =
        !available &&
        l.propertyPostMode === "property" &&
        propertyRooms.filter(isRoomAvailable).length <= 1;
      if (closesLastAvailablePropertyRoom) {
        await updateProperty(l.propertyId, { status: "paused" });
      }
      // Property-room search visibility is occupancy-only; heal any legacy per-room pause
      // so an available room under a published property stays publicly listed.
      if (
        available &&
        l.propertyPostMode === "property" &&
        (l.propertyStatus ?? "published") === "published" &&
        (l.status ?? "published") === "paused"
      ) {
        await updateListingStatus(l.id, "published");
      }
      await patchDraftRoom(l.propertyId, l.id, {
        occupancyStatus: available ? "available" : "occupied",
      });
      track("my_room_occupancy_changed", {
        listing_id: l.id,
        occupancy: available ? "available" : "occupied",
      });
      await load();
      setFlash({
        text: closesLastAvailablePropertyRoom
          ? "Recámara marcada como ocupada y propiedad pausada."
          : available
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
      setActivatingPropertyId(null);
      setActivatingRoom(l);
      return;
    }
    void setRoomAvailability(l, available);
  }

  /** Pauses a property and marks every currently available room as occupied. */
  async function deactivatePropertyRooms(propertyId: string, roomsToClose: PropertyListing[]) {
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    try {
      // Pause first so a partial room-update failure can never leave a published
      // property with zero availability.
      await updateProperty(propertyId, { status: "paused" });
      for (const room of roomsToClose) {
        await patchDraftRoom(propertyId, room.id, { occupancyStatus: "occupied" });
        track("my_room_occupancy_changed", { listing_id: room.id, occupancy: "occupied" });
      }
      await load();
      setFlash({
        text: `Propiedad pausada. ${roomsToClose.length} recámara${
          roomsToClose.length === 1 ? "" : "s"
        } marcada${roomsToClose.length === 1 ? "" : "s"} como ocupada${
          roomsToClose.length === 1 ? "" : "s"
        }.`,
      });
    } catch (e) {
      setPropertyError(
        propertyId,
        e,
        "La propiedad quedó pausada, pero no se pudieron marcar todas las recámaras como ocupadas.",
      );
    } finally {
      setActionPropertyId(null);
      setPendingConfirm(null);
    }
  }

  /** Re-offers complete rooms, then publishes the property. */
  async function activatePropertyRooms(propertyId: string, ready: PropertyListing[]) {
    setActionPropertyId(propertyId);
    setErr(null);
    clearPropertyError(propertyId);
    try {
      for (const room of ready) {
        await patchDraftRoom(propertyId, room.id, { occupancyStatus: "available" });
        track("my_room_occupancy_changed", { listing_id: room.id, occupancy: "available" });
      }
      await updateProperty(propertyId, { status: "published" });
      await load();
      setActiveTab("published");
      setFlash({
        text: `Propiedad publicada. ${ready.length} recámara${ready.length === 1 ? "" : "s"} disponible${
          ready.length === 1 ? "" : "s"
        } para renta.`,
      });
    } catch (e) {
      setPropertyError(propertyId, e, "No se pudo completar la publicación de la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  /**
   * The property switch reflects publication status. Turning it Off pauses the
   * property and marks all available rooms occupied after confirmation. Turning
   * it On republishes only when at least one room can be offered.
   */
  function handlePropertyActive(propertyId: string, list: PropertyListing[], next: boolean) {
    if (!next) {
      const openRooms = list.filter(isRoomAvailable);
      if (!openRooms.length) {
        void setPropertyStatus(propertyId, "paused");
        return;
      }
      setPendingConfirm({ kind: "deactivate-property", propertyId, rooms: openRooms });
      return;
    }
    const alreadyAvailable = list.filter(isRoomAvailable);
    if (alreadyAvailable.length) {
      void setPropertyStatus(propertyId, "published");
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
    if (first) {
      setActivatingPropertyId(propertyId);
      setActivatingRoom(first);
    }
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
      setActiveTab("published");
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
        title: "Pausar propiedad",
        message: `La propiedad se pausará y dejará de aparecer en la búsqueda. Estas recámaras quedarán marcadas como ocupadas: ${names}. Podrás volver a publicar la propiedad cuando quieras.`,
        confirmLabel: confirmBusy ? "Pausando…" : "Pausar y continuar",
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

  function renderPropertyGroups(groups: PropertyGroup[]) {
    return (
      <div className="space-y-6">
        {groups.map(({ propertyId, list }) => {
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
              onRestoreRoom={(l) => void setRoomStatus(l, "published")}
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
  }

  const activeTabMeta = PRIMARY_TABS.find((t) => t.key === resolvedTab)!;
  const otherTabWithMatches = PRIMARY_TABS.find(
    (t) => t.key !== resolvedTab && tabCounts[t.key] > 0,
  );
  const otherTabMatches = otherTabWithMatches ? tabCounts[otherTabWithMatches.key] : 0;
  /** Publicados keeps paused inline (badge/toggle), not a separate subsection. */
  const activeGroups =
    resolvedTab === "published"
      ? matchedGroups.filter((g) => {
          const st = g.list[0]?.propertyStatus ?? "published";
          return st === "published" || st === "paused";
        })
      : groupsByStatus[resolvedTab];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-10 xl:max-w-6xl">
      <div className="min-w-0">
        {me ? (
          <p className="mb-1 text-sm text-muted">
            Hola, <span className="font-semibold text-body">{me.displayName}</span>
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Mis anuncios</h1>
          <Link
            to="/publicar"
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface px-3.5 text-xs font-semibold text-body transition hover:bg-surface-elevated"
          >
            Publicar anuncio
          </Link>
        </div>
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
          <>
            <div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar en mis anuncios"
                  placeholder="Buscar por título, descripción, colonia, ciudad o renta"
                  className="min-h-12 w-full rounded-full border border-border bg-surface pl-11 pr-11 text-sm text-body placeholder:text-muted focus-visible:border-accent [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                    className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-body"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {searching ? (
                <p className="mt-2 text-sm font-medium text-body" role="status" aria-live="polite">
                  {matchCount === 0
                    ? "Sin resultados"
                    : `${matchCount} resultado${matchCount === 1 ? "" : "s"}`}
                  {matchCount > 0
                    ? ` · ${tabCounts.published} en Publicados · ${tabCounts.draft} en Borradores · ${tabCounts.archived} en Archivados`
                    : ""}
                </p>
              ) : null}

              <div
                role="tablist"
                aria-label="Tipo de anuncio"
                className="-mb-px mt-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-border pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {PRIMARY_TABS.map((tab) => {
                  const active = resolvedTab === tab.key;
                  const count = tabCounts[tab.key];
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      id={`mis-anuncios-tab-${tab.key}`}
                      aria-controls={`mis-anuncios-panel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:text-sm ${
                        active
                          ? "border-primary text-primary"
                          : "border-transparent text-muted hover:border-border hover:text-body"
                      }`}
                    >
                      {tab.title}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 sm:px-2 sm:text-xs ${
                          active
                            ? "bg-primary/10 text-primary ring-primary/20"
                            : "bg-bg-light text-muted ring-border"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                role="tabpanel"
                id={`mis-anuncios-panel-${resolvedTab}`}
                aria-labelledby={`mis-anuncios-tab-${resolvedTab}`}
                className="pt-4"
              >
                {activeGroups.length ? (
                  renderPropertyGroups(activeGroups)
                ) : searching ? (
                  <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-body">
                      {otherTabWithMatches
                        ? `Sin coincidencias en ${activeTabMeta.title}.`
                        : `Ningún anuncio coincide con “${query.trim()}”.`}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {otherTabWithMatches
                        ? `Hay ${otherTabMatches} coincidencia${otherTabMatches === 1 ? "" : "s"} en ${otherTabWithMatches.title}.`
                        : "Prueba con la colonia, la ciudad o el monto de renta."}
                    </p>
                    {otherTabWithMatches ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab(otherTabWithMatches.key)}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Ver {otherTabWithMatches.title}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-body">
                      {resolvedTab === "published"
                        ? "No tienes anuncios publicados."
                        : resolvedTab === "draft"
                          ? "No tienes borradores."
                          : "No tienes anuncios archivados."}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {resolvedTab === "published"
                        ? "Publica un borrador o crea un anuncio nuevo."
                        : resolvedTab === "draft"
                          ? "Guarda un anuncio desde Publicar para retomarlo aquí."
                          : "Los anuncios que archives aparecerán en esta pestaña."}
                    </p>
                    {resolvedTab === "archived" && tabCounts.published > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("published")}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Ver publicados
                      </button>
                    ) : resolvedTab === "draft" && tabCounts.published > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("published")}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                      >
                        Ver publicados
                      </button>
                    ) : resolvedTab !== "archived" ? (
                      <Link
                        to="/publicar"
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99]"
                      >
                        Publicar anuncio
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </>
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
          onCancel={() => {
            setActivatingRoom(null);
            setActivatingPropertyId(null);
          }}
          onActivated={(message) => {
            const propertyIdToPublish = activatingPropertyId;
            setActivatingRoom(null);
            setActivatingPropertyId(null);
            if (!propertyIdToPublish) {
              setFlash({ text: message });
              void load();
              return;
            }
            setActionPropertyId(propertyIdToPublish);
            void updateProperty(propertyIdToPublish, { status: "published" })
              .then(async () => {
                setActiveTab("published");
                setFlash({ text: `Propiedad publicada. ${message}` });
                await load();
              })
              .catch((e) => {
                setPropertyError(
                  propertyIdToPublish,
                  e,
                  "La recámara quedó disponible, pero no se pudo publicar la propiedad.",
                );
              })
              .finally(() => setActionPropertyId(null));
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

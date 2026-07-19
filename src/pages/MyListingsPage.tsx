import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Home, RefreshCw, X } from "lucide-react";
import { AppConfirmDialog } from "@/components/AppConfirmDialog";
import { DesktopRoomTable } from "@/components/myListings/DesktopRoomTable";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { MissingFieldsCallout } from "@/components/myListings/MissingFieldsCallout";
import { MobileListingCard } from "@/components/myListings/MobileListingCard";
import {
  fetchMyListings,
  updateListingStatus,
  updateProperty,
  fetchPropertyWithRooms,
} from "@/lib/listingsApi";
import {
  listingPublicPath,
  MY_LISTINGS_SECTIONS,
  propertyReferenceCode,
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

type PendingArchive =
  | { kind: "room"; id: string }
  | { kind: "property"; id: string }
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

const propActionClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";

function ListingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando anuncios">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-bg-light">
          <div className="min-h-[12.5rem] animate-pulse md:hidden" />
          <div className="hidden md:block">
            <div className="h-[4.5rem] animate-pulse border-b border-border bg-surface-elevated/60" />
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((r) => (
                <div key={r} className="h-11 animate-pulse rounded-lg bg-surface-elevated/80" />
              ))}
            </div>
          </div>
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
  const [pendingArchive, setPendingArchive] = useState<PendingArchive>(null);

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

  async function pause(id: string) {
    const propertyId = rows?.find((r) => r.id === id)?.propertyId;
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "paused");
      track("my_listing_status_changed", { listing_id: id, status: "paused" });
      await load();
      setFlash({ text: "Anuncio pausado. Puedes republicarlo cuando quieras." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo pausar.";
      if (propertyId) setLocalErrByProperty((m) => ({ ...m, [propertyId]: msg }));
      else setErr(msg);
    } finally {
      setActionId(null);
    }
  }

  async function republish(id: string) {
    const propertyId = rows?.find((r) => r.id === id)?.propertyId;
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "published");
      track("my_listing_status_changed", { listing_id: id, status: "published" });
      await load();
      setFlash({
        text: "El anuncio ya está publicado.",
        to: listingPublicPath(id),
        linkText: "Ver anuncio publicado",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo republicar.";
      if (propertyId) setLocalErrByProperty((m) => ({ ...m, [propertyId]: msg }));
      else setErr(msg);
    } finally {
      setActionId(null);
    }
  }

  async function archive(id: string) {
    const propertyId = rows?.find((r) => r.id === id)?.propertyId;
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "archived");
      track("my_listing_status_changed", { listing_id: id, status: "archived" });
      await load();
      setFlash({ text: "Anuncio archivado. Lo encuentras en Archivados." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo archivar.";
      if (propertyId) setLocalErrByProperty((m) => ({ ...m, [propertyId]: msg }));
      else setErr(msg);
    } finally {
      setActionId(null);
      setPendingArchive(null);
    }
  }

  async function pauseProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "paused" });
      await load();
      setFlash({ text: "Propiedad pausada. Puedes republicarla cuando quieras." });
    } catch (e) {
      setLocalErrByProperty((m) => ({
        ...m,
        [propertyId]: e instanceof Error ? e.message : "No se pudo pausar la propiedad.",
      }));
    } finally {
      setActionPropertyId(null);
    }
  }

  async function republishProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    const publicListingId = rows?.find((l) => l.propertyId === propertyId)?.id;
    try {
      await updateProperty(propertyId, { status: "published" });
      await load();
      setFlash({
        text: "La propiedad ya está publicada.",
        to: publicListingId ? listingPublicPath(publicListingId) : undefined,
        linkText: "Ver publicación",
      });
    } catch (e) {
      setLocalErrByProperty((m) => ({
        ...m,
        [propertyId]: e instanceof Error ? e.message : "No se pudo republicar la propiedad.",
      }));
    } finally {
      setActionPropertyId(null);
    }
  }

  async function archiveProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "archived" });
      await load();
      setFlash({ text: "Propiedad archivada. La encuentras en Archivados." });
    } catch (e) {
      setLocalErrByProperty((m) => ({
        ...m,
        [propertyId]: e instanceof Error ? e.message : "No se pudo archivar la propiedad.",
      }));
    } finally {
      setActionPropertyId(null);
      setPendingArchive(null);
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
    setLocalErrByProperty((m) => {
      const next = { ...m };
      delete next[propertyId];
      return next;
    });
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

  function confirmPendingArchive() {
    if (!pendingArchive) return;
    if (pendingArchive.kind === "room") void archive(pendingArchive.id);
    else void archiveProperty(pendingArchive.id);
  }

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
                  const propActing = actionPropertyId === propertyId;
                  const propRef = propertyReferenceCode(propertyId);
                  const sectionAccent =
                    section.key === "published"
                      ? "border-l-primary/50"
                      : section.key === "draft"
                        ? "border-l-warning"
                        : section.key === "paused"
                          ? "border-l-primary/30"
                          : "border-l-muted/40";

                  return (
                    <section
                      key={propertyId}
                      aria-labelledby={`prop-heading-${propertyId}`}
                      className={`rounded-2xl border border-border border-l-4 ${sectionAccent} bg-surface shadow-sm`}
                    >
                      <div className="flex flex-col gap-4 border-b border-border bg-surface-elevated px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ListingStatusBadge status={head.propertyStatus} noun="property" />
                            <ListingReferenceChip
                              code={propRef}
                              label="Propiedad"
                              title={`Referencia de propiedad: ${propRef}`}
                            />
                          </div>
                          <h3
                            id={`prop-heading-${propertyId}`}
                            className="mt-2 break-words text-lg font-semibold text-body"
                          >
                            {head.propertyTitle ?? head.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted">
                            {head.neighborhood} · {head.city}
                          </p>
                          {head.propertyPostMode === "property" ? (
                            <p className="mt-1 text-xs text-muted">
                              {list.length} recámara{list.length === 1 ? "" : "s"}
                            </p>
                          ) : null}
                          {propSt === "draft" && missingByProperty[propertyId] ? (
                            <MissingFieldsCallout
                              fields={missingByProperty[propertyId]}
                              className="mt-3"
                            />
                          ) : null}
                          {propSt !== "draft" && localErrByProperty[propertyId] ? (
                            <p className="mt-3 text-xs text-error" role="alert">
                              {localErrByProperty[propertyId]}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[240px] sm:items-stretch">
                          {propSt === "draft" ? (
                            <>
                              <Link
                                to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                                className={`${propActionClass} border border-border bg-surface text-body hover:bg-surface-elevated`}
                              >
                                Editar borrador
                              </Link>
                              <label
                                htmlFor={`legal-publish-${propertyId}`}
                                className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-body"
                              >
                                <input
                                  id={`legal-publish-${propertyId}`}
                                  type="checkbox"
                                  checked={Boolean(legalPublishByProperty[propertyId])}
                                  onChange={(e) => {
                                    setLegalPublishByProperty((m) => ({
                                      ...m,
                                      [propertyId]: e.target.checked,
                                    }));
                                    setLocalErrByProperty((m) => {
                                      const next = { ...m };
                                      delete next[propertyId];
                                      return next;
                                    });
                                  }}
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
                              {localErrByProperty[propertyId] ? (
                                <p className="text-xs text-error" role="alert">
                                  {localErrByProperty[propertyId]}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                disabled={propActing}
                                aria-busy={propActing}
                                onClick={() => void publishDraftProperty(propertyId)}
                                className={`${propActionClass} bg-primary text-primary-fg enabled:hover:brightness-110 active:scale-[0.99]`}
                              >
                                {propActing ? "Publicando…" : "Publicar"}
                              </button>
                            </>
                          ) : null}
                          {propSt === "published" ? (
                            <>
                              <Link
                                to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                                className={`${propActionClass} bg-primary/10 text-primary hover:bg-primary/15`}
                              >
                                Editar anuncio
                              </Link>
                              <Link
                                to={
                                  head.propertyPostMode === "property"
                                    ? `${listingPublicPath(list[0]!.id)}?roomId=${encodeURIComponent(list[0]!.id)}`
                                    : listingPublicPath(list[0]!.id)
                                }
                                className={`${propActionClass} border border-border text-body hover:bg-surface-elevated`}
                              >
                                Ver publicación
                              </Link>
                              <button
                                type="button"
                                disabled={propActing}
                                aria-busy={propActing}
                                onClick={() => void pauseProperty(propertyId)}
                                className={`${propActionClass} border border-border text-body hover:bg-surface-elevated`}
                              >
                                {propActing ? "Pausando…" : "Pausar propiedad"}
                              </button>
                            </>
                          ) : null}
                          {propSt === "paused" ? (
                            <>
                              <Link
                                to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                                className={`${propActionClass} bg-primary/10 text-primary hover:bg-primary/15`}
                              >
                                Editar
                              </Link>
                              <button
                                type="button"
                                disabled={propActing}
                                aria-busy={propActing}
                                onClick={() => void republishProperty(propertyId)}
                                className={`${propActionClass} border border-border text-body hover:bg-surface-elevated`}
                              >
                                {propActing ? "Republicando…" : "Republicar propiedad"}
                              </button>
                            </>
                          ) : null}
                          {propSt === "archived" ? (
                            <button
                              type="button"
                              disabled={propActing}
                              aria-busy={propActing}
                              onClick={() => void republishProperty(propertyId)}
                              className={`${propActionClass} border border-border text-body hover:bg-surface-elevated`}
                            >
                              {propActing ? "Restaurando…" : "Restaurar propiedad"}
                            </button>
                          ) : null}
                          {propSt === "published" || propSt === "paused" ? (
                            <button
                              type="button"
                              disabled={propActing}
                              aria-busy={propActing}
                              onClick={() => setPendingArchive({ kind: "property", id: propertyId })}
                              className={`${propActionClass} border border-border text-muted hover:bg-surface-elevated`}
                            >
                              Archivar propiedad
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <ul className="divide-y divide-border md:hidden">
                        {list.map((l) => (
                          <MobileListingCard
                            key={l.id}
                            listing={l}
                            head={head}
                            title={listingRowTitle(head, l, list)}
                            propertyId={propertyId}
                            propSt={propSt}
                            acting={rowBusy(l)}
                            onPause={() => void pause(l.id)}
                            onRepublish={() => void republish(l.id)}
                            onArchive={() => setPendingArchive({ kind: "room", id: l.id })}
                            onRestore={() => void republish(l.id)}
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
                        ))}
                      </ul>
                      <DesktopRoomTable
                        propertyId={propertyId}
                        head={head}
                        list={list}
                        propSt={propSt}
                        rowBusy={rowBusy}
                        onPause={(id) => void pause(id)}
                        onRepublish={(id) => void republish(id)}
                        onArchive={(id) => setPendingArchive({ kind: "room", id })}
                        onRestore={(id) => void republish(id)}
                      />
                    </section>
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

      <AppConfirmDialog
        open={pendingArchive != null}
        intent="danger"
        title={pendingArchive?.kind === "property" ? "Archivar propiedad" : "Archivar anuncio"}
        message={
          pendingArchive?.kind === "property"
            ? "La propiedad y sus recámaras dejarán de verse en la búsqueda. Puedes volver a publicarlas cuando quieras."
            : "El anuncio ya no será visible en la búsqueda. Puedes volver a publicarlo en cualquier momento."
        }
        confirmLabel={
          pendingArchive &&
          ((pendingArchive.kind === "room" && actionId === pendingArchive.id) ||
            (pendingArchive.kind === "property" && actionPropertyId === pendingArchive.id))
            ? "Archivando…"
            : "Archivar"
        }
        busy={
          pendingArchive?.kind === "room"
            ? actionId === pendingArchive.id
            : pendingArchive?.kind === "property"
              ? actionPropertyId === pendingArchive.id
              : false
        }
        onConfirm={confirmPendingArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  );
}

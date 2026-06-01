import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
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
  roomReferenceCode,
} from "@/lib/listingReference";
import { authLinkPublisher, authMe, type AuthMe } from "@/lib/authApi";
import { isRoomAvailableForRent, occupancyStatusLabel, roomDisplayName } from "@/lib/roomDisplay";
import type { ListingStatus, PropertyListing } from "@/types/listing";

type PropertyGroup = { propertyId: string; list: PropertyListing[] };

type FlashMessage = {
  text: string;
  to?: string;
  linkText?: string;
};

function statusLabel(s: ListingStatus | undefined): string {
  switch (s) {
    case "paused":
      return "Pausado";
    case "archived":
      return "Archivado";
    case "draft":
      return "Borrador";
    default:
      return "Publicado";
  }
}

function propertyStatusLabel(s: ListingStatus | undefined): string {
  switch (s) {
    case "draft":
      return "Borrador";
    case "paused":
      return "Pausada";
    case "archived":
      return "Archivada";
    default:
      return "Publicada";
  }
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
  const [me, setMe] = useState<AuthMe | null>(null);

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
      setFlash({ text: "Borrador guardado en el servidor. Puedes publicarlo cuando esté listo." });
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

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
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "paused");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo pausar.");
    } finally {
      setActionId(null);
    }
  }

  async function republish(id: string) {
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "published");
      await load();
      setFlash({
        text: "El anuncio ya está publicado.",
        to: listingPublicPath(id),
        linkText: "Ver anuncio publicado",
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo republicar.");
    } finally {
      setActionId(null);
    }
  }

  async function archive(id: string) {
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "archived");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo archivar.");
    } finally {
      setActionId(null);
    }
  }

  async function pauseProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "paused" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo pausar la propiedad.");
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
      setErr(e instanceof Error ? e.message : "No se pudo republicar la propiedad.");
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo archivar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  async function publishDraftProperty(propertyId: string) {
    if (!legalPublishByProperty[propertyId]) {
      setErr("Marca la confirmación legal antes de publicar la propiedad.");
      return;
    }
    if (missingByProperty[propertyId]) {
      setErr(`Completa lo siguiente antes de publicar: ${missingByProperty[propertyId]}`);
      return;
    }
    setActionPropertyId(propertyId);
    setErr(null);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {me ? (
            <p className="mb-1 text-sm text-muted">
              Hola, <span className="font-semibold text-body">{me.displayName}</span>
            </p>
          ) : null}
          <h1 className="text-2xl font-bold text-primary">Mis anuncios</h1>
          <p className="mt-2 text-sm text-muted">
            Aquí puedes ver tus borradores y tus anuncios activos. Un borrador puede crearse sin cuenta, pero
            para activarlo y publicarlo necesitas iniciar sesión.
          </p>
          {summaryParts.length ? (
            <p className="mt-2 text-sm font-medium text-body">{summaryParts.join(" · ")}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition enabled:hover:bg-surface-elevated disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      {flash ? (
        <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body">
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
      ) : null}

      {err ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-8 space-y-10">
        {busy && rows === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : rows?.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm">
            Aún no hay anuncios asociados a esta sesión.{" "}
            <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
              Publicar
            </Link>
          </p>
        ) : (
          sectionsWithGroups.map((section) => (
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
                  ? "border-l-amber-400"
                  : section.key === "paused"
                    ? "border-l-slate-300"
                    : "border-l-border";

            return (
              <section
                key={propertyId}
                className={`overflow-hidden rounded-2xl border border-border border-l-4 ${sectionAccent} bg-surface shadow-sm`}
              >
                <div className="flex flex-col gap-4 border-b border-border bg-surface-elevated px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {propertyStatusLabel(head.propertyStatus)}
                      </p>
                      <ListingReferenceChip code={propRef} label="Propiedad" title={`Referencia de propiedad: ${propRef}`} />
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-body">
                      {head.propertyTitle ?? head.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {head.neighborhood} · {head.city}
                    </p>
                    {propSt === "draft" && missingByProperty[propertyId] ? (
                      <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
                        Completa: <span className="font-medium">{missingByProperty[propertyId]}</span>
                      </p>
                    ) : null}
                    {head.propertyPostMode === "property" ? (
                      <ul className="mt-4 space-y-2 rounded-xl border border-border bg-surface px-3 py-3">
                        {list.map((l, roomIdx) => {
                          const occ = l.roomOccupancyStatus ?? "available";
                          const name = roomDisplayName(
                            { customName: l.roomCustomName, title: l.title },
                            roomIdx,
                          );
                          return (
                            <li
                              key={l.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <div className="min-w-0">
                                <span className="font-medium text-body">{name}</span>
                                <span
                                  className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    isRoomAvailableForRent({ occupancyStatus: occ })
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {occupancyStatusLabel(occ)}
                                </span>
                              </div>
                              <Link
                                to={`/publicar?edit=${encodeURIComponent(propertyId)}&room=${encodeURIComponent(l.id)}`}
                                className="shrink-0 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                              >
                                Editar recámara
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[240px] sm:items-stretch">
                    {propSt === "draft" ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                            className="inline-flex flex-1 justify-center rounded-full border border-border bg-surface px-4 py-2 text-center text-sm font-semibold text-body transition hover:bg-surface-elevated sm:flex-none"
                          >
                            Editar borrador
                          </Link>
                        </div>
                        <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-body">
                          <input
                            type="checkbox"
                            checked={Boolean(legalPublishByProperty[propertyId])}
                            onChange={(e) =>
                              setLegalPublishByProperty((m) => ({
                                ...m,
                                [propertyId]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                          />
                          <span>Confirmo que la información es verídica y acepto publicar.</span>
                        </label>
                        <button
                          type="button"
                          disabled={propActing}
                          onClick={() => void publishDraftProperty(propertyId)}
                          className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50 sm:py-2"
                        >
                          {propActing ? "Publicando…" : "Publicar"}
                        </button>
                      </>
                    ) : null}
                    {propSt === "published" ? (
                      <>
                        <Link
                          to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                          className="inline-flex justify-center rounded-full bg-primary/10 px-4 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/15"
                        >
                          Editar anuncio
                        </Link>
                        <button
                          type="button"
                          disabled={propActing}
                          onClick={() => void pauseProperty(propertyId)}
                          className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
                        >
                          {propActing ? "…" : "Pausar propiedad"}
                        </button>
                      </>
                    ) : null}
                    {propSt === "paused" ? (
                      <>
                        <Link
                          to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                          className="inline-flex justify-center rounded-full bg-primary/10 px-4 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/15"
                        >
                          Editar y republicar
                        </Link>
                        <button
                          type="button"
                          disabled={propActing}
                          onClick={() => void republishProperty(propertyId)}
                          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface disabled:opacity-50"
                        >
                          {propActing ? "…" : "Republicar propiedad"}
                        </button>
                      </>
                    ) : null}
                    {propSt === "published" || propSt === "paused" ? (
                      <button
                        type="button"
                        disabled={propActing}
                        onClick={() => void archiveProperty(propertyId)}
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted transition hover:bg-surface disabled:opacity-50"
                      >
                        {propActing ? "…" : "Archivar propiedad"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3">Referencia</th>
                        <th className="px-4 py-3">
                          {head.propertyPostMode === "property" ? "Recámara" : "Cuarto / título"}
                        </th>
                        {head.propertyPostMode === "property" ? (
                          <th className="hidden px-4 py-3 sm:table-cell">Disponibilidad</th>
                        ) : (
                          <th className="hidden px-4 py-3 sm:table-cell">Ciudad</th>
                        )}
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-body">
                      {list.map((l) => {
                        const st = l.status ?? "published";
                        const acting = rowBusy(l);
                        const roomRef = roomReferenceCode(l.id);
                        return (
                          <tr key={l.id}>
                            <td className="px-4 py-3">
                              <ListingReferenceChip
                                code={roomRef}
                                label="Anuncio"
                                title={`Referencia del anuncio: ${roomRef}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {head.propertyPostMode === "property"
                                ? roomDisplayName(
                                    { customName: l.roomCustomName, title: l.title },
                                    list.findIndex((x) => x.id === l.id),
                                  )
                                : l.title}
                            </td>
                            <td className="hidden px-4 py-3 text-muted sm:table-cell">
                              {head.propertyPostMode === "property"
                                ? occupancyStatusLabel(l.roomOccupancyStatus ?? "available")
                                : l.city}
                            </td>
                            <td className="px-4 py-3">{statusLabel(st)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {propSt === "draft" || propSt === "published" || propSt === "paused" ? (
                                  <Link
                                    to={`/publicar?edit=${encodeURIComponent(propertyId)}&room=${encodeURIComponent(l.id)}`}
                                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                                  >
                                    Editar
                                  </Link>
                                ) : null}
                                <Link
                                  to={
                                    head.propertyPostMode === "property"
                                      ? `${listingPublicPath(l.id)}?roomId=${encodeURIComponent(l.id)}`
                                      : listingPublicPath(l.id)
                                  }
                                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body hover:bg-surface-elevated"
                                >
                                  {st === "published" && propSt === "published"
                                    ? "Ver público"
                                    : "Vista previa"}
                                </Link>
                                {st === "published" ? (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => void pause(l.id)}
                                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                                  >
                                    {acting ? "…" : "Pausar"}
                                  </button>
                                ) : null}
                                {st === "paused" ? (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => void republish(l.id)}
                                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
                                  >
                                    {acting ? "…" : "Republicar"}
                                  </button>
                                ) : null}
                                {st === "published" || st === "paused" ? (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => void archive(l.id)}
                                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted hover:bg-surface-elevated disabled:opacity-50"
                                  >
                                    {acting ? "…" : "Archivar"}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  listingSharePath,
  PublicPostExperienceListing,
} from "@/components/listing/PublicPostExperienceListing";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { publicListingHeaderTitle } from "@/components/listing/PublicListingHeader";
import { ListingStickyContactBar } from "@/components/listing/ListingShareActions";
import { getListingById, SEED_LISTINGS } from "@/data/seedListings";
import { authMe, isAuthApiConfigured, type AuthMe } from "@/lib/authApi";
import {
  fetchListingByIdFromApi,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
  type FetchListingByIdResult,
  type ListingUnavailableReason,
} from "@/lib/listingsApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { listingGalleryImageUrls } from "@/lib/listingImageUrls";
import { listingPublicPath, roomReferenceCode } from "@/lib/listingReference";
import { buildSearchRestorePath, readSearchReturn } from "@/lib/searchReturn";
import { roomDisplayName } from "@/lib/roomDisplay";
import { postConversationMessage, startConversationFromListing } from "@/lib/messagesApi";
import type { PropertyKind, PropertyListing, PropertyWithRooms, Room } from "@/types/listing";

const MONTH_ABBREVIATIONS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatListingDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose the API but block it outside secure contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("clipboard_unavailable");
}

function absoluteAppUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function unavailableCopy(reason: ListingUnavailableReason | null): {
  title: string;
  lead: string;
  bullets: string[];
  help: string;
} {
  switch (reason) {
    case "invalid_id":
      return {
        title: "No es posible abrir este anuncio",
        lead: "El enlace no tiene un formato válido o está incompleto.",
        bullets: [
          "El ID del anuncio no coincide con un enlace válido de Bestie.",
          "Es posible que el enlace se haya copiado incompleto o se haya modificado.",
        ],
        help: "Pide el enlace completo o vuelve a abrirlo desde la publicación original.",
      };
    case "listing_draft":
      return {
        title: "Este anuncio sigue en borrador",
        lead: "La publicación existe, pero todavía no está disponible para visitantes.",
        bullets: [
          "La persona que lo creó aún no lo ha publicado.",
          "Los anuncios en borrador solo pueden abrirse desde la cuenta de quien los creó.",
        ],
        help: "Si el anuncio es tuyo, entra a Mis anuncios para terminar de publicarlo.",
      };
    case "listing_paused":
      return {
        title: "Este anuncio está pausado",
        lead: "La publicación fue detenida temporalmente y por eso no se muestra en público.",
        bullets: [
          "La persona que publicó el anuncio lo pausó desde su panel.",
          "Mientras esté pausado, el enlace no puede abrirse para visitantes.",
        ],
        help: "Si el anuncio es tuyo, puedes volver a activarlo desde Mis anuncios.",
      };
    case "listing_archived":
      return {
        title: "Este anuncio fue archivado",
        lead: "La publicación ya no está activa para visitas públicas.",
        bullets: [
          "El anuncio fue archivado por quien lo publicó.",
          "Los anuncios archivados dejan de mostrarse y su enlace deja de funcionar públicamente.",
        ],
        help: "Si necesitas volver a compartirlo, tendrás que reactivarlo o crear un anuncio vigente.",
      };
    case "property_draft":
      return {
        title: "La propiedad aún no está publicada",
        lead: "El cuarto existe, pero la propiedad principal sigue en borrador.",
        bullets: [
          "Bestie solo muestra este enlace cuando tanto el cuarto como la propiedad están publicados.",
          "Mientras la propiedad siga en borrador, no es posible abrir el anuncio como visitante.",
        ],
        help: "Si es tu publicación, entra a Mis anuncios y publica primero la propiedad.",
      };
    case "property_paused":
      return {
        title: "La propiedad está pausada",
        lead: "Este anuncio no puede mostrarse porque la propiedad relacionada fue pausada.",
        bullets: [
          "Aunque el cuarto exista, una propiedad pausada bloquea su visualización pública.",
          "El enlace volverá a funcionar cuando la propiedad se reactive.",
        ],
        help: "Si es tu publicación, reactiva la propiedad desde Mis anuncios.",
      };
    case "property_archived":
      return {
        title: "La propiedad fue archivada",
        lead: "Este anuncio ya no puede abrirse porque la propiedad relacionada fue archivada.",
        bullets: [
          "Cuando la propiedad se archiva, sus anuncios dejan de estar disponibles públicamente.",
          "Por eso este enlace ya no puede mostrarse como anuncio activo.",
        ],
        help: "Si es tu publicación, revisa Mis anuncios para gestionar una nueva publicación.",
      };
    case "listing_not_found":
    default:
      return {
        title: "No es posible abrir este anuncio",
        lead: "Este enlace ya no está disponible públicamente.",
        bullets: [
          "El anuncio pudo haber sido eliminado.",
          "También puede tratarse de un enlace antiguo que ya no corresponde a una publicación vigente.",
        ],
        help: "Si recibiste este enlace de otra persona, pídele uno actualizado.",
      };
  }
}

export function ListingPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const listingUpdated = Boolean(
    (location.state as { listingUpdated?: boolean } | null)?.listingUpdated,
  );
  const searchReturn = useMemo(() => readSearchReturn(location.state), [location.state]);
  useEffect(() => {
    if (!listingUpdated) return;
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [listingUpdated, location.pathname, location.search, navigate]);

  const { openLogin } = useAuthModal();
  const apiOn = isListingsApiConfigured();
  const messagingOn = isAuthApiConfigured();
  const seedListing = useMemo(() => (id ? getListingById(id) : undefined), [id]);

  const [apiListing, setApiListing] = useState<PropertyListing | null | undefined>(() =>
    apiOn ? undefined : null,
  );
  const [missingReason, setMissingReason] = useState<ListingUnavailableReason | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [propertyPack, setPropertyPack] = useState<PropertyWithRooms | null | undefined>(() =>
    apiOn ? undefined : null,
  );
  const [viewer, setViewer] = useState<AuthMe | null | undefined>(() =>
    messagingOn ? undefined : null,
  );
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const refreshViewer = useCallback(async () => {
    if (!messagingOn) {
      setViewer(null);
      return;
    }
    setViewer(await authMe().catch(() => null));
  }, [messagingOn]);

  useEffect(() => {
    setMsgErr(null);
    setShareMsg(null);
    setFailedImageUrls(new Set());
    void refreshViewer();
  }, [id, refreshViewer]);

  useEffect(() => {
    if (!apiOn || !id) {
      setApiListing(apiOn ? undefined : null);
      setMissingReason(null);
      setApiErr(null);
      return;
    }
    const ac = new AbortController();
    setApiListing(undefined);
    setMissingReason(null);
    setApiErr(null);
    fetchListingByIdFromApi(id, ac.signal)
      .then((result: FetchListingByIdResult) => {
        if (result.kind === "found") {
          setApiListing(result.listing);
          setMissingReason(null);
          return;
        }
        setApiListing(null);
        setMissingReason(result.reason);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setApiErr("No se pudo cargar el anuncio.");
        setApiListing(null);
        setMissingReason(null);
      });
    return () => ac.abort();
  }, [apiOn, id]);

  const listing = apiOn ? (apiListing === undefined ? undefined : apiListing) : seedListing;

  const searchRestorePath = useMemo(
    () => (searchReturn && listing ? buildSearchRestorePath(searchReturn, listing) : null),
    [listing, searchReturn],
  );

  useEffect(() => {
    if (!listing?.id || !id) return;
    const canonical = roomReferenceCode(listing.id);
    if (id === canonical) return;
    navigate(`${listingPublicPath(listing.id)}${location.search}`, {
      replace: true,
      state: location.state,
    });
  }, [id, listing?.id, location.search, location.state, navigate]);

  useEffect(() => {
    if (!apiOn || !listing?.propertyId) {
      setPropertyPack(null);
      return;
    }
    const ac = new AbortController();
    setPropertyPack(undefined);
    fetchPropertyWithRooms(listing.propertyId, ac.signal)
      .then((p) => setPropertyPack(p))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setPropertyPack(null);
      });
    return () => ac.abort();
  }, [apiOn, listing?.propertyId]);

  const seedSiblings = useMemo(() => {
    if (!listing?.propertyId) return [];
    return SEED_LISTINGS.filter((l) => l.propertyId === listing.propertyId && l.id !== listing.id);
  }, [listing]);

  const isPropertyPost =
    listing?.propertyPostMode === "property" || propertyPack?.property.postMode === "property";

  const commonAreaUrls = useMemo(() => {
    if (!listing) return [];
    const raw =
      propertyPack?.property.commonAreaPhotos ??
      propertyPack?.property.imageUrls ??
      listing.propertyImageUrls ??
      [];
    return raw.map((u) => apiAbsoluteUrl(u));
  }, [listing, propertyPack]);

  const galleryUrls = useMemo(() => {
    if (!listing) return [];
    if (isPropertyPost && propertyPack) {
      if (commonAreaUrls.length) return commonAreaUrls;
      const room = propertyPack.rooms.find((r) => r.id === listing.id);
      return (room?.imageUrls ?? []).map((u) => apiAbsoluteUrl(u));
    }
    const fromListing = listingGalleryImageUrls({
      postMode: listing.propertyPostMode,
      propertyImageUrls: listing.propertyImageUrls,
      roomImageUrls: listing.roomImageUrls,
    });
    if (fromListing.length) return fromListing.map((u) => apiAbsoluteUrl(u));
    if (!apiOn || !propertyPack) return [];
    const room = propertyPack.rooms.find((r) => r.id === listing.id);
    return listingGalleryImageUrls({
      postMode: listing.propertyPostMode ?? propertyPack.property.postMode,
      propertyImageUrls: propertyPack.property.imageUrls,
      roomImageUrls: room?.imageUrls,
    }).map((u) => apiAbsoluteUrl(u));
  }, [apiOn, listing, propertyPack, isPropertyPost, commonAreaUrls]);

  const siblingLinks = useMemo(() => {
    if (apiOn && propertyPack && propertyPack.rooms.length > 1) {
      return propertyPack.rooms
        .filter((r) => r.id !== listing?.id && r.status === "published")
        .map((r, idx) => ({ id: r.id, label: roomDisplayName(r, idx) }));
    }
    return seedSiblings.map((l) => ({ id: l.id, label: l.title }));
  }, [apiOn, propertyPack, listing?.id, seedSiblings]);

  const roomShareLinks = useMemo(() => {
    if (apiOn && propertyPack?.rooms.length) {
      return propertyPack.rooms
        .filter((r) => r.status === "published" || r.id === listing?.id)
        .map((r) => ({ id: r.id, label: r.title || "Cuarto" }));
    }
    if (!listing) return [];
    return [{ id: listing.id, label: listing.title }];
  }, [apiOn, propertyPack, listing]);

  const copyShareUrl = useCallback(async (path: string, label: string) => {
    try {
      await copyToClipboard(absoluteAppUrl(path));
      setShareMsg(`${label} copiado al portapapeles.`);
    } catch {
      setShareMsg("No se pudo copiar automáticamente. Copia la URL desde la barra del navegador.");
    }
  }, []);

  const openConversation = useCallback(
    async (listingRoomId: string, messageBody: string) => {
      if (!messagingOn) return;
      setMsgErr(null);
      if (viewer === undefined) return;
      if (!viewer) {
        openLogin();
        return;
      }
      setMsgBusy(true);
      try {
        const { conversationId } = await startConversationFromListing(listingRoomId);
        const trimmed = messageBody.trim();
        if (trimmed) {
          await postConversationMessage(conversationId, trimmed);
        }
        navigate(`/mensajes?c=${encodeURIComponent(conversationId)}`);
      } catch (e) {
        setMsgErr(e instanceof Error ? e.message : "No se pudo abrir el mensaje.");
      } finally {
        setMsgBusy(false);
      }
    },
    [messagingOn, viewer, openLogin, navigate],
  );

  const onSendSingleMessage = useCallback(
    (message: string) => {
      if (!id) return;
      void openConversation(id, message);
    },
    [id, openConversation],
  );

  const onSendPropertyMessage = useCallback(
    (message: string, roomIds: string[], availableRooms: readonly Room[]) => {
      if (!id) return;
      const targetRoomId = roomIds[0] ?? availableRooms[0]?.id ?? id;
      const selectedRooms = roomIds
        .map((roomId) => availableRooms.find((room) => room.id === roomId))
        .filter((room): room is Room => Boolean(room));
      let body = message.trim();
      if (selectedRooms.length) {
        const roomNames = selectedRooms.map((room) => room.customName || room.title).join(", ");
        const interestLine = `Me interesan: ${roomNames}.`;
        body = body ? `${body}\n\n${interestLine}` : interestLine;
      }
      void openConversation(targetRoomId, body);
    },
    [id, openConversation],
  );

  const scrollToContact = useCallback(() => {
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleStickyContact = useCallback(() => {
    scrollToContact();
  }, [scrollToContact]);

  if (apiOn && apiListing === undefined && !apiErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando anuncio…</p>
      </div>
    );
  }

  if (apiErr) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold text-body">Error</h1>
        <p className="mt-2 text-sm text-muted">{apiErr}</p>
        <Link
          to="/buscar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Volver a buscar
        </Link>
      </div>
    );
  }

  if (!listing) {
    const copy = unavailableCopy(missingReason);
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold text-body">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.lead}</p>
        <div className="mt-4 rounded-2xl border border-border bg-bg-light p-4 text-sm text-muted">
          <p className="font-medium text-body">Motivo detectado:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {copy.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-sm text-muted">
          {copy.help} Si este anuncio es tuyo, inicia sesión y revísalo desde{" "}
          <Link to="/mis-anuncios" className="font-medium text-primary underline-offset-2 hover:underline">
            Mis anuncios
          </Link>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/buscar"
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
          >
            Volver a buscar
          </Link>
          <Link
            to="/mis-anuncios"
            className="inline-flex rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface"
          >
            Ir a Mis anuncios
          </Link>
        </div>
      </div>
    );
  }

  const listingStatus = listing.status ?? "published";
  const createdAtLabel = formatListingDate(listing.createdAt);
  const updatedAtLabel = formatListingDate(listing.updatedAt);
  const postMode = listing.propertyPostMode ?? propertyPack?.property.postMode ?? "room";
  const propertyKind = (listing.propertyKind ??
    propertyPack?.property.propertyKind ??
    "house") as PropertyKind;
  const isApproximateLocation =
    listing.isApproximateLocation ?? propertyPack?.property.isApproximateLocation ?? false;
  const propertySummary = propertyPack?.property.summary.trim() ?? "";
  const categoryTitle = publicListingHeaderTitle({
    postMode,
    neighborhood: listing.neighborhood,
    lodgingType: listing.lodgingType,
    propertyKind,
  });

  const canContact = listingStatus === "published";
  const stickyContactLabel = "Contactar";

  const ownerActions =
    listing.viewerIsOwner && listingStatus === "published" ? (
      <Link
        to={`/publicar?edit=${encodeURIComponent(listing.propertyId)}&room=${encodeURIComponent(listing.id)}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
      >
        Editar anuncio
      </Link>
    ) : null;

  const statusBadge =
    listingStatus !== "published" ? (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
          listingStatus === "paused"
            ? "bg-amber-100 text-amber-900"
            : listingStatus === "draft"
              ? "bg-slate-200 text-slate-800"
              : "bg-slate-200 text-slate-600"
        }`}
      >
        {listingStatus === "paused" ? "Pausado" : listingStatus === "draft" ? "Borrador" : "Archivado"}
      </span>
    ) : null;

  const shareListingPath = listingSharePath(listing, isPropertyPost);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8 sm:py-10 sm:pb-10">
      <nav className="text-sm text-muted">
        {searchRestorePath ? (
          <Link
            to={searchRestorePath}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Buscar
          </Link>
        ) : (
          <Link to="/buscar/gdl" className="font-medium text-primary underline-offset-2 hover:underline">
            Buscar
          </Link>
        )}
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-body">{categoryTitle}</span>
      </nav>

      {listingUpdated ? (
        <p
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Cambios guardados. Tu anuncio ya muestra la información actualizada.
        </p>
      ) : null}

      <div className="mt-6">
        {isPropertyPost && propertyPack === undefined ? (
          <p className="text-sm text-muted">Cargando detalles de la propiedad…</p>
        ) : (
          <PublicPostExperienceListing
            listing={listing}
            propertyPack={propertyPack ?? null}
            isPropertyPost={isPropertyPost}
            galleryUrls={galleryUrls}
            propertySummary={propertySummary}
            isApproximateLocation={isApproximateLocation}
            failedImageUrls={failedImageUrls}
            onImageError={(u) => {
              setFailedImageUrls((prev) => {
                if (prev.has(u)) return prev;
                const next = new Set(prev);
                next.add(u);
                return next;
              });
            }}
            ownerActions={ownerActions}
            statusBadge={statusBadge}
            searchRestorePath={searchRestorePath}
            share={{
              shareMsg,
              onShareListing: () => void copyShareUrl(shareListingPath, "Link del anuncio"),
              isPropertyPost,
              propertyId: listing.propertyId,
              roomShareLinks,
              currentListingId: listing.id,
              onSharePath: (path, label) => void copyShareUrl(path, label),
            }}
            contact={{
              canContact,
              messagingOn,
              viewer,
              msgBusy,
              msgErr,
              onSendSingle: onSendSingleMessage,
              onSendProperty: onSendPropertyMessage,
            }}
          />
        )}
      </div>

      {siblingLinks.length && !isPropertyPost ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-body">Más opciones en esta propiedad</h2>
          <p className="mt-1 text-xs text-muted">Otros cuartos publicados en el mismo lugar.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {siblingLinks.map((s) => (
              <li key={s.id}>
                <Link
                  to={listingPublicPath(s.id)}
                  state={searchReturn ? { searchReturn } : undefined}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {createdAtLabel || updatedAtLabel ? (
        <p className="mt-6 text-center text-xs text-muted">
          {createdAtLabel ? <>Publicado · {createdAtLabel}</> : null}
          {createdAtLabel && updatedAtLabel ? " · " : null}
          {updatedAtLabel ? <>Actualizado · {updatedAtLabel}</> : null}
        </p>
      ) : null}

      <ListingStickyContactBar
        rentMxn={listing.rentMxn}
        canContact={canContact}
        contactLabel={stickyContactLabel}
        onContact={handleStickyContact}
      />
    </div>
  );
}

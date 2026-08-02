import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  listingSharePath,
  PublicPostExperienceListing,
} from "@/components/listing/PublicPostExperienceListing";
import { ListingStickyContactBar } from "@/components/listing/ListingShareActions";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { authMe, isAuthApiConfigured, type AuthMe } from "@/lib/authApi";
import {
  fetchListingByIdFromApi,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
} from "@/lib/listingsApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { listingPublicPath, propertyPublicPath, propertyReferenceCode } from "@/lib/listingReference";
import {
  buildMyListingsRestorePath,
  myListingsNavigationState,
  readMyListingsReturn,
} from "@/lib/myListingsReturn";
import { buildSearchRestorePath, readSearchReturn } from "@/lib/searchReturn";
import { isRoomAvailableForRent, roomDisplayName } from "@/lib/roomDisplay";
import { postConversationMessage, startConversationFromListing } from "@/lib/messagesApi";
import type { PropertyListing, PropertyWithRooms, Room } from "@/types/listing";

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through */
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

export function PropertyPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const apiOn = isListingsApiConfigured();
  const messagingOn = isAuthApiConfigured();

  const searchReturn = useMemo(() => readSearchReturn(location.state), [location.state]);
  const myListingsReturn = useMemo(() => readMyListingsReturn(location.state), [location.state]);

  const [propertyPack, setPropertyPack] = useState<PropertyWithRooms | null | undefined>(undefined);
  const [entryListing, setEntryListing] = useState<PropertyListing | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [viewer, setViewer] = useState<AuthMe | null | undefined>(() => (messagingOn ? undefined : null));
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Legacy `/propiedad/…?roomId=` deep links → room share URL.
  useEffect(() => {
    const roomId = new URLSearchParams(location.search).get("roomId");
    if (!roomId) return;
    navigate(listingPublicPath(roomId), { replace: true, state: location.state });
  }, [location.search, location.state, navigate]);

  useEffect(() => {
    if (!messagingOn) {
      setViewer(null);
      return;
    }
    void authMe()
      .then(setViewer)
      .catch(() => setViewer(null));
  }, [messagingOn]);

  useEffect(() => {
    if (!id) {
      setPropertyPack(null);
      return;
    }
    if (!apiOn) {
      setPropertyPack(null);
      setErr("La API de anuncios no está disponible.");
      return;
    }
    const ac = new AbortController();
    setPropertyPack(undefined);
    setErr(null);
    fetchPropertyWithRooms(id, ac.signal)
      .then((pack) => setPropertyPack(pack))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setPropertyPack(null);
        setErr("No se pudo cargar la propiedad.");
      });
    return () => ac.abort();
  }, [apiOn, id]);

  // Room-mode properties keep the single-room URL surface.
  useEffect(() => {
    if (!propertyPack) return;
    if (propertyPack.property.postMode === "property") return;
    const published = propertyPack.rooms.filter((room) => room.status === "published");
    const entry =
      published.find((room) => isRoomAvailableForRent(room)) ?? published[0] ?? propertyPack.rooms[0];
    if (entry) {
      navigate(listingPublicPath(entry.id), { replace: true, state: location.state });
    }
  }, [location.state, navigate, propertyPack]);

  // Canonicalize `/propiedad/:id` to the short P… code.
  useEffect(() => {
    if (!propertyPack || !id) return;
    if (propertyPack.property.postMode !== "property") return;
    const canonical = propertyReferenceCode(propertyPack.property.id);
    if (id === canonical) return;
    navigate(propertyPublicPath(propertyPack.property.id), {
      replace: true,
      state: location.state,
    });
  }, [id, location.state, navigate, propertyPack]);

  const entryRoom = useMemo(() => {
    if (!propertyPack || propertyPack.property.postMode !== "property") return null;
    const published = propertyPack.rooms.filter((room) => room.status === "published");
    return (
      published.find((room) => isRoomAvailableForRent(room)) ?? published[0] ?? propertyPack.rooms[0] ?? null
    );
  }, [propertyPack]);

  useEffect(() => {
    if (!entryRoom) {
      setEntryListing(null);
      return;
    }
    const ac = new AbortController();
    setEntryListing(undefined);
    fetchListingByIdFromApi(entryRoom.id, ac.signal)
      .then((result) => {
        if (result.kind === "found") setEntryListing(result.listing);
        else setEntryListing(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEntryListing(null);
      });
    return () => ac.abort();
  }, [entryRoom?.id]);

  const listing = entryListing === undefined ? undefined : entryListing;

  const searchRestorePath = useMemo(
    () => (searchReturn && listing ? buildSearchRestorePath(searchReturn, listing) : null),
    [searchReturn, listing],
  );
  const myListingsRestorePath = useMemo(
    () => (myListingsReturn ? buildMyListingsRestorePath(myListingsReturn) : null),
    [myListingsReturn],
  );

  const galleryUrls = useMemo(() => {
    if (!propertyPack) return [];
    const raw =
      propertyPack.property.commonAreaPhotos ?? propertyPack.property.imageUrls ?? [];
    if (raw.length) return raw.map((u) => apiAbsoluteUrl(u));
    const room = entryRoom;
    return (room?.imageUrls ?? []).map((u) => apiAbsoluteUrl(u));
  }, [entryRoom, propertyPack]);

  const roomShareLinks = useMemo(() => {
    if (!propertyPack) return [];
    return propertyPack.rooms
      .filter((r) => r.status === "published" && isRoomAvailableForRent(r))
      .map((r, idx) => ({ id: r.id, label: roomDisplayName(r, idx) }));
  }, [propertyPack]);

  const copyShareUrl = useCallback(async (path: string, label: string) => {
    try {
      await copyToClipboard(absoluteAppUrl(path));
      setShareMsg(`${label} copiado`);
      window.setTimeout(() => setShareMsg(null), 2500);
    } catch {
      setShareMsg("No se pudo copiar el enlace");
      window.setTimeout(() => setShareMsg(null), 2500);
    }
  }, []);

  const onSendPropertyMessage = useCallback(
    (message: string, roomIds: string[], availableRooms: readonly Room[]) => {
      if (!messagingOn) return;
      if (!viewer?.id) {
        openLogin();
        return;
      }
      const targetRoomId = roomIds[0] ?? availableRooms[0]?.id ?? entryRoom?.id;
      if (!targetRoomId) return;
      setMsgBusy(true);
      setMsgErr(null);
      void startConversationFromListing(targetRoomId)
        .then(async ({ conversationId }) => {
          if (message.trim()) {
            await postConversationMessage(conversationId, message.trim());
          }
          navigate(`/mensajes?c=${encodeURIComponent(conversationId)}`);
        })
        .catch((e: unknown) => {
          setMsgErr(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
        })
        .finally(() => setMsgBusy(false));
    },
    [entryRoom?.id, messagingOn, navigate, openLogin, viewer?.id],
  );

  if (propertyPack === undefined || (propertyPack && entryListing === undefined)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">Cargando propiedad…</p>
      </div>
    );
  }

  if (!propertyPack || propertyPack.property.postMode !== "property" || !listing || !entryRoom) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold text-body">No es posible abrir esta propiedad</h1>
        <p className="mt-2 text-sm text-muted">
          {err ??
            "La propiedad no está disponible públicamente o no tiene cuartos publicados en este momento."}
        </p>
        <Link
          to="/buscar"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Volver a buscar
        </Link>
      </div>
    );
  }

  const property = propertyPack.property;
  const isApproximateLocation = property.isApproximateLocation ?? false;
  const listingWithPrivacy: PropertyListing = {
    ...listing,
    isApproximateLocation,
    ...(isApproximateLocation
      ? {
          approximateRadiusMeters:
            listing.approximateRadiusMeters ?? property.approximateRadiusMeters,
        }
      : {}),
  };
  const propertySummary = property.summary.trim();
  const breadcrumbTitle = property.title.trim() || "Propiedad";
  const canContact = property.status === "published";
  const sharePath = listingSharePath(listing, true);
  const availableRents = propertyPack.rooms
    .filter((r) => r.status === "published" && isRoomAvailableForRent(r))
    .map((r) => r.rentMxn)
    .filter((r) => r > 0);
  const stickyRent = availableRents.length ? Math.min(...availableRents) : listing.rentMxn;

  const ownerActions =
    listing.viewerIsOwner && property.status === "published" ? (
      <Link
        to={`/publicar?edit=${encodeURIComponent(property.id)}`}
        state={
          myListingsReturn
            ? myListingsNavigationState(myListingsReturn)
            : searchReturn
              ? { searchReturn }
              : undefined
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
      >
        Editar anuncio
      </Link>
    ) : null;

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8 sm:py-10 sm:pb-10">
      <nav className="text-sm text-muted">
        {myListingsRestorePath ? (
          <Link
            to={myListingsRestorePath}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Mis anuncios
          </Link>
        ) : searchRestorePath ? (
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
        <span className="text-body">{breadcrumbTitle}</span>
      </nav>

      <div className="mt-6">
        <PublicPostExperienceListing
          listing={listingWithPrivacy}
          propertyPack={propertyPack}
          isPropertyPost
          focusedRoomId={null}
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
          searchRestorePath={searchRestorePath}
          myListingsRestorePath={myListingsRestorePath}
          share={{
            shareMsg,
            onShareListing: () => void copyShareUrl(sharePath, "Enlace del anuncio"),
            isPropertyPost: true,
            propertyId: property.id,
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
            onSendSingle: () => {},
            onSendProperty: onSendPropertyMessage,
          }}
        />
      </div>

      <ListingStickyContactBar
        rentMxn={stickyRent}
        canContact={canContact}
        contactLabel="Contactar"
        onContact={() => {
          document.getElementById("property-contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}

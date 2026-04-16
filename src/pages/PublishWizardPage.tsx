import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { WizardLocationMap } from "@/components/WizardLocationMap";
import { BulkImageUploader } from "@/components/BulkImageUploader";
import {
  addDraftRoomToProperty,
  createDraftProperty,
  deleteDraftRoom,
  fetchPropertyWithRooms,
  isListingsApiConfigured,
  patchDraftRoom,
  publishPropertyBundle,
  updateProperty,
} from "@/lib/listingsApi";
import { authLinkPublisher, authMe, consumeHandoffToken, type AuthMe } from "@/lib/authApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import { TAG_LABELS } from "@/lib/searchFilters";
import type {
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyWithRooms,
  RoomDimension,
  RoommateGenderPref,
} from "@/types/listing";

const ALL_TAGS = Object.keys(TAG_LABELS) as ListingTag[];
/** Aligned with server `PROPERTY_SUMMARY_MIN_LEN` (Roomix-style property description). */
const PROPERTY_SUMMARY_MIN = 20;

function isoToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const STORAGE_KEY_V3 = "bestie-publish-draft-v3";
const STORAGE_KEY_V2 = "bestie-publish-draft-v2";

/** Valid-length placeholder until the user enters a real number; publishing rejects all-zero contacts server-side. */
const DRAFT_WA_PLACEHOLDER = "0000000000000";

type ServerSync = {
  propertyId: string | null;
  /** Parallel to `rooms`; empty string = room not created on the server yet. */
  roomIds: string[];
};

const CITIES = [
  "Guadalajara",
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
] as const;

const CITY_ANCHOR: Record<
  (typeof CITIES)[number],
  { neighborhood: string; lat: number; lng: number }
> = {
  Guadalajara: { neighborhood: "Zona metropolitana", lat: 20.675_138, lng: -103.347_345 },
  Mérida: { neighborhood: "Centro", lat: 20.967_37, lng: -89.592_586 },
  "Puerto Vallarta": { neighborhood: "Zona hotelera", lat: 20.653_4, lng: -105.225_331 },
  Sayulita: { neighborhood: "Centro", lat: 20.870_789, lng: -105.440_849 },
  Bucerías: { neighborhood: "Centro", lat: 20.755_056, lng: -105.333_056 },
};

type RoomDraft = {
  title: string;
  rentMxn: number;
  depositMxn: number;
  roomsAvailable: number;
  summary: string;
  tags: ListingTag[];
  roommateGenderPref: RoommateGenderPref;
  ageMin: number;
  ageMax: number;
  lodgingType: LodgingType;
  /** ISO `YYYY-MM-DD` — Roomix “Disponible a partir de”. */
  availableFrom: string;
  minimalStayMonths: number;
  roomDimension: RoomDimension;
};

/** Roomix-style step 1: shared rooms vs entire home listing. */
type PublishOfferMode = "rooms_in_shared" | "whole_property";

type Draft = {
  /** Strategy: 'room' = single-room post; 'property' = property/multi-room post. */
  postMode: "room" | "property";
  publishMode: PublishOfferMode;
  city: (typeof CITIES)[number];
  propertyTitle: string;
  neighborhood: string;
  contactWhatsApp: string;
  propertySummary: string;
  propertyKind: PropertyKind;
  /** Total bedrooms in the building (Roomix `rooms_number`). */
  propertyBedroomsTotal: number;
  /** Bathrooms count (Roomix allows medios baños). */
  propertyBathrooms: number;
  /** Roomix-style: show WhatsApp on the public listing. */
  showWhatsApp: boolean;
  useCustomMapPin: boolean;
  customLat: string;
  customLng: string;
  /**
   * Tagged property images (shared areas / facade) — `/api/uploads/...` from server.
   * Note: we don't persist per-image tags yet; this is the post-tagging bucket.
   */
  propertyImageUrls: string[];
  /** Untagged pool (mandatory to tag for property-mode before publishing). */
  unassignedImageUrls: string[];
  /** One array per room index. */
  roomImageUrls: string[][];
  rooms: RoomDraft[];
  legalAccepted: boolean;
  isApproximateLocation: boolean;
};

const defaultRoom = (): RoomDraft => ({
  title: "Cuarto disponible",
  rentMxn: 5000,
  depositMxn: 0,
  roomsAvailable: 1,
  summary: "",
  tags: [],
  roommateGenderPref: "any",
  ageMin: 18,
  ageMax: 99,
  lodgingType: "private_room",
  availableFrom: isoToday(),
  minimalStayMonths: 1,
  roomDimension: "medium",
});

const DEFAULT_PROPERTY_SUMMARY =
  "Describe la propiedad y áreas compartidas: reglas de convivencia, baños, cocina, estacionamiento y lo que hace único el espacio.";

const wholePropertyRoom = (): RoomDraft => ({
  ...defaultRoom(),
  title: "Vivienda completa",
  lodgingType: "whole_home",
  summary: "",
});

const defaultDraft = (): Draft => ({
  postMode: "property",
  publishMode: "rooms_in_shared",
  city: "Guadalajara",
  propertyTitle: "",
  neighborhood: "",
  contactWhatsApp: "",
  propertySummary: DEFAULT_PROPERTY_SUMMARY,
  propertyKind: "house",
  propertyBedroomsTotal: 1,
  propertyBathrooms: 1,
  showWhatsApp: true,
  useCustomMapPin: false,
  customLat: "",
  customLng: "",
  propertyImageUrls: [],
  unassignedImageUrls: [],
  roomImageUrls: [[]],
  rooms: [defaultRoom()],
  legalAccepted: false,
  isApproximateLocation: false,
});

function normalizeParsedDraft(parsed: Partial<Draft>): Draft {
  const baseRooms = Array.isArray(parsed.rooms) && parsed.rooms.length ? parsed.rooms : [defaultRoom()];
  const rooms = baseRooms.map((r) => ({ ...defaultRoom(), ...r }));
  const postMode: Draft["postMode"] = parsed.postMode === "room" || parsed.postMode === "property" ? parsed.postMode : "property";
  const publishMode: PublishOfferMode =
    parsed.publishMode === "whole_property" || parsed.publishMode === "rooms_in_shared"
      ? parsed.publishMode
      : "rooms_in_shared";
  const pk =
    parsed.propertyKind === "apartment" || parsed.propertyKind === "house"
      ? parsed.propertyKind
      : defaultDraft().propertyKind;
  const bed =
    typeof parsed.propertyBedroomsTotal === "number" && Number.isFinite(parsed.propertyBedroomsTotal)
      ? Math.min(35, Math.max(1, Math.floor(parsed.propertyBedroomsTotal)))
      : defaultDraft().propertyBedroomsTotal;
  const bath =
    typeof parsed.propertyBathrooms === "number" && Number.isFinite(parsed.propertyBathrooms)
      ? Math.min(99, Math.max(0, Math.round(parsed.propertyBathrooms * 2) / 2))
      : defaultDraft().propertyBathrooms;
  const propertyImageUrls = Array.isArray(parsed.propertyImageUrls)
    ? parsed.propertyImageUrls.filter((x): x is string => typeof x === "string")
    : [];
  const unassignedImageUrls = Array.isArray(parsed.unassignedImageUrls)
    ? parsed.unassignedImageUrls.filter((x): x is string => typeof x === "string")
    : [];
  let roomImageUrls: string[][] = [];
  if (Array.isArray(parsed.roomImageUrls)) {
    roomImageUrls = parsed.roomImageUrls.map((row) =>
      Array.isArray(row) ? row.filter((x): x is string => typeof x === "string") : [],
    );
  }
  while (roomImageUrls.length < rooms.length) roomImageUrls.push([]);
  roomImageUrls = roomImageUrls.slice(0, rooms.length);
  return {
    ...defaultDraft(),
    ...parsed,
    postMode,
    publishMode,
    propertyKind: pk,
    propertyBedroomsTotal: bed,
    propertyBathrooms: bath,
    showWhatsApp: parsed.showWhatsApp !== false,
    useCustomMapPin: Boolean(parsed.useCustomMapPin),
    customLat: typeof parsed.customLat === "string" ? parsed.customLat : "",
    customLng: typeof parsed.customLng === "string" ? parsed.customLng : "",
    rooms,
    propertyImageUrls,
    unassignedImageUrls,
    roomImageUrls,
    isApproximateLocation: Boolean(parsed.isApproximateLocation),
  };
}

function loadPersisted(): { draft: Draft; serverSync: ServerSync } {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (rawV3) {
      const root = JSON.parse(rawV3) as {
        draft?: Partial<Draft>;
        serverSync?: { propertyId?: unknown; roomIds?: unknown };
      };
      if (root.draft) {
        const draft = normalizeParsedDraft(root.draft);
        let roomIds = Array.isArray(root.serverSync?.roomIds)
          ? (root.serverSync!.roomIds as unknown[]).filter((x): x is string => typeof x === "string")
          : [];
        while (roomIds.length < draft.rooms.length) roomIds.push("");
        roomIds = roomIds.slice(0, draft.rooms.length);
        const propertyId =
          typeof root.serverSync?.propertyId === "string" && root.serverSync.propertyId.trim()
            ? root.serverSync.propertyId.trim()
            : null;
        return {
          draft,
          serverSync: propertyId ? { propertyId, roomIds } : { propertyId: null, roomIds: [] },
        };
      }
    }
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      return {
        draft: normalizeParsedDraft(JSON.parse(rawV2) as Partial<Draft>),
        serverSync: { propertyId: null, roomIds: [] },
      };
    }
  } catch {
    /* ignore */
  }
  return { draft: defaultDraft(), serverSync: { propertyId: null, roomIds: [] } };
}

function isFreshDefaultDraft(d: Draft): boolean {
  return (
    JSON.stringify({ ...d, legalAccepted: false }) === JSON.stringify({ ...defaultDraft(), legalAccepted: false })
  );
}

function wizardContactDigits(contactWhatsApp: string): string {
  const d = normalizeWhatsApp(contactWhatsApp);
  return d.length >= 10 ? d : DRAFT_WA_PLACEHOLDER;
}

function normalizeWhatsApp(s: string): string {
  return s.replace(/\D/g, "");
}

function pickCity(city: string): (typeof CITIES)[number] {
  return (CITIES as readonly string[]).includes(city) ? (city as (typeof CITIES)[number]) : "Guadalajara";
}

function tagOk(t: string): t is ListingTag {
  return (ALL_TAGS as readonly string[]).includes(t);
}

function draftFromPropertyBundle(bundle: PropertyWithRooms): { draft: Draft; serverSync: ServerSync } {
  const p = bundle.property;
  const srvRooms = [...bundle.rooms].sort((a, b) => a.sortOrder - b.sortOrder);
  const city = pickCity(p.city);
  const anchor = CITY_ANCHOR[city];
  const usePin =
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    (Math.abs(p.lat - anchor.lat) > 0.0002 || Math.abs(p.lng - anchor.lng) > 0.0002);
  const roomDrafts: RoomDraft[] =
    srvRooms.length > 0
      ? srvRooms.map((r) => ({
          ...defaultRoom(),
          title: r.title,
          rentMxn: r.rentMxn,
          depositMxn: r.depositMxn,
          roomsAvailable: r.roomsAvailable,
          summary: r.summary,
          tags: (r.tags ?? []).filter(tagOk),
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          lodgingType: r.lodgingType ?? "private_room",
          availableFrom: (r.availableFrom ?? isoToday()).slice(0, 10),
          minimalStayMonths: r.minimalStayMonths ?? 1,
          roomDimension: r.roomDimension ?? "medium",
        }))
      : [defaultRoom()];
  const publishMode: PublishOfferMode =
    srvRooms.length === 1 && srvRooms[0]?.lodgingType === "whole_home" ? "whole_property" : "rooms_in_shared";
  const draft: Draft = {
    ...defaultDraft(),
    postMode: p.postMode === "room" ? "room" : "property",
    publishMode,
    city,
    propertyTitle: p.title,
    neighborhood: p.neighborhood,
    contactWhatsApp: p.contactWhatsApp || "",
    propertySummary: p.summary?.trim() ? p.summary : DEFAULT_PROPERTY_SUMMARY,
    propertyKind: p.propertyKind ?? "house",
    propertyBedroomsTotal: p.bedroomsTotal,
    propertyBathrooms: p.bathrooms,
    showWhatsApp: p.showWhatsApp,
    useCustomMapPin: usePin,
    customLat: usePin ? String(p.lat) : "",
    customLng: usePin ? String(p.lng) : "",
    propertyImageUrls: p.imageUrls ?? [],
    unassignedImageUrls: [],
    roomImageUrls: srvRooms.length > 0 ? srvRooms.map((r) => r.imageUrls ?? []) : [[]],
    rooms: roomDrafts,
    legalAccepted: false,
    isApproximateLocation: Boolean((p as { isApproximateLocation?: unknown }).isApproximateLocation),
  };
  return {
    draft,
    serverSync:
      srvRooms.length > 0
        ? { propertyId: p.id, roomIds: srvRooms.map((r) => r.id) }
        : { propertyId: p.id, roomIds: [] },
  };
}

export function PublishWizardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handoffToken = searchParams.get("handoff");
  const editPropertyId = searchParams.get("edit");
  const upgrade = searchParams.get("upgrade") === "1";
  const handoffLock = useRef(false);
  const [handoffBanner, setHandoffBanner] = useState<string | null>(null);
  const apiOn = isListingsApiConfigured();
  const persistedInit = useMemo(() => loadPersisted(), []);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => persistedInit.draft);
  const [serverSync, setServerSync] = useState<ServerSync>(() => persistedInit.serverSync);
  const [submitInFlight, setSubmitInFlight] = useState<"publish" | "draft" | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [autosaveNote, setAutosaveNote] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!apiOn) {
      setMe(null);
      return;
    }
    void authMe().then(setMe).catch(() => setMe(null));
  }, [apiOn]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const serverSyncRef = useRef(serverSync);
  serverSyncRef.current = serverSync;

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAutosaveRef = useRef<() => Promise<ServerSync | null>>(async () => null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify({ draft, serverSync }));
  }, [draft, serverSync]);

  useEffect(() => {
    if (!handoffToken) {
      handoffLock.current = false;
      return;
    }
    if (!apiOn || handoffLock.current) return;
    handoffLock.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const { draftPropertyId } = await consumeHandoffToken(handoffToken);
        await authLinkPublisher();
        if (draftPropertyId) {
          const bundle = await fetchPropertyWithRooms(draftPropertyId);
          if (bundle && !cancelled) {
            const mapped = draftFromPropertyBundle(bundle);
            setDraft(mapped.draft);
            setServerSync(mapped.serverSync);
            setHandoffBanner("Tu borrador desde Messenger está cargado.");
          }
        } else if (!cancelled) {
          setHandoffBanner("Sesión de publicación restaurada. Continúa donde la dejaste.");
        }
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("handoff");
              return n;
            },
            { replace: true },
          );
        }
      } catch (e) {
        if (!cancelled) {
          setPublishErr(e instanceof Error ? e.message : "No se pudo abrir el enlace de Messenger.");
          handoffLock.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, handoffToken, setSearchParams]);

  useEffect(() => {
    if (!editPropertyId) return;
    if (!apiOn) return;
    let cancelled = false;
    void (async () => {
      try {
        const bundle = await fetchPropertyWithRooms(editPropertyId);
        if (bundle && !cancelled) {
          const mapped = draftFromPropertyBundle(bundle);
          setDraft(mapped.draft);
          setServerSync(mapped.serverSync);
          if (upgrade && mapped.draft.postMode === "room") {
            setHandoffBanner("Borrador cargado. Puedes convertir este cuarto en una propiedad con varios cuartos.");
          } else {
            setHandoffBanner("Borrador cargado para editar.");
          }
        }
      } catch (e) {
        if (!cancelled) setPublishErr(e instanceof Error ? e.message : "No se pudo cargar el borrador.");
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("edit");
              n.delete("upgrade");
              return n;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, editPropertyId, upgrade, setSearchParams]);

  const resolveLatLngForDraft = useCallback((d: Draft): { lat: number; lng: number } => {
    const anchor = CITY_ANCHOR[d.city];
    if (!d.useCustomMapPin) return { lat: anchor.lat, lng: anchor.lng };
    const lat = Number(String(d.customLat).replace(",", "."));
    const lng = Number(String(d.customLng).replace(",", "."));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return { lat: anchor.lat, lng: anchor.lng };
  }, []);

  useEffect(() => {
    const { lat, lng } = resolveLatLngForDraft(draft);
    setResolvedAddress("Buscando dirección...");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "User-Agent": "bestie.mx-publish-wizard" } }
        );
        if (res.ok) {
          const data = await res.json() as { display_name?: string };
          setResolvedAddress(data.display_name || "Dirección aproximada");
        } else {
          setResolvedAddress("Ubicación aproximada");
        }
      } catch {
        setResolvedAddress("Ubicación aproximada");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draft.city, draft.customLat, draft.customLng, draft.useCustomMapPin, resolveLatLngForDraft]);

  runAutosaveRef.current = async (): Promise<ServerSync | null> => {
    if (!isListingsApiConfigured()) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAutosaveNote("idle");
      return null;
    }
    const d = draftRef.current;
    if (isFreshDefaultDraft(d)) {
      setAutosaveNote("idle");
      return null;
    }

    try {
      setAutosaveNote("saving");
      const anchor = CITY_ANCHOR[d.city];
      const neighborhood = d.neighborhood.trim() || anchor.neighborhood;
      const { lat, lng } = resolveLatLngForDraft(d);
      const wa = wizardContactDigits(d.contactWhatsApp);

      let propertyId = serverSyncRef.current.propertyId;
      let roomIds = [...serverSyncRef.current.roomIds];

      if (!propertyId) {
        const prop = await createDraftProperty({
          title: d.propertyTitle.trim() || "Sin título",
          city: d.city,
          neighborhood,
          lat,
          lng,
          summary: d.propertySummary.trim(),
          contactWhatsApp: wa,
          propertyKind: d.propertyKind,
          bedroomsTotal: d.propertyBedroomsTotal,
          bathrooms: d.propertyBathrooms,
          showWhatsApp: d.showWhatsApp,
          imageUrls: d.propertyImageUrls,
          isApproximateLocation: d.isApproximateLocation,
        });
        propertyId = prop.id;
        roomIds = d.rooms.map(() => "");
      }

      while (roomIds.length < d.rooms.length) roomIds.push("");
      roomIds = roomIds.slice(0, d.rooms.length);

      for (let i = 0; i < d.rooms.length; i++) {
        const r = d.rooms[i]!;
        const payload = {
          title: r.title.trim() || "Cuarto en borrador",
          rentMxn: r.rentMxn,
          roomsAvailable: r.roomsAvailable,
          tags: r.tags,
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          summary: r.summary.trim(),
          lodgingType: r.lodgingType,
          availableFrom: r.availableFrom.trim(),
          minimalStayMonths: r.minimalStayMonths,
          roomDimension: r.roomDimension,
          depositMxn: r.depositMxn,
          imageUrls: d.roomImageUrls[i] ?? [],
        };
        const rid = roomIds[i];
        if (!rid) {
          const created = await addDraftRoomToProperty(propertyId!, payload);
          roomIds[i] = created.id;
        } else {
          await patchDraftRoom(propertyId!, rid, payload);
        }
      }

      await updateProperty(propertyId!, {
        postMode: d.postMode,
        title: d.propertyTitle.trim() || "Sin título",
        summary: d.propertySummary.trim(),
        city: d.city,
        neighborhood,
        lat,
        lng,
        contactWhatsApp: wa,
        propertyKind: d.propertyKind,
        bedroomsTotal: d.propertyBedroomsTotal,
        bathrooms: d.propertyBathrooms,
        showWhatsApp: d.showWhatsApp,
        imageUrls: d.propertyImageUrls,
        isApproximateLocation: d.isApproximateLocation,
      });

      const next: ServerSync = { propertyId, roomIds };
      serverSyncRef.current = next;
      setServerSync(next);
      setAutosaveNote("saved");
      window.setTimeout(() => {
        setAutosaveNote((n) => (n === "saved" ? "idle" : n));
      }, 2000);
      return next;
    } catch {
      setAutosaveNote("error");
      return null;
    }
  };

  const flushWizardAutosave = useCallback(async (): Promise<ServerSync | null> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!apiOn) return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
    if (isFreshDefaultDraft(draftRef.current)) {
      return serverSyncRef.current.propertyId ? serverSyncRef.current : null;
    }
    const out = await runAutosaveRef.current();
    return out ?? (serverSyncRef.current.propertyId ? serverSyncRef.current : null);
  }, [apiOn]);

  useEffect(() => {
    if (!apiOn) return;
    if (isFreshDefaultDraft(draftRef.current)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosaveRef.current();
    }, 900);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, apiOn]);

  function updateRoom(i: number, patch: Partial<RoomDraft>) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }

  function addRoom() {
    if (draftRef.current.postMode === "room") return;
    if (draftRef.current.publishMode === "whole_property") return;
    setDraft((d) => ({
      ...d,
      rooms: [...d.rooms, defaultRoom()],
      roomImageUrls: [...d.roomImageUrls, []],
    }));
    setServerSync((s) => (s.propertyId ? { ...s, roomIds: [...s.roomIds, ""] } : s));
  }

  function removeRoom(i: number) {
    if (draftRef.current.postMode === "room") return;
    if (draftRef.current.publishMode === "whole_property" && draftRef.current.rooms.length <= 1) return;
    const pid = serverSyncRef.current.propertyId;
    const rid = serverSyncRef.current.roomIds[i];
    if (apiOn && pid && rid) {
      void deleteDraftRoom(pid, rid).catch(() => undefined);
    }
    setServerSync((s) => ({
      ...s,
      roomIds: s.roomIds.filter((_, j) => j !== i),
    }));
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.length <= 1 ? d.rooms : d.rooms.filter((_, j) => j !== i),
      roomImageUrls:
        d.rooms.length <= 1 ? d.roomImageUrls : d.roomImageUrls.filter((_, j) => j !== i),
    }));
  }

  const steps = useMemo(
    () => [
      {
        title: "¿Qué quieres publicar?",
        body: (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Empieza rápido con un solo cuarto o crea una propiedad con varios cuartos.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    postMode: "room",
                    publishMode: "rooms_in_shared",
                    rooms: [defaultRoom()],
                    roomImageUrls: [d.roomImageUrls[0] ?? []],
                    propertySummary: "",
                  }))
                }
                className={`rounded-2xl border-2 px-4 py-5 text-left transition ${
                  draft.postMode === "room"
                    ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                    : "border-border bg-surface hover:bg-surface-elevated"
                }`}
              >
                <div className="text-base font-bold text-primary">Solo un cuarto</div>
                <p className="mt-2 text-xs text-muted">
                  Publica un solo cuarto ahora. Luego puedes convertirlo en propiedad y agregar más cuartos.
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    if (d.postMode === "property" && d.publishMode === "rooms_in_shared") return d;
                    return {
                      ...d,
                      postMode: "property",
                      publishMode: "rooms_in_shared",
                      rooms: [defaultRoom()],
                      roomImageUrls: [[]],
                    };
                  })
                }
                className={`rounded-2xl border-2 px-4 py-5 text-left transition ${
                  draft.postMode === "property" && draft.publishMode === "rooms_in_shared"
                    ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                    : "border-border bg-surface hover:bg-surface-elevated"
                }`}
              >
                <div className="text-base font-bold text-primary">Ofrezco cuarto(s)</div>
                <p className="mt-2 text-xs text-muted">Uno o más espacios en la misma dirección (roomies).</p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    if (d.postMode === "property" && d.publishMode === "whole_property") return d;
                    return {
                      ...d,
                      postMode: "property",
                      publishMode: "whole_property",
                      rooms: [wholePropertyRoom()],
                      roomImageUrls: [[]],
                    };
                  })
                }
                className={`rounded-2xl border-2 px-4 py-5 text-left transition ${
                  draft.postMode === "property" && draft.publishMode === "whole_property"
                    ? "border-secondary bg-secondary/10 ring-2 ring-secondary/40"
                    : "border-border bg-surface hover:bg-surface-elevated"
                }`}
              >
                <div className="text-base font-bold text-primary">Ofrezco la propiedad completa</div>
                <p className="mt-2 text-xs text-muted">Un solo espacio tipo “vivienda completa” (sin sumar cuartos).</p>
              </button>
            </div>
          </div>
        ),
      },
      {
        title: "Ubicación",
        body: (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-body">
              Ciudad
              <select
                value={draft.city}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, city: e.target.value as Draft["city"] }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-muted">
                Todos los cuartos comparten esta ciudad. Haz clic en el mapa o arrastra el pin para la
                ubicación exacta de la propiedad.
              </span>
            </label>
            <div>
              <p className="text-sm font-medium text-body">Ubicación en el mapa</p>
              <p className="mt-1 text-xs text-muted">
                Clic en el mapa o arrastra el marcador. Puedes volver al centro de la ciudad con el botón de
                abajo.
              </p>
              <div className="mt-3">
                <WizardLocationMap
                  key={draft.city}
                  center={[CITY_ANCHOR[draft.city].lat, CITY_ANCHOR[draft.city].lng]}
                  position={(() => {
                    const { lat, lng } = resolveLatLngForDraft(draft);
                    return [lat, lng] as [number, number];
                  })()}
                  onPositionChange={(lat, lng) => {
                    setDraft((d) => ({
                      ...d,
                      useCustomMapPin: true,
                      customLat: String(lat),
                      customLng: String(lng),
                    }));
                  }}
                />
              </div>
              {resolvedAddress && (
                <div className="mt-2 flex items-start gap-2 text-sm font-medium text-primary bg-surface-elevated rounded-lg p-3 border border-border">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{resolvedAddress}</span>
                </div>
              )}
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 cursor-pointer transition hover:bg-surface-elevated">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-secondary focus:ring-secondary"
                  checked={draft.isApproximateLocation}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, isApproximateLocation: e.target.checked }))
                  }
                />
                <div>
                  <span className="block text-sm font-semibold text-primary">
                    Ocultar dirección exacta en el anuncio
                  </span>
                  <span className="block text-xs text-muted">
                    Los usuarios solo verán un círculo aproximado de 500m en el mapa. Útil si prefieres mayor privacidad hasta contactar con los interesados.
                  </span>
                </div>
              </label>
              <button
                type="button"
                className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    useCustomMapPin: false,
                    customLat: "",
                    customLng: "",
                  }))
                }
              >
                Usar centro de {draft.city} (quitar pin personalizado)
              </button>
            </div>
            <details className="rounded-xl border border-border bg-surface-elevated/40 px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-body">Ajustar con latitud / longitud</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-body">
                  Latitud
                  <input
                    value={draft.customLat}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        useCustomMapPin: true,
                        customLat: e.target.value,
                      }))
                    }
                    placeholder={String(CITY_ANCHOR[draft.city].lat)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                  />
                </label>
                <label className="block text-sm font-medium text-body">
                  Longitud
                  <input
                    value={draft.customLng}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        useCustomMapPin: true,
                        customLng: e.target.value,
                      }))
                    }
                    placeholder={String(CITY_ANCHOR[draft.city].lng)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                  />
                </label>
              </div>
            </details>
          </div>
        ),
      },
      {
        title: "Propiedad",
        body: (
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-body">
              Nombre de la propiedad
              <input
                value={draft.propertyTitle}
                onChange={(e) => setDraft((d) => ({ ...d, propertyTitle: e.target.value }))}
                placeholder="Ej. Casa compartida Chapalita / Depa zona Minerva"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Colonia o zona
              <input
                value={draft.neighborhood}
                onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
                placeholder="Ej. Chapultepec, Versalles…"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-body">
              Descripción de la propiedad
              <span className="text-red-600"> *</span>
              <textarea
                value={draft.propertySummary}
                onChange={(e) => setDraft((d) => ({ ...d, propertySummary: e.target.value }))}
                rows={5}
                maxLength={2000}
                placeholder="Reglas de la casa, áreas comunes, estacionamiento, convivencia… (mín. 20 caracteres, como en Roomix.)"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
              <span className="mt-1 block text-xs text-muted">
                Mínimo {PROPERTY_SUMMARY_MIN} caracteres · {draft.propertySummary.trim().length} ahora
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-body">
                Cuartos en la propiedad (total)
                <span className="text-red-600"> *</span>
                <input
                  type="number"
                  min={1}
                  max={35}
                  step={1}
                  value={draft.propertyBedroomsTotal}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      propertyBedroomsTotal: Math.min(35, Math.max(1, Number(e.target.value) || 1)),
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-xs text-muted">
                  Incluye cuartos ocupados y libres (mismo criterio que Roomix).
                </span>
              </label>
              <label className="block text-sm font-medium text-body">
                Baños (total)
                <span className="text-red-600"> *</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={0.5}
                  value={draft.propertyBathrooms}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      propertyBathrooms: Math.min(
                        99,
                        Math.max(0, Math.round(Number(e.target.value) * 2) / 2 || 0),
                      ),
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-body">
              <input
                type="checkbox"
                checked={draft.showWhatsApp}
                onChange={(e) => setDraft((d) => ({ ...d, showWhatsApp: e.target.checked }))}
                className="mt-1 size-4 rounded border-border text-primary"
              />
              <span>Mostrar WhatsApp en el anuncio público (equivalente a “Visible en anuncio” en Roomix).</span>
            </label>
            <label className="block text-sm font-medium text-body">
              Tipo de vivienda
              <select
                value={draft.propertyKind}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, propertyKind: e.target.value as PropertyKind }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              >
                <option value="house">Casa</option>
                <option value="apartment">Departamento</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-body">
              WhatsApp de contacto (se muestra en cada cuarto al publicar)
              <input
                value={draft.contactWhatsApp}
                onChange={(e) => setDraft((d) => ({ ...d, contactWhatsApp: e.target.value }))}
                placeholder="Ej. 523312345678"
                inputMode="tel"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
              />
              {!apiOn ? (
                <span className="mt-1 block text-xs text-muted">
                  Sin API configurada, el número solo se guarda en este navegador hasta que conectes el
                  servidor.
                </span>
              ) : null}
            </label>
          </div>
        ),
      },
      {
        title: "Cuartos",
        body: (
          <div className="space-y-6">
            {draft.rooms.map((room, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-bg-light p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Cuarto {i + 1}
                  </p>
                  {draft.rooms.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
                <label className="mt-3 block text-sm font-medium text-body">
                  Título del espacio
                  <input
                    value={room.title}
                    onChange={(e) => updateRoom(i, { title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-body">
                    Renta (MXN / mes)
                    <span className="text-red-600"> *</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={room.rentMxn}
                      onChange={(e) =>
                        updateRoom(i, { rentMxn: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Depósito (MXN)
                    <span className="text-red-600"> *</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={room.depositMxn}
                      onChange={(e) =>
                        updateRoom(i, { depositMxn: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Plazas / espacios
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={room.roomsAvailable}
                      onChange={(e) =>
                        updateRoom(i, {
                          roomsAvailable: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Disponible desde
                    <span className="text-red-600"> *</span>
                    <input
                      type="date"
                      value={room.availableFrom}
                      onChange={(e) => updateRoom(i, { availableFrom: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Estancia mínima (meses)
                    <span className="text-red-600"> *</span>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={room.minimalStayMonths}
                      onChange={(e) =>
                        updateRoom(i, {
                          minimalStayMonths: Math.min(
                            36,
                            Math.max(1, Math.floor(Number(e.target.value) || 1)),
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Tamaño del cuarto
                    <span className="text-red-600"> *</span>
                    <select
                      value={room.roomDimension}
                      onChange={(e) =>
                        updateRoom(i, { roomDimension: e.target.value as RoomDimension })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="small">Pequeño</option>
                      <option value="medium">Mediano</option>
                      <option value="large">Grande</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-sm font-medium text-body">
                  Descripción del cuarto
                  <textarea
                    value={room.summary}
                    onChange={(e) => updateRoom(i, { summary: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <fieldset className="mt-3">
                  <legend className="text-sm font-medium text-body">Etiquetas del cuarto</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_TAGS.map((tag) => (
                      <label
                        key={tag}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-body"
                      >
                        <input
                          type="checkbox"
                          checked={room.tags.includes(tag)}
                          onChange={() =>
                            setDraft((d) => ({
                              ...d,
                              rooms: d.rooms.map((r, j) =>
                                j === i
                                  ? {
                                      ...r,
                                      tags: r.tags.includes(tag)
                                        ? r.tags.filter((t) => t !== tag)
                                        : [...r.tags, tag],
                                    }
                                  : r,
                              ),
                            }))
                          }
                          className="size-3.5 rounded border-border text-primary"
                        />
                        {TAG_LABELS[tag]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-body">
                    Tipo de espacio
                    <select
                      value={room.lodgingType}
                      onChange={(e) =>
                        updateRoom(i, { lodgingType: e.target.value as LodgingType })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="private_room">Cuarto privado</option>
                      <option value="shared_room">Cuarto compartido</option>
                      <option value="whole_home">Vivienda completa</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Roomies prefieren
                    <select
                      value={room.roommateGenderPref}
                      onChange={(e) =>
                        updateRoom(i, {
                          roommateGenderPref: e.target.value as RoommateGenderPref,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="any">Sin preferencia</option>
                      <option value="female">Mujer</option>
                      <option value="male">Hombre</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-body">
                    Edad mín.
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={room.ageMin}
                      onChange={(e) =>
                        updateRoom(i, {
                          ageMin: Math.min(99, Math.max(18, Number(e.target.value) || 18)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-body">
                    Edad máx.
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={room.ageMax}
                      onChange={(e) =>
                        updateRoom(i, {
                          ageMax: Math.min(99, Math.max(18, Number(e.target.value) || 99)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
            {draft.publishMode === "whole_property" ? (
              <p className="rounded-xl border border-border bg-bg-light px-3 py-2 text-xs text-muted">
                Modo “propiedad completa”: un solo espacio publicado. Cambia el paso 1 si necesitas varios cuartos.
              </p>
            ) : (
              <button
                type="button"
                onClick={addRoom}
                className="w-full rounded-xl border border-dashed border-secondary/60 py-2 text-sm font-semibold text-primary hover:bg-secondary/10"
              >
                + Agregar otro cuarto
              </button>
            )}
          </div>
        ),
      },
      {
        title: "Fotos",
        body: (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Sube fotos en bloque. Se optimizan para web (hasta 1920px) antes de subir. En “propiedad” después podrás
              etiquetarlas por cuarto/áreas compartidas/fachada.
            </p>
            {draft.postMode === "property" ? (
              <BulkImageUploader
                title="Fotos sin categorizar (propiedad)"
                urls={draft.unassignedImageUrls}
                maxCount={Math.min(120, draft.rooms.length * 20 + 40)}
                apiOn={apiOn}
                onChange={(next) => {
                  setDraft((d) => ({ ...d, unassignedImageUrls: next }));
                }}
                hint="Luego las etiquetas por cuarto / áreas compartidas / fachada."
              />
            ) : null}
            {draft.rooms.map((room, i) => (
              <BulkImageUploader
                key={i}
                title={`Cuarto ${i + 1}: ${room.title.trim() || "Sin título"}`}
                urls={draft.roomImageUrls[i] ?? []}
                maxCount={20}
                apiOn={apiOn}
                onChange={(next) => {
                  setDraft((d) => ({
                    ...d,
                    roomImageUrls: d.roomImageUrls.map((row, ri) => (ri === i ? next : row)),
                  }));
                }}
              />
            ))}
          </div>
        ),
      },
      ...(draft.postMode === "property"
        ? ([
            {
              title: "Etiquetar fotos",
              body: (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    Para una publicación de propiedad, las fotos deben estar etiquetadas antes de publicar. Puedes
                    dejar fotos “Sin categorizar” mientras editas, pero no al momento de publicar.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      Sin categorizar: <strong className="text-body">{draft.unassignedImageUrls.length}</strong>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      Propiedad: <strong className="text-body">{draft.propertyImageUrls.length}</strong>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      Cuartos:{" "}
                      <strong className="text-body">
                        {draft.roomImageUrls.reduce((a, r) => a + (r?.length ?? 0), 0)}
                      </strong>
                    </span>
                  </div>
                  {draft.unassignedImageUrls.length ? (
                    <button
                      type="button"
                      className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-body hover:bg-surface-elevated"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          propertyImageUrls: [...d.propertyImageUrls, ...d.unassignedImageUrls].slice(0, 20),
                          unassignedImageUrls: [],
                        }));
                      }}
                    >
                      Etiquetar todo como “Áreas compartidas”
                    </button>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draft.unassignedImageUrls.map((u) => (
                      <div key={u} className="rounded-xl border border-border bg-surface p-3">
                        <div className="flex items-start gap-3">
                          <img
                            src={apiAbsoluteUrl(u)}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                              Etiqueta
                              <select
                                className="mt-1 w-full rounded-lg border border-border bg-bg-light px-2 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
                                defaultValue="uncat"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDraft((d) => {
                                    const nextUnassigned = d.unassignedImageUrls.filter((x) => x !== u);
                                    if (v === "shared") {
                                      return {
                                        ...d,
                                        unassignedImageUrls: nextUnassigned,
                                        propertyImageUrls: [...d.propertyImageUrls, u].slice(0, 20),
                                      };
                                    }
                                    if (v === "facade") {
                                      const without = d.propertyImageUrls.filter((x) => x !== u);
                                      return {
                                        ...d,
                                        unassignedImageUrls: nextUnassigned,
                                        propertyImageUrls: [u, ...without].slice(0, 20),
                                      };
                                    }
                                    if (v.startsWith("room:")) {
                                      const idx = Number(v.split(":")[1] ?? "1") - 1;
                                      if (!Number.isFinite(idx) || idx < 0 || idx >= d.rooms.length) return d;
                                      return {
                                        ...d,
                                        unassignedImageUrls: nextUnassigned,
                                        roomImageUrls: d.roomImageUrls.map((row, ri) =>
                                          ri === idx ? [...row, u].slice(0, 20) : row,
                                        ),
                                      };
                                    }
                                    return d;
                                  });
                                }}
                              >
                                <option value="uncat">Sin categorizar</option>
                                <option value="shared">Áreas compartidas</option>
                                <option value="facade">Fachada</option>
                                {draft.rooms.map((r, idx) => (
                                  <option key={idx} value={`room:${idx + 1}`}>
                                    Cuarto {idx + 1}: {r.title.trim() || "Sin título"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
          ] as const)
        : []),
      {
        title: "Publicar",
        body: (
          <div className="space-y-3 text-sm text-muted">
            <p>
              Revisa los pasos anteriores. Puedes <strong className="text-body">publicar el anuncio ya</strong> o
              seguir guardando borrador desde el panel inferior: no hace falta llegar a este paso para publicar.
            </p>
            <p>
              Con la API activa, los datos se sincronizan solos en segundo plano; el botón &quot;Guardar borrador en
              servidor&quot; solo fuerza una sincronización inmediata.
            </p>
          </div>
        ),
      },
    ],
    [draft, apiOn, resolveLatLngForDraft],
  );

  const current = steps[step]!;

  function validateRoomsForSubmit(d: Draft): string | null {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of d.rooms) {
      if (!r.title.trim() || !r.summary.trim()) {
        return "Cada cuarto necesita título y descripción.";
      }
      if (r.ageMin > r.ageMax) {
        return "En cada cuarto la edad mínima no puede ser mayor que la máxima.";
      }
      if (!iso.test(r.availableFrom.trim())) {
        return "En cada cuarto indica una fecha “Disponible desde” válida (AAAA-MM-DD).";
      }
      if (!Number.isFinite(r.minimalStayMonths) || r.minimalStayMonths < 1) {
        return "En cada cuarto la estancia mínima debe ser de al menos 1 mes.";
      }
      if (r.rentMxn < 0 || r.depositMxn < 0) {
        return "Renta y depósito no pueden ser negativos.";
      }
    }
    return null;
  }

  const publishBlockedReason = useMemo(() => {
    if (draft.postMode !== "room" && !draft.propertyTitle.trim()) return "Agrega el nombre de la propiedad.";
    if (draft.postMode !== "room" && draft.propertySummary.trim().length < PROPERTY_SUMMARY_MIN) {
      return `La descripción de la propiedad debe tener al menos ${PROPERTY_SUMMARY_MIN} caracteres.`;
    }
    if (normalizeWhatsApp(draft.contactWhatsApp).length < 10) {
      return "Agrega un WhatsApp válido (al menos 10 dígitos).";
    }
    if (draft.postMode === "property" && draft.unassignedImageUrls.length > 0) {
      return "Etiqueta tus fotos (Sin categorizar) antes de publicar.";
    }
    if (!draft.legalAccepted) {
      return "Marca la casilla de confirmación legal para publicar.";
    }
    return validateRoomsForSubmit(draft);
  }, [draft]);

  async function submitPublish() {
    setPublishErr(null);
    const anchor = CITY_ANCHOR[draft.city];
    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    if (draft.postMode !== "room" && !draft.propertyTitle.trim()) {
      setPublishErr("Agrega el nombre de la propiedad.");
      return;
    }
    if (draft.postMode !== "room" && draft.propertySummary.trim().length < PROPERTY_SUMMARY_MIN) {
      setPublishErr(
        `La descripción de la propiedad debe tener al menos ${PROPERTY_SUMMARY_MIN} caracteres (campos obligatorios alineados con Roomix).`,
      );
      return;
    }
    if (digits.length < 10) {
      setPublishErr("Agrega un WhatsApp válido (al menos 10 dígitos).");
      return;
    }
    if (!draft.legalAccepted) {
      setPublishErr("Debes aceptar la confirmación legal.");
      return;
    }
    if (draft.postMode === "property" && draft.unassignedImageUrls.length > 0) {
      setPublishErr("Etiqueta tus fotos (Sin categorizar) antes de publicar.");
      return;
    }
    const roomErr = validateRoomsForSubmit(draft);
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }
    if (me === undefined) {
      setPublishErr("Comprobando tu sesión… intenta de nuevo en un momento.");
      return;
    }
    if (!me) {
      setSubmitInFlight("draft");
      try {
        await flushWizardAutosave();
        navigate("/entrar", {
          replace: true,
          state: {
            registrationNotice:
              "Tu anuncio ya está creado como borrador. Para activarlo y publicarlo, inicia sesión o crea una cuenta.",
          },
        });
      } catch (e) {
        setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador.");
      } finally {
        setSubmitInFlight(null);
      }
      return;
    }

    setSubmitInFlight("publish");
    try {
      const sync = await flushWizardAutosave();
      const { lat, lng } = resolveLatLngForDraft(draft);
      const firstRoomId =
        sync?.roomIds.find((id) => typeof id === "string" && id.length > 0) ?? null;

      if (apiOn && sync?.propertyId && firstRoomId) {
        await updateProperty(sync.propertyId, {
          status: "published",
          postMode: draft.postMode,
          title: draft.propertyTitle.trim(),
          summary: draft.propertySummary.trim(),
          city: draft.city,
          neighborhood,
          lat,
          lng,
          contactWhatsApp: digits,
          propertyKind: draft.propertyKind,
          bedroomsTotal: draft.propertyBedroomsTotal,
          bathrooms: draft.propertyBathrooms,
          showWhatsApp: draft.showWhatsApp,
          imageUrls: draft.propertyImageUrls,
        });
        localStorage.setItem(
          STORAGE_KEY_V3,
          JSON.stringify({
            draft: { ...defaultDraft(), city: draft.city },
            serverSync: { propertyId: null, roomIds: [] },
          }),
        );
        setServerSync({ propertyId: null, roomIds: [] });
        navigate(`/anuncio/${firstRoomId}`);
        return;
      }

      const res = await publishPropertyBundle({
        legalAccepted: true,
        property: {
          postMode: draft.postMode,
          title: draft.propertyTitle.trim(),
          city: draft.city,
          neighborhood,
          lat,
          lng,
          summary: draft.propertySummary.trim(),
          contactWhatsApp: digits,
          propertyKind: draft.propertyKind,
          bedroomsTotal: draft.propertyBedroomsTotal,
          bathrooms: draft.propertyBathrooms,
          showWhatsApp: draft.showWhatsApp,
          imageUrls: draft.propertyImageUrls,
        },
        rooms: draft.rooms.map((r, i) => ({
          title: r.title.trim(),
          rentMxn: r.rentMxn,
          roomsAvailable: r.roomsAvailable,
          tags: r.tags,
          roommateGenderPref: r.roommateGenderPref,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          summary: r.summary.trim(),
          lodgingType: r.lodgingType,
          availableFrom: r.availableFrom.trim(),
          minimalStayMonths: r.minimalStayMonths,
          roomDimension: r.roomDimension,
          depositMxn: r.depositMxn,
          imageUrls: draft.roomImageUrls[i] ?? [],
        })),
      });
      const first = res.rooms[0];
      if (!first) {
        setPublishErr("La API no devolvió cuartos.");
        return;
      }
      localStorage.setItem(
        STORAGE_KEY_V3,
        JSON.stringify({
          draft: { ...defaultDraft(), city: draft.city },
          serverSync: { propertyId: null, roomIds: [] },
        }),
      );
      setServerSync({ propertyId: null, roomIds: [] });
      navigate(`/anuncio/${first.id}`);
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  async function submitServerDraft() {
    setPublishErr(null);
    const anchor = CITY_ANCHOR[draft.city];
    const neighborhood = draft.neighborhood.trim() || anchor.neighborhood;
    const digits = normalizeWhatsApp(draft.contactWhatsApp);
    if (draft.postMode !== "room" && !draft.propertyTitle.trim()) {
      setPublishErr("Agrega el nombre de la propiedad.");
      return;
    }
    if (draft.postMode !== "room" && draft.propertySummary.trim().length < PROPERTY_SUMMARY_MIN) {
      setPublishErr(`La descripción de la propiedad debe tener al menos ${PROPERTY_SUMMARY_MIN} caracteres.`);
      return;
    }
    if (digits.length < 10) {
      setPublishErr("Agrega un WhatsApp válido (al menos 10 dígitos).");
      return;
    }
    const roomErr = validateRoomsForSubmit(draft);
    if (roomErr) {
      setPublishErr(roomErr);
      return;
    }

    setSubmitInFlight("draft");
    try {
      await flushWizardAutosave();
      navigate("/mis-anuncios", { state: { draftSaved: true } });
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "No se pudo guardar el borrador en el servidor.");
    } finally {
      setSubmitInFlight(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Publicar</h1>
      <p className="mt-2 text-sm text-muted">
        Elige cómo empezar:{" "}
        <strong className="font-medium text-body">un solo cuarto</strong> (rápido) o{" "}
        <strong className="font-medium text-body">una propiedad con varios cuartos</strong>.
      </p>
      {handoffBanner ? (
        <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm text-body">
          {handoffBanner}
        </p>
      ) : null}
      {draft.postMode === "room" ? (
        <div className="mt-4 rounded-2xl border border-border bg-bg-light p-4">
          <p className="text-sm text-body">
            Estás publicando <strong>solo un cuarto</strong>. Si después quieres subir más fotos, agregar cuartos o
            etiquetar fotos por cuarto/áreas compartidas/fachada, puedes convertirlo a propiedad.
          </p>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                postMode: "property",
                propertySummary: d.propertySummary.trim() ? d.propertySummary : DEFAULT_PROPERTY_SUMMARY,
              }))
            }
            className="mt-3 inline-flex rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-primary transition hover:brightness-95"
          >
            Convertir a propiedad
          </button>
        </div>
      ) : null}
      {apiOn ? (
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {autosaveNote === "saving"
            ? "Guardando borrador en el servidor…"
            : autosaveNote === "saved"
              ? "Borrador guardado en el servidor."
              : autosaveNote === "error"
                ? "No se pudo sincronizar con el servidor (tus datos siguen en este navegador). Se reintentará al seguir editando."
                : "Los cambios se guardan solos en el servidor unos segundos después de editar (y siempre en este navegador)."}
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Paso {step + 1} de {steps.length}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-body">{current.title}</h2>
        <div className="mt-4">{current.body}</div>
        {publishErr ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {publishErr}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition enabled:hover:bg-surface-elevated disabled:opacity-40"
          >
            Atrás
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110"
            >
              Siguiente
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  localStorage.setItem(STORAGE_KEY_V3, JSON.stringify({ draft, serverSync }))
                }
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
              >
                Guardar borrador
              </button>
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitServerDraft()}
                  className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
                >
                  {submitInFlight === "draft" ? "Guardando…" : "Guardar borrador en servidor"}
                </button>
              ) : null}
              {apiOn ? (
                <button
                  type="button"
                  disabled={submitInFlight !== null}
                  onClick={() => void submitPublish()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
                >
                  {submitInFlight === "publish" ? "Publicando…" : "Publicar"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-body">Publicación</h2>
        <p className="mt-1 text-sm text-muted">
          Desde aquí puedes <strong className="font-medium text-body">publicar en vivo</strong> (anuncio visible en
          búsqueda) o guardar borrador en el servidor, en cualquier paso del asistente.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            checked={draft.legalAccepted}
            onChange={(e) => setDraft((d) => ({ ...d, legalAccepted: e.target.checked }))}
            className="mt-1 size-4 rounded border-border text-primary"
          />
          <span>
            Confirmo que la información es verídica y acepto las responsabilidades legales al publicar en Bestie
            (v1).
          </span>
        </label>
        {publishBlockedReason ? (
          <p className="mt-3 text-xs text-muted">
            Para habilitar &quot;Publicar ahora&quot;: {publishBlockedReason}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitInFlight !== null || Boolean(publishBlockedReason) || !apiOn}
            title={
              !apiOn
                ? "Configura VITE_API_URL y ejecuta la API para publicar."
                : publishBlockedReason ?? undefined
            }
            onClick={() => void submitPublish()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-45"
          >
            {submitInFlight === "publish" ? "Publicando…" : "Publicar ahora"}
          </button>
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={() => void submitServerDraft()}
              className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2.5 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
            >
              {submitInFlight === "draft" ? "Guardando…" : "Guardar borrador en servidor"}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: el borrador vive en tu navegador; publicar en el catálogo requiere{" "}
              <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code>.
            </span>
          )}
        </div>
      </section>

      <p className="mt-6 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Ver búsqueda
        </Link>
      </p>
    </div>
  );
}

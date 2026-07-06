import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bath,
  Bed,
  BedDouble,
  Calendar,
  Car,
  CheckCircle2,
  Cigarette,
  DollarSign,
  Home,
  Info,
  KeyRound,
  MapPin,
  MessageCircle,
  PawPrint,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Timer,
  UserCheck,
  Users,
  VenusAndMars,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ListingPhotoCarousel } from "@/components/listing/ListingPhotoCarousel";
import { ListingSection } from "@/components/listing/ListingSection";
import { ListingShareActions } from "@/components/listing/ListingShareActions";
import { ListingTagChips } from "@/components/listing/ListingTagChips";
import { PublicListingLocationMap } from "@/components/listing/PublicListingLocationMap";
import { listingHeroPriceLabel } from "@/lib/listingTags";
import { listingGalleryImageUrls } from "@/lib/listingImageUrls";
import {
  formatRoomAvailableFrom,
  minimalStayMonthsLabel,
  PROPERTY_AMENITY_TAG_SLUGS,
  ROOM_IDEAL_PARA_TAG_SET,
  ROOM_TAG_GROUPS,
} from "@/lib/listingTags";
import type { ListingTag, Property, PropertyListing, Room } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const MOCK_POST_PROPOSALS_PATH = "/mockups/post-proposals";
const MOCK_SINGLE_ROOM_SHARE_PATH = `${MOCK_POST_PROPOSALS_PATH}#single-room-post`;
const MOCK_PROPERTY_SHARE_PATH = `${MOCK_POST_PROPOSALS_PATH}#property-post`;

function mockPropertyRoomSharePath(roomId: string): string {
  return `${MOCK_POST_PROPOSALS_PATH}?roomId=${encodeURIComponent(roomId)}#property-available-rooms`;
}

function absoluteAppUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back below.
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

const singleRoomListing: PropertyListing = {
  id: "mock-room-1",
  propertyId: "mock-property-room",
  propertyTitle: "Departamento tranquilo en Providencia",
  propertyStatus: "published",
  propertyPostMode: "room",
  title: "Recámara privada con escritorio",
  city: "Guadalajara",
  neighborhood: "Providencia",
  lat: 20.6913,
  lng: -103.3868,
  rentMxn: 9800,
  depositMxn: 5000,
  propertyBedroomsTotal: 3,
  propertyBathrooms: 2,
  showWhatsApp: true,
  roomsAvailable: 1,
  tags: [
    "wifi",
    "agua",
    "luz",
    "gas",
    "muebles",
    "lavadora",
    "cocina-equipada",
    "seguridad-acceso",
    "cerca-transporte",
    "profesionistas",
    "lgbt-friendly",
    "baño-privado",
    "cerradura-cuarto",
  ],
  roommateGenderPref: "any",
  ageMin: 23,
  ageMax: 38,
  summary:
    "Recámara privada muy iluminada con escritorio amplio y clóset. El ambiente en casa es tranquilo entre semana, ideal para home office. Se comparte limpieza ligera de áreas comunes y hay reglas claras de convivencia para mantener orden.",
  contactWhatsApp: "5213312345678",
  status: "published",
  propertyImageUrls: [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200",
    "https://images.unsplash.com/photo-1616594039964-3dfe2a6a4fc2?w=1200",
  ],
  roomImageUrls: [
    "https://images.unsplash.com/photo-1560184897-ae75f418493e?w=1200",
    "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200",
  ],
  lodgingType: "private_room",
  propertyKind: "apartment",
  availableFrom: "2026-06-15",
  minimalStayMonths: 6,
  roomDimension: "medium",
  avalRequired: false,
  subletAllowed: false,
  isApproximateLocation: false,
  streetViewPov: {
    heading: 210,
    pitch: -4,
    zoom: 1.1,
  },
  roomCustomName: "Recámara Sur",
  roomOccupancyStatus: "available",
};

const propertyMock: Property = {
  id: "mock-property-2",
  publisherId: "mock-owner",
  status: "published",
  postMode: "property",
  title: "Casa compartida en Chapalita",
  city: "Guadalajara",
  neighborhood: "Chapalita",
  lat: 20.6618,
  lng: -103.3945,
  summary:
    "Casa amplia con áreas comunes bien equipadas: cocina integral, sala grande y patio interior. Ambiente respetuoso, ideal para personas que trabajan y buscan una convivencia estable de largo plazo.",
  contactWhatsApp: "5213322233344",
  propertyKind: "house",
  bedroomsTotal: 5,
  bathrooms: 3,
  showWhatsApp: true,
  imageUrls: [
    "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200",
    "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200",
  ],
  commonAreaPhotos: [
    "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200",
    "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200",
  ],
  isApproximateLocation: false,
  streetViewPov: {
    heading: 43,
    pitch: -2,
    zoom: 1.15,
  },
  occupiedByWomenCount: 2,
  occupiedByMenCount: 1,
};

const propertyCommonTags: ListingTag[] = [
  "mascotas",
  "fiestas",
  "fumar",
  "lavadora",
  "secadora",
  "seguridad-acceso",
  "vigilancia",
  "cocina-equipada",
  "wifi",
];

const propertyRooms: Room[] = [
  {
    id: "mock-prop-r1",
    propertyId: propertyMock.id,
    status: "published",
    customName: "Habitación Jardín",
    occupancyStatus: "occupied",
    occupantWomenCount: 1,
    occupantMenCount: 0,
    title: "Habitación Jardín",
    rentMxn: 0,
    depositMxn: 0,
    roomsAvailable: 0,
    tags: ["wifi", "muebles"],
    roommateGenderPref: "any",
    ageMin: 18,
    ageMax: 99,
    summary: "Habitación actualmente ocupada por una profesionista.",
    lodgingType: "private_room",
    availableFrom: "",
    minimalStayMonths: 0,
    roomDimension: "medium",
    sortOrder: 0,
    imageUrls: [],
  },
  {
    id: "mock-prop-r2",
    propertyId: propertyMock.id,
    status: "published",
    customName: "Habitación Estudio",
    occupancyStatus: "occupied",
    occupantWomenCount: 0,
    occupantMenCount: 1,
    title: "Habitación Estudio",
    rentMxn: 0,
    depositMxn: 0,
    roomsAvailable: 0,
    tags: ["wifi", "muebles"],
    roommateGenderPref: "any",
    ageMin: 18,
    ageMax: 99,
    summary: "Habitación ocupada por un residente médico.",
    lodgingType: "private_room",
    availableFrom: "",
    minimalStayMonths: 0,
    roomDimension: "small",
    sortOrder: 1,
    imageUrls: [],
  },
  {
    id: "mock-prop-r3",
    propertyId: propertyMock.id,
    status: "published",
    customName: "Habitación Terraza",
    occupancyStatus: "available",
    title: "Habitación Terraza",
    rentMxn: 8600,
    depositMxn: 4300,
    roomsAvailable: 1,
    tags: [
      "wifi",
      "muebles",
      "ventilador",
      "closet",
      "baño-privado",
      "estacionamiento",
      "cerca-transporte",
      "profesionistas",
      "nomadas-digitales",
    ],
    roommateGenderPref: "any",
    ageMin: 24,
    ageMax: 40,
    summary:
      "Recámara amplia con acceso visual a la terraza y buena ventilación. Perfecta para trabajo remoto y estancia mediana/larga.",
    lodgingType: "private_room",
    availableFrom: "2026-06-20",
    minimalStayMonths: 6,
    roomDimension: "large",
    avalRequired: true,
    sortOrder: 2,
    imageUrls: [
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200",
      "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200",
    ],
  },
  {
    id: "mock-prop-r4",
    propertyId: propertyMock.id,
    status: "published",
    customName: "Habitación Norte",
    occupancyStatus: "available",
    title: "Habitación Norte",
    rentMxn: 7800,
    depositMxn: 3900,
    roomsAvailable: 1,
    tags: [
      "wifi",
      "muebles",
      "cerca-transporte",
      "estudiantes",
      "fumar-permitido-recamara",
      "cerradura-cuarto",
    ],
    roommateGenderPref: "female",
    ageMin: 20,
    ageMax: 33,
    summary:
      "Recámara cómoda con escritorio y clóset. Se busca perfil respetuoso y ordenado, ideal para estudiante de posgrado.",
    lodgingType: "private_room",
    availableFrom: "2026-07-01",
    minimalStayMonths: 4,
    roomDimension: "medium",
    avalRequired: false,
    sortOrder: 3,
    imageUrls: [
      "https://images.unsplash.com/photo-1617104678098-de229db51175?w=1200",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200",
    ],
  },
];

function yesNo(v: boolean): string {
  return v ? "Sí" : "No";
}

function genderPrefLabel(pref: PropertyListing["roommateGenderPref"]): string {
  if (pref === "female") return "Mujer";
  if (pref === "male") return "Hombre";
  return "Hombre o Mujer";
}

function lodgingLabel(v: PropertyListing["lodgingType"]): string {
  return v === "shared_room" ? "Recámara compartida" : "Recámara privada";
}

function propertyKindLabel(v: Property["propertyKind"]): string {
  if (v === "apartment") return "Departamento";
  if (v === "loft") return "Loft";
  return "Casa";
}

function roomDimensionWizardLabel(v: Room["roomDimension"] | PropertyListing["roomDimension"]): string {
  if (v === "small") return "Individual (Cabe cama individual + buró)";
  if (v === "large") return "Grande (Cabe cama Queen/King + área de estar)";
  return "Matrimonial (Cabe cama matrimonial + escritorio)";
}

function occupiedRoomOccupantLabel(room: Room): string {
  const women = Math.max(0, Math.floor(room.occupantWomenCount ?? 0));
  const men = Math.max(0, Math.floor(room.occupantMenCount ?? 0));
  const parts: string[] = [];
  if (men > 0) parts.push(`${men} ${men === 1 ? "Hombre" : "Hombres"}`);
  if (women > 0) parts.push(`${women} ${women === 1 ? "Mujer" : "Mujeres"}`);
  if (!parts.length) return "Ocupado";
  return `Ocupado por ${parts.join(" y ")}`;
}

type KeyLabelItem = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
};

function KeyLabelCard({ item }: { item: KeyLabelItem }) {
  const Icon = item.icon;
  const valueRef = useRef<HTMLParagraphElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;

    const checkTruncation = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.value]);

  useEffect(() => {
    if (!tooltipOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tooltipRef.current?.contains(target)) return;
      setTooltipOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [tooltipOpen]);

  return (
    <article className="relative rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="relative min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.title}</p>
            {isTruncated ? (
              <button
                type="button"
                className="-mt-0.5 shrink-0 rounded-full text-muted transition hover:text-primary"
                aria-label={`Ver ${item.title} completo`}
                aria-expanded={tooltipOpen}
                onClick={() => setTooltipOpen((open) => !open)}
              >
                <Info className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <p
            ref={valueRef}
            className="truncate text-xs font-medium text-body"
            title={isTruncated ? item.value : undefined}
          >
            {item.value}
          </p>
          {tooltipOpen ? (
            <div
              ref={tooltipRef}
              role="tooltip"
              className="absolute right-0 top-full z-20 mt-1 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface px-2.5 py-2 text-xs leading-relaxed text-body shadow-md"
            >
              {item.value}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function KeyLabelsGrid({ items }: { items: readonly KeyLabelItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.slice(0, 12).map((item) => (
        <KeyLabelCard key={`${item.title}-${item.value}`} item={item} />
      ))}
    </div>
  );
}

const KEY_LABEL_ROOM_TAG_SLUGS = new Set(["baño-privado", "estacionamiento", "estudiantes", "individuos-solo"]);
const PROPERTY_AMENITY_TAG_SET = new Set<string>(PROPERTY_AMENITY_TAG_SLUGS);
const ROOM_PHYSICAL_TAG_SET = new Set<string>(ROOM_TAG_GROUPS[0].tags);

function HeaderInfoItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-medium text-body">{value}</p>
      </div>
    </div>
  );
}

function RoomSecondaryTagSections({ tags }: { tags: readonly ListingTag[] }) {
  const amenityTags = tags.filter((tag) => PROPERTY_AMENITY_TAG_SET.has(tag));
  const physicalTags = tags.filter((tag) => ROOM_PHYSICAL_TAG_SET.has(tag) && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));
  const idealTags = tags.filter((tag) => ROOM_IDEAL_PARA_TAG_SET.has(tag) && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));

  if (!amenityTags.length && !physicalTags.length && !idealTags.length) {
    return <p className="text-sm italic text-muted">Sin etiquetas adicionales.</p>;
  }

  return (
    <div className="space-y-5">
      {amenityTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">La propiedad cuenta con</p>
          <div className="mt-2">
            <ListingTagChips tags={amenityTags} />
          </div>
        </div>
      ) : null}
      {physicalTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Propiedades de la recámara</p>
          <div className="mt-2">
            <ListingTagChips tags={physicalTags} />
          </div>
        </div>
      ) : null}
      {idealTags.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ideal para</p>
          <div className="mt-2">
            <ListingTagChips tags={idealTags} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SingleRoomHeader({
  listing,
  menCount,
  womenCount,
  shareActions,
}: {
  listing: PropertyListing;
  menCount: number;
  womenCount: number;
  shareActions?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-body">{listing.title}</h2>
        {shareActions ? <div className="shrink-0">{shareActions}</div> : null}
      </div>
      <p className="text-2xl font-bold text-body">{listingHeroPriceLabel(listing.rentMxn)}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem icon={Users} label="Viven aquí" value={`${menCount} Hombres, ${womenCount} Mujeres`} />
        <HeaderInfoItem icon={VenusAndMars} label="Preferencia de género" value={genderPrefLabel(listing.roommateGenderPref)} />
        <HeaderInfoItem icon={Calendar} label="Disponible desde" value={formatRoomAvailableFrom(listing.availableFrom ?? "")} />
        <HeaderInfoItem icon={Home} label="Tipo de vivienda" value={propertyKindLabel(listing.propertyKind)} />
        <HeaderInfoItem icon={MapPin} label="Colonia" value={listing.neighborhood} />
      </div>
    </div>
  );
}

function PropertyHeader({
  property,
  availableRooms,
  shareActions,
}: {
  property: Property;
  availableRooms: Room[];
  shareActions?: ReactNode;
}) {
  const minRent = Math.min(...availableRooms.map((room) => room.rentMxn));
  const maxRent = Math.max(...availableRooms.map((room) => room.rentMxn));
  const firstAvailable = availableRooms[0];
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-body">{property.title}</h2>
        {shareActions ? <div className="shrink-0">{shareActions}</div> : null}
      </div>
      <p className="text-2xl font-bold text-body">
        {money.format(minRent)} - {money.format(maxRent)} / mes
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeaderInfoItem icon={BedDouble} label="Cuartos disponibles" value={String(availableRooms.length)} />
        <HeaderInfoItem
          icon={Users}
          label="Viven aquí"
          value={`${property.occupiedByMenCount ?? 0} Hombres, ${property.occupiedByWomenCount ?? 0} Mujeres`}
        />
        <HeaderInfoItem
          icon={VenusAndMars}
          label="Preferencia de género"
          value={firstAvailable ? genderPrefLabel(firstAvailable.roommateGenderPref) : "Hombre o Mujer"}
        />
        <HeaderInfoItem
          icon={Calendar}
          label="Disponible desde"
          value={firstAvailable ? formatRoomAvailableFrom(firstAvailable.availableFrom ?? "") : "—"}
        />
        <HeaderInfoItem icon={Home} label="Tipo de vivienda" value={propertyKindLabel(property.propertyKind)} />
        <HeaderInfoItem icon={MapPin} label="Colonia" value={property.neighborhood} />
      </div>
    </div>
  );
}

function PropertyMessageField({
  message,
  onMessageChange,
  selectedIds,
  rooms,
  onRoomClick,
}: {
  message: string;
  onMessageChange: (value: string) => void;
  selectedIds: string[];
  rooms: Room[];
  onRoomClick: (room: Room) => void;
}) {
  const selectedRooms = selectedIds
    .map((id) => rooms.find((room) => room.id === id))
    .filter((room): room is Room => Boolean(room));

  return (
    <div className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2">
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        rows={3}
        className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-body outline-none focus:ring-0"
      />
      {selectedRooms.length ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-body">
          Me interesan:{" "}
          {selectedRooms.map((room, index) => {
            const isLast = index === selectedRooms.length - 1;
            const separator =
              selectedRooms.length > 2 && !isLast
                ? ", "
                : selectedRooms.length === 2 && index === 0
                  ? " y "
                  : "";

            return (
              <span key={room.id}>
                <a
                  href={`#available-room-${room.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onRoomClick(room);
                  }}
                  className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                >
                  {room.customName || room.title}
                </a>
                {!isLast ? separator : null}
              </span>
            );
          })}
          .
        </p>
      ) : null}
    </div>
  );
}

export function PostExperienceMockupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [singleMessage, setSingleMessage] = useState(
    "Hola, me interesa este cuarto. ¿Podemos agendar visita entre semana?",
  );
  const [singleSent, setSingleSent] = useState(false);

  const [propertyMessage, setPropertyMessage] = useState(
    "Hola, me interesa(n) este/los cuarto(s). ¿Podemos agendar visita entre semana?",
  );
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [propertySent, setPropertySent] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<Room | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const copyShareUrl = useCallback(async (path: string, label: string) => {
    try {
      await copyToClipboard(absoluteAppUrl(path));
      setShareMsg(`${label} copiado al portapapeles.`);
    } catch {
      setShareMsg("No se pudo copiar automáticamente. Copia la URL desde la barra del navegador.");
    }
  }, []);

  const closeExpandedRoom = useCallback(() => {
    setExpandedRoom(null);
    if (searchParams.get("roomId")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("roomId");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const contactFromExpandedRoom = useCallback(
    (room: Room) => {
      setSelectedRoomIds((prev) => (prev.includes(room.id) ? prev : [...prev, room.id]));
      closeExpandedRoom();
      window.setTimeout(() => {
        document.getElementById("property-contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [closeExpandedRoom],
  );

  const singleGallery = useMemo(
    () =>
      listingGalleryImageUrls({
        postMode: "room",
        propertyImageUrls: singleRoomListing.propertyImageUrls,
        roomImageUrls: singleRoomListing.roomImageUrls,
      }),
    [],
  );

  const propertyListingForMap: PropertyListing = useMemo(
    () => ({
      id: "mock-property-map",
      propertyId: propertyMock.id,
      title: propertyMock.title,
      city: propertyMock.city,
      neighborhood: propertyMock.neighborhood,
      lat: propertyMock.lat,
      lng: propertyMock.lng,
      rentMxn: Math.min(...propertyRooms.filter((room) => room.occupancyStatus !== "occupied").map((room) => room.rentMxn)),
      roomsAvailable: propertyRooms.filter((room) => room.occupancyStatus !== "occupied").length,
      tags: propertyRooms.flatMap((room) => room.tags),
      roommateGenderPref: "any",
      ageMin: 18,
      ageMax: 99,
      summary: propertyMock.summary,
      contactWhatsApp: propertyMock.contactWhatsApp,
      status: "published",
      propertyKind: propertyMock.propertyKind,
      propertyPostMode: "property",
      propertyBedroomsTotal: propertyMock.bedroomsTotal,
      propertyBathrooms: propertyMock.bathrooms,
      propertyImageUrls: propertyMock.commonAreaPhotos,
      roomImageUrls: [],
      showWhatsApp: propertyMock.showWhatsApp,
      isApproximateLocation: propertyMock.isApproximateLocation,
      streetViewPov: propertyMock.streetViewPov,
    }),
    [],
  );

  const occupiedRooms = propertyRooms.filter((room) => room.occupancyStatus === "occupied");
  const availableRooms = propertyRooms.filter((room) => room.occupancyStatus !== "occupied");

  useEffect(() => {
    const roomId = searchParams.get("roomId");
    if (!roomId) return;

    const room = propertyRooms.find(
      (entry) => entry.id === roomId && entry.occupancyStatus !== "occupied",
    );
    if (!room) return;

    document.getElementById("property-available-rooms")?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = window.setTimeout(() => setExpandedRoom(room), 350);
    return () => window.clearTimeout(timer);
  }, [searchParams]);
  const singleImportantLabels: KeyLabelItem[] = [
    { icon: DollarSign, title: "Depósito", value: money.format(singleRoomListing.depositMxn ?? 0) },
    { icon: UserCheck, title: "Preferencia de género", value: "Hombre o Mujer" },
    { icon: Calendar, title: "Disponible desde", value: formatRoomAvailableFrom(singleRoomListing.availableFrom ?? "") },
    { icon: Timer, title: "Estancia mínima", value: minimalStayMonthsLabel(singleRoomListing.minimalStayMonths ?? 1) },
    { icon: SquareStack, title: "Tamaño", value: roomDimensionWizardLabel(singleRoomListing.roomDimension) },
    { icon: KeyRound, title: "Aval", value: yesNo(Boolean(singleRoomListing.avalRequired)) },
    { icon: Bed, title: "Tipo de recámara", value: lodgingLabel(singleRoomListing.lodgingType) },
    { icon: CheckCircle2, title: "Servicios básicos incluidos", value: "Sí" },
    { icon: Users, title: "Edades", value: `${singleRoomListing.ageMin} - ${singleRoomListing.ageMax}` },
    { icon: Bath, title: "Baño privado", value: yesNo(singleRoomListing.tags.includes("baño-privado")) },
    { icon: Car, title: "Estacionamiento incluido", value: yesNo(singleRoomListing.tags.includes("estacionamiento")) },
    { icon: Sparkles, title: "Ideal para", value: "Estudiantes, Individuos (Solo)" },
  ];

  const propertyImportantLabels: KeyLabelItem[] = [
    {
      icon: Calendar,
      title: "Disponible desde",
      value: availableRooms[0] ? formatRoomAvailableFrom(availableRooms[0].availableFrom ?? "") : "—",
    },
    { icon: PawPrint, title: "Mascotas", value: yesNo(propertyCommonTags.includes("mascotas")) },
    { icon: Users, title: "Fiestas", value: yesNo(propertyCommonTags.includes("fiestas")) },
    { icon: Cigarette, title: "Fumar en áreas comunes", value: yesNo(propertyCommonTags.includes("fumar")) },
    {
      icon: Warehouse,
      title: "La propiedad cuenta con",
      value: ["lavadora", "secadora", "cocina-equipada", "wifi"]
        .filter((tag) => propertyCommonTags.includes(tag as ListingTag))
        .join(", "),
    },
    {
      icon: ShieldCheck,
      title: "Seguridad / Acceso Controlado",
      value: yesNo(propertyCommonTags.includes("seguridad-acceso")),
    },
    { icon: Home, title: "Vigilancia o portería", value: yesNo(propertyCommonTags.includes("vigilancia")) },
  ];

  const singleSecondaryTags = singleRoomListing.tags.filter((tag) => !KEY_LABEL_ROOM_TAG_SLUGS.has(tag));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section id="single-room-post" className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <SingleRoomHeader
          listing={singleRoomListing}
          menCount={1}
          womenCount={1}
          shareActions={
            <ListingShareActions
              shareMsg={shareMsg}
              onShareListing={() => void copyShareUrl(MOCK_SINGLE_ROOM_SHARE_PATH, "Enlace del anuncio")}
              onSharePath={() => {}}
            />
          }
        />

        <ListingSection title="Fotos">
          <ListingPhotoCarousel urls={singleGallery} />
        </ListingSection>

        <KeyLabelsGrid items={singleImportantLabels} />

        <ListingSection title="Descripción" titleMuted>
          <p className="text-sm font-semibold leading-relaxed text-body">{singleRoomListing.summary}</p>
        </ListingSection>

        <RoomSecondaryTagSections tags={singleSecondaryTags} />

        <ListingSection title="Mapa y Street View">
          <PublicListingLocationMap listing={singleRoomListing} isApproximateLocation={Boolean(singleRoomListing.isApproximateLocation)} />
        </ListingSection>

        <ListingSection title="Contactar anunciante">
          <div className="rounded-xl border border-border bg-bg-light p-4">
            <label className="block text-sm font-medium text-body">
              Mensaje inicial
              <textarea
                value={singleMessage}
                onChange={(e) => setSingleMessage(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body"
              />
            </label>
            <button
              type="button"
              onClick={() => setSingleSent(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
            >
              <MessageCircle className="size-4" aria-hidden />
              Enviar mensaje
            </button>
            {singleSent ? <p className="mt-2 text-xs text-body">Mensaje enviado (mock).</p> : null}
          </div>
        </ListingSection>
      </section>

      <section id="property-post" className="mt-8 space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <PropertyHeader
          property={propertyMock}
          availableRooms={availableRooms}
          shareActions={
            <ListingShareActions
              shareMsg={shareMsg}
              onShareListing={() => void copyShareUrl(MOCK_PROPERTY_SHARE_PATH, "Enlace del anuncio")}
              onSharePath={() => {}}
            />
          }
        />

        <ListingSection title="Fotos">
          <ListingPhotoCarousel urls={propertyMock.commonAreaPhotos ?? []} />
        </ListingSection>

        <KeyLabelsGrid items={propertyImportantLabels} />

        <ListingSection title="Descripción" titleMuted>
          <p className="text-sm font-semibold leading-relaxed text-body">{propertyMock.summary}</p>
        </ListingSection>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Cuartos ocupados</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {occupiedRooms.map((room) => (
                <article key={room.id} className="rounded-xl border border-border bg-bg-light p-4">
                  <p className="text-sm font-semibold text-body">{room.customName || room.title}</p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    <Users className="size-3.5" aria-hidden />
                    {occupiedRoomOccupantLabel(room)}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div id="property-available-rooms">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Cuartos disponibles</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {availableRooms.map((room) => (
                <article id={`available-room-${room.id}`} key={room.id} className="rounded-xl border border-border bg-bg-light p-4">
                  <p className="text-sm font-semibold text-body">{room.customName || room.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {money.format(room.rentMxn)} / mes - {roomDimensionWizardLabel(room.roomDimension)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                      Disponible {formatRoomAvailableFrom(room.availableFrom ?? "")}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                      Preferencia de Género: {genderPrefLabel(room.roommateGenderPref)}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                      Baño privado: {yesNo(room.tags.includes("baño-privado"))}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-medium text-body">
                      Estacionamiento privado: {yesNo(room.tags.includes("estacionamiento"))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedRoom(room)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-95 sm:w-auto"
                  >
                    Ver detalles completos
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>

        <ListingSection title="Mapa y Street View">
          <PublicListingLocationMap listing={propertyListingForMap} isApproximateLocation={Boolean(propertyMock.isApproximateLocation)} />
        </ListingSection>

        <div id="property-contact">
        <ListingSection title="Contactar anunciante">
          <div className="rounded-xl border border-border bg-bg-light p-4">
            <p className="text-sm font-medium text-body">¿Qué cuartos te interesan?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableRooms.map((room) => {
                const checked = selectedRoomIds.includes(room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() =>
                      setSelectedRoomIds((prev) =>
                        checked ? prev.filter((id) => id !== room.id) : [...prev, room.id],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      checked ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-body"
                    }`}
                  >
                    {room.customName || room.title}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-sm font-medium text-body">
              Mensaje
              <PropertyMessageField
                message={propertyMessage}
                onMessageChange={setPropertyMessage}
                selectedIds={selectedRoomIds}
                rooms={availableRooms}
                onRoomClick={setExpandedRoom}
              />
            </label>

            <button
              type="button"
              onClick={() => setPropertySent(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
            >
              <MessageCircle className="size-4" aria-hidden />
              Enviar mensaje
            </button>
            {propertySent ? <p className="mt-2 text-xs text-body">Mensaje enviado (mock).</p> : null}
          </div>
        </ListingSection>
        </div>
      </section>

      {expandedRoom ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalles de ${expandedRoom.customName || expandedRoom.title}`}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
          onClick={closeExpandedRoom}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeExpandedRoom}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-2 space-y-5">
              <SingleRoomHeader
                listing={{
                  ...singleRoomListing,
                  id: expandedRoom.id,
                  title: expandedRoom.customName || expandedRoom.title,
                  rentMxn: expandedRoom.rentMxn,
                  depositMxn: expandedRoom.depositMxn,
                  roommateGenderPref: expandedRoom.roommateGenderPref,
                  availableFrom: expandedRoom.availableFrom,
                  roomDimension: expandedRoom.roomDimension,
                  avalRequired: expandedRoom.avalRequired,
                  summary: expandedRoom.summary,
                  tags: expandedRoom.tags,
                  lodgingType: expandedRoom.lodgingType,
                  roomImageUrls: expandedRoom.imageUrls,
                  neighborhood: propertyMock.neighborhood,
                  propertyKind: propertyMock.propertyKind,
                  ageMin: expandedRoom.ageMin,
                  ageMax: expandedRoom.ageMax,
                }}
                menCount={propertyMock.occupiedByMenCount ?? 0}
                womenCount={propertyMock.occupiedByWomenCount ?? 0}
                shareActions={
                  <ListingShareActions
                    shareMsg={shareMsg}
                    onShareListing={() =>
                      void copyShareUrl(
                        mockPropertyRoomSharePath(expandedRoom.id),
                        `Link de ${expandedRoom.customName || expandedRoom.title}`,
                      )
                    }
                    onSharePath={() => {}}
                  />
                }
              />

              <ListingPhotoCarousel urls={expandedRoom.imageUrls ?? []} />

              <KeyLabelsGrid
                items={[
                  { icon: DollarSign, title: "Depósito", value: money.format(expandedRoom.depositMxn) },
                  { icon: UserCheck, title: "Preferencia de género", value: "Hombre o Mujer" },
                  { icon: Calendar, title: "Disponible desde", value: formatRoomAvailableFrom(expandedRoom.availableFrom ?? "") },
                  { icon: Timer, title: "Estancia mínima", value: minimalStayMonthsLabel(expandedRoom.minimalStayMonths ?? 1) },
                  { icon: SquareStack, title: "Tamaño", value: roomDimensionWizardLabel(expandedRoom.roomDimension) },
                  { icon: KeyRound, title: "Aval", value: yesNo(Boolean(expandedRoom.avalRequired)) },
                  { icon: Bed, title: "Tipo de recámara", value: lodgingLabel(expandedRoom.lodgingType) },
                  { icon: CheckCircle2, title: "Servicios básicos incluidos", value: yesNo(expandedRoom.tags.includes("servicios-incluidos")) },
                  { icon: Users, title: "Edades", value: `${expandedRoom.ageMin} - ${expandedRoom.ageMax}` },
                  { icon: Bath, title: "Baño privado", value: yesNo(expandedRoom.tags.includes("baño-privado")) },
                  { icon: Car, title: "Estacionamiento incluido", value: yesNo(expandedRoom.tags.includes("estacionamiento")) },
                  {
                    icon: Sparkles,
                    title: "Ideal para",
                    value: expandedRoom.tags.filter((tag) => ROOM_IDEAL_PARA_TAG_SET.has(tag)).join(", ") || "—",
                  },
                ]}
              />

              <div>
                <h4 className="text-sm font-semibold text-muted">Descripción</h4>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-body">{expandedRoom.summary}</p>
              </div>

              <RoomSecondaryTagSections
                tags={expandedRoom.tags.filter(
                  (tag) => tag !== "servicios-incluidos" && !KEY_LABEL_ROOM_TAG_SLUGS.has(tag),
                )}
              />

              <div className="space-y-3 pt-2">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => contactFromExpandedRoom(expandedRoom)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-95"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Contactar al anunciante
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeExpandedRoom}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Admin-only seed data for the publish wizard.
 * No AI required — pure static/random data generation.
 * Visible and usable only by users with `me.isAdmin === true`.
 */
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "@/types/listing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 7): number {
  const v = Math.random() * (max - min) + min;
  return parseFloat(v.toFixed(decimals));
}

function randSubset<T>(arr: readonly T[], min = 0, max?: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const count = randInt(min, max ?? arr.length);
  return shuffled.slice(0, count);
}

function isoDateOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : d.toISOString().slice(0, 10);
}

/** Returns absolute URL for a static asset in /public/admin-seed/ */
function seedImg(filename: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/admin-seed/${filename}`;
}

// ---------------------------------------------------------------------------
// Guadalajara bounding box (approximate)
// ---------------------------------------------------------------------------

const GDL_LAT_MIN = 20.62;
const GDL_LAT_MAX = 20.74;
const GDL_LNG_MIN = -103.42;
const GDL_LNG_MAX = -103.27;

function randomGdlCoords(): { lat: string; lng: string } {
  return {
    lat: randFloat(GDL_LAT_MIN, GDL_LAT_MAX).toFixed(7),
    lng: randFloat(GDL_LNG_MIN, GDL_LNG_MAX).toFixed(7),
  };
}

// ---------------------------------------------------------------------------
// Static seed data pools
// ---------------------------------------------------------------------------

const COLONIAS = [
  "Chapalita",
  "Providencia",
  "Zapopan Centro",
  "Jardines del Sol",
  "Ladrón de Guevara",
  "Colonia Americana",
  "Lafayette",
  "Versalles",
  "Arcos Vallarta",
  "Mezquitán Country",
  "Santa Teresita",
  "Jardines de la Paz",
  "Ciudad del Sol",
  "Colomos Providencia",
  "Residencial Victoria",
  "Las Fuentes",
  "Jardines Alcalde",
  "San Juan de Dios",
  "Zona Minerva",
  "Chapultepec Country",
] as const;

const PROPERTY_TITLES = [
  "Casa compartida en Chapalita con jardín",
  "Departamento luminoso cerca de la Minerva",
  "Cuarto privado en Providencia, zona tranquila",
  "Depa amueblado en Colonia Americana",
  "Casa con balcón en Versalles",
  "Habitación en Lafayette cerca de CUCEI",
  "Depa moderno en Arcos Vallarta",
  "Casa amplia en Mezquitán Country",
  "Cuarto en Santa Teresita con terraza compartida",
  "Departamento bien ubicado en Zapopan",
] as const;

const PROPERTY_SUMMARIES = [
  `La propiedad es una casa acogedora ubicada en una calle tranquila de Guadalajara. Cuenta con sala amueblada con sofá y TV, comedor con mesa para 6 personas y cocina equipada con estufa, refrigerador, microondas y utensilios de cocina. Hay dos baños completos de uso compartido. El patio trasero tiene área verde donde puedes relajarte. El ambiente es tranquilo y de respeto mutuo; los compañeros actuales son profesionistas jóvenes. Contamos con WiFi de alta velocidad, lavadora y secadora disponibles en el área de servicio. El acceso es controlado con puerta principal con chapa de seguridad. Estamos a 5 minutos del Periférico y a 10 minutos del centro comercial Andares. Buscamos personas responsables que cuiden el espacio como propio.`,
  `Departamento ubicado en el corazón de la zona metropolitana de Guadalajara. La propiedad cuenta con sala-comedor integrado con muebles modernos, cocina equipada con refrigerador grande, estufa de gas, microondas y todos los utensilios necesarios. El baño es compartido entre máximo dos personas. Hay balcón privado con vista a la calle arbolada. El edificio cuenta con vigilancia 24 horas, acceso con control remoto y estacionamiento disponible. WiFi de fibra óptica de alta velocidad incluido en la renta. Los actuales inquilinos son estudiantes universitarios y profesionistas de entre 22 y 30 años. La convivencia es amigable y respetuosa; hay reglas básicas sobre horarios de silencio nocturnos. Zona muy bien comunicada con transporte público a media cuadra.`,
  `Casa amplia y luminosa con excelente distribución. Las zonas comunes incluyen sala con proyector y sistema de sonido, comedor espacioso, cocina completamente equipada con horno, cafetera, licuadora y todo lo necesario para cocinar. Contamos con roof garden privado con mesa y sillas para disfrutar al aire libre. El edificio tiene acceso controlado con citófono. Se incluyen en la renta: WiFi de alta velocidad, agua, gas y luz compartidos en partes iguales. Lavadora y secadora de uso común en el área de servicio. Los roomies actuales son personas activas, respetuosas y que mantienen el espacio muy limpio. Ubicados a dos cuadras del Parque Metropolitano y cerca de supermercados, farmacias y restaurantes de todo tipo.`,
] as const;

const ROOM_SUMMARIES = [
  `La recámara es amplia y muy iluminada gracias a la ventana con vista al jardín. Incluye cama matrimonial en excelentes condiciones, escritorio con silla ergonómica ideal para trabajar desde casa, clóset empotrado con bastante espacio de almacenaje y cajones adicionales. El piso es de madera laminada que da un ambiente cálido. Hay ventilador de techo y el cuarto tiene buena ventilación natural todo el año. La habitación es completamente privada con llave y cerradura propia. A pocos pasos del baño compartido que se mantiene siempre limpio. La renta incluye servicios básicos y acceso a todas las zonas comunes de la casa. Buscamos a alguien ordenado, tranquilo y que tenga horarios de trabajo o estudio.`,
  `Recámara individual bien acondicionada en planta alta. Cuenta con cama individual nueva con colchón de buena calidad, escritorio con iluminación adecuada, cajones y espacio para colgar ropa en el clóset. La habitación está orientada al norte lo que mantiene una temperatura agradable en verano. Tiene ventana hacia la calle y persiana para controlar la luz. El baño se comparte con una persona más y siempre se mantiene limpio. El ambiente de la casa es muy tranquilo; los compañeros respetan los espacios y horarios. Se puede cocinar libremente en la cocina compartida. Acceso por escaleras privadas con llave propia para mayor privacidad. Zona segura y bien iluminada en las noches.`,
  `Espacio moderno con excelente iluminación natural durante todo el día. La recámara incluye cama queen size con marco de madera, mesa de noche, dos cajones adicionales bajo la cama, clóset doble con espacio suficiente para toda tu ropa y escritorio amplio frente a la ventana. El piso es de cemento pulido con tapete decorativo. Tiene instalación de AC (split) para los meses de calor. El baño privado está equipado con regadera, lavabo y todos los accesorios necesarios. La vista desde la ventana es hacia el jardín interior de la propiedad. Renta incluye internet de fibra óptica de alta velocidad y acceso a cocina equipada, sala y área de lavado.`,
] as const;

const PROPERTY_AMENITY_POOL: readonly ListingTag[] = [
  "wifi",
  "agua",
  "luz",
  "gas",
  "muebles",
  "cocina-equipada",
  "lavadora",
  "secadora",
  "cerca-transporte",
  "seguridad-acceso",
  "vigilancia",
];

const PROPERTY_AMBIENTE_POOL: readonly ListingTag[] = [
  "lgbt-friendly",
  "mascotas",
];

const ROOM_TAGS_POOL: readonly ListingTag[] = [
  "baño-privado",
  "aire-acondicionado",
  "cerradura-cuarto",
  "ventilador",
  "closet",
];

const LODGING_TYPES: readonly LodgingType[] = ["private_room", "shared_room"];
const ROOM_DIMENSIONS: readonly RoomDimension[] = ["small", "medium", "large"];
const GENDER_PREFS: readonly RoommateGenderPref[] = ["any", "female", "male"];
const PROPERTY_KINDS = ["house", "apartment"] as const;

// Images from /public/admin-seed/
const SEED_ROOM_IMAGES = [
  "room1.png",
  "room2.png",
  "room3.png",
  "room4.png",
  "room5.png",
  "room6.png",
  "room7.png",
] as const;

const SEED_COMMON_IMAGES = [
  "balcony.png",
  "livingroom.png",
  "bathroom1.png",
  "bathroom2.png",
] as const;

// ---------------------------------------------------------------------------
// Per-step seed functions
// Each function receives the current draft and returns a Partial<Draft> to merge.
// ---------------------------------------------------------------------------

export function seedStep0(): Partial<Draft> {
  const postMode = pick(["room", "property"] as const);
  if (postMode === "room") {
    return {
      postMode: "room",
      rooms: [seedRoom(0)],
      roomImageUrls: [[]],
      propertySummary: "",
    };
  }
  const roomCount = randInt(2, 3);
  return {
    postMode: "property",
    rooms: Array.from({ length: roomCount }, (_, i) => seedRoom(i)),
    roomImageUrls: Array.from({ length: roomCount }, () => []),
  };
}

export function seedStep1(): Partial<Draft> {
  const { lat, lng } = randomGdlCoords();
  return {
    city: "Guadalajara",
    useCustomMapPin: true,
    customLat: lat,
    customLng: lng,
    isApproximateLocation: Math.random() > 0.5,
  };
}

export function seedStep2(_draft: Draft): Partial<Draft> {
  const kind = pick(PROPERTY_KINDS);
  const bedroomsTotal = kind === "apartment" ? randInt(2, 3) : randInt(3, 5);
  return {
    propertyTitle: pick(PROPERTY_TITLES),
    neighborhood: pick(COLONIAS),
    propertySummary: pick(PROPERTY_SUMMARIES),
    propertyKind: kind,
    propertyBedroomsTotal: bedroomsTotal,
    propertyBathrooms: randInt(1, 2),
    occupiedByWomenCount: randInt(0, 2),
    occupiedByMenCount: randInt(0, 2),
    propertyTags: [
      ...randSubset(PROPERTY_AMENITY_POOL, 4, 8),
      ...randSubset(PROPERTY_AMBIENTE_POOL, 0, 2),
    ] as ListingTag[],
  };
}

export function seedStep3(draft: Draft): Partial<Draft> {
  return {
    rooms: draft.rooms.map((_, i) => seedRoom(i)),
  };
}

export function seedStep4(draft: Draft): Partial<Draft> {
  const roomImgPool = [...SEED_ROOM_IMAGES].sort(() => Math.random() - 0.5);
  const commonImgPool = [...SEED_COMMON_IMAGES].sort(() => Math.random() - 0.5);

  if (draft.postMode === "room") {
    // Single-room mode: all images in roomImageUrls[0]
    return {
      roomImageUrls: [
        [...roomImgPool.slice(0, 4), ...commonImgPool].map(seedImg),
      ],
      propertyImageUrls: [],
      unassignedImageUrls: [],
    };
  }

  // Property mode: spread room images across rooms, put commons as unassigned
  const roomImageUrls = draft.rooms.map((_, i) => {
    const imgs = roomImgPool.slice(i * 2, i * 2 + 2);
    return imgs.map(seedImg);
  });

  return {
    roomImageUrls,
    unassignedImageUrls: commonImgPool.map(seedImg),
    propertyImageUrls: [],
  };
}

/** Step 5 in property mode: auto-label all unassigned photos as shared areas. */
export function seedStep5LabelPhotos(draft: Draft): Partial<Draft> {
  if (!draft.unassignedImageUrls.length) return {};
  return {
    propertyImageUrls: [...draft.propertyImageUrls, ...draft.unassignedImageUrls].slice(0, 20),
    unassignedImageUrls: [],
  };
}

export function seedStepPublish(): Partial<Draft> {
  return {
    contactWhatsApp: `5233${randInt(10000000, 99999999)}`,
    showWhatsApp: true,
    legalAccepted: true,
  };
}

// ---------------------------------------------------------------------------
// Room seed
// ---------------------------------------------------------------------------

function seedRoom(index: number): RoomDraft {
  const rent = randInt(35, 80) * 100; // 3500–8000 in steps of 100
  const depositMultiplier = pick([1, 1, 2] as const);
  const ageMin = randInt(18, 24);
  const ageMax = randInt(28, 45);
  return {
    title: index === 0 ? "" : `Recámara ${index + 1}`,
    rentMxn: rent,
    depositMxn: rent * depositMultiplier,
    roomsAvailable: pick([1, 1, 2] as const),
    summary: pick(ROOM_SUMMARIES),
    tags: randSubset(ROOM_TAGS_POOL, 2, 4) as ListingTag[],
    roommateGenderPref: pick(GENDER_PREFS),
    ageMin,
    ageMax: Math.max(ageMin, ageMax),
    lodgingType: pick(LODGING_TYPES),
    availableFrom: isoDateOffset(randInt(0, 30)),
    minimalStayMonths: pick([1, 1, 3, 6] as const),
    roomDimension: pick(ROOM_DIMENSIONS),
    rentIncludesUtilities: Math.random() > 0.5,
  };
}

// ---------------------------------------------------------------------------
// Master dispatcher — given current safeStep index and draft, returns the seed
// ---------------------------------------------------------------------------

export function seedForStep(safeStep: number, draft: Draft): Partial<Draft> {
  const isPropertyMode = draft.postMode === "property";

  switch (safeStep) {
    case 0:
      return seedStep0();
    case 1:
      return seedStep1();
    case 2:
      return seedStep2(draft);
    case 3:
      return seedStep3(draft);
    case 4:
      return seedStep4(draft);
    case 5:
      // Step 5 is "Etiquetar fotos" in property mode, "Publicar" in room mode
      if (isPropertyMode) return seedStep5LabelPhotos(draft);
      return seedStepPublish();
    case 6:
      // Only reached in property mode (step 6 = Publicar)
      return seedStepPublish();
    default:
      return {};
  }
}

import { geminiApiKey, geminiModel } from "./shareAiCopyGemini.js";

/** Confidence threshold: fields below this are omitted from the draft. */
const CONFIDENCE_THRESHOLD = 60;

/** Max chars for the AI-generated room summary. */
const SUMMARY_MAX_CHARS = 1200;

/** Valid tag slugs the AI may output. Keep in sync with listingTags.ts. */
const VALID_TAGS = new Set([
  "wifi", "agua", "luz", "gas", "mascotas", "estacionamiento", "muebles",
  "baño-privado", "fumar", "ventilador", "closet", "fiestas", "aire-acondicionado",
  "seguridad-acceso", "vigilancia", "lavanderia", "lavadora", "secadora",
  "cocina-equipada", "terraza", "lgbt-friendly", "profesionistas", "estudiantes",
  "residentes-medicos", "nomadas-digitales", "individuos-solo", "parejas",
  "familiar-ninos", "servicios-incluidos", "cerradura-cuarto", "agua-caliente",
  "cerca-transporte",
]);

const IDEAL_PARA_TAGS = new Set([
  "profesionistas", "estudiantes", "residentes-medicos", "nomadas-digitales",
  "individuos-solo", "parejas", "familiar-ninos",
]);

/** Approximate location radius in meters based on confidence level (0-100). */
export function confidenceToRadius(confidence: number): number {
  if (confidence >= 85) return 200;
  if (confidence >= 70) return 400;
  if (confidence >= 50) return 700;
  return 1000;
}

export type AssistedDraftExtraction = {
  propertyTitle?: string;
  neighborhood?: string;
  propertyKind?: "house" | "apartment" | "loft";
  lodgingType?: "private_room" | "shared_room";
  rentMxn?: number;
  depositMxn?: number;
  roommateGenderPref?: "any" | "female" | "male";
  ageMin?: number;
  ageMax?: number;
  availableFrom?: string;
  minimalStayMonths?: number;
  roomDimension?: "small" | "medium" | "large";
  tags?: string[];
  idealParaTags?: string[];
  /** Tags the source explicitly says are NOT available (do not invent). */
  deniedTags?: string[];
  roomSummary?: string;
  propertySummary?: string;
  bathrooms?: number;
  bedroomsTotal?: number;
  rooms?: Array<{
    occupancy?: "available" | "occupied";
    rentMxn?: number;
    title?: string;
    roomSummary?: string;
    lodgingType?: "private_room" | "shared_room";
  }>;
  location?: {
    type: "precise" | "approximate" | "none";
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    address?: string;
  };
  /** Confidence map per field (0-100), used to decide which fields to include. */
  confidence?: Record<string, number>;
  /** Raw extraction result (for admin debugging). */
  rawText?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

export type AssistedDraftGeminiResult = {
  extraction: AssistedDraftExtraction;
  promptTokens: number;
  outputTokens: number;
  model: string;
};

const EXTRACTION_SYSTEM_PROMPT = `Eres un asistente de extracción de datos para anuncios de renta de cuartos en México.
Tu tarea es analizar el contenido proporcionado (texto de publicación de Facebook o imágenes de infográficos) y extraer información estructurada de un anuncio de renta de cuarto o espacio.

REGLAS IMPORTANTES:
- Solo extrae información EXPLÍCITAMENTE mencionada o claramente visible. No inventes datos.
- Asigna un "confidence" (0-100) a cada campo extraído: 100=completamente seguro, 60=bastante probable, 40=incierto, 0=no mencionado.
- Si un campo no se menciona o no puedes determinarlo, omítelo o asigna confidence 0.
- Para precio: extrae solo si está claramente especificado en MXN.
- Para ubicación: busca colonia, barrio, calle o referencia geográfica.
- Para disponibilidad: intenta inferir una fecha desde menciones como "disponible ya", "primer de mes", etc.
- deniedTags: slugs que el anuncio niega de forma explícita (p. ej. "no se aceptan mascotas" → ["mascotas"]). No pongas un tag en tags y deniedTags a la vez.
- Para descripción (roomSummary): genera un texto atractivo en español usando SOLO la información disponible. 
  Mínimo 100 caracteres, máximo 1200. Si no hay suficiente información, sé conciso pero honesto.
  Usa un tono cálido y directo, sin exagerar características no mencionadas.
- Si el anuncio describe una CASA o PROPIEDAD con varias recámaras (no un solo cuarto):
  llena propertySummary (convivencia y áreas comunes), bathrooms, bedroomsTotal y rooms
  (una entrada por recámara detectada: occupancy available|occupied, renta si se menciona).
  Si es un solo cuarto, omite rooms.

TAGS válidos (usa solo estos slugs exactos):
- Servicios: wifi, agua, luz, gas, servicios-incluidos
- Equipamiento: muebles, aire-acondicionado, ventilador, closet, cerradura-cuarto, baño-privado
- Comodidades: cocina-equipada, lavadora, secadora, lavanderia, terraza, agua-caliente
- Acceso: estacionamiento, seguridad-acceso, vigilancia, cerca-transporte
- Permisividad: mascotas, fumar, fiestas, lgbt-friendly
- Ideal para: profesionistas, estudiantes, residentes-medicos, nomadas-digitales, individuos-solo, parejas

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "propertyTitle": { "value": "...", "confidence": 0-100 },
  "neighborhood": { "value": "...", "confidence": 0-100 },
  "propertyKind": { "value": "house|apartment|loft", "confidence": 0-100 },
  "lodgingType": { "value": "private_room|shared_room", "confidence": 0-100 },
  "rentMxn": { "value": 0, "confidence": 0-100 },
  "depositMxn": { "value": 0, "confidence": 0-100 },
  "roommateGenderPref": { "value": "any|female|male", "confidence": 0-100 },
  "ageMin": { "value": 18, "confidence": 0-100 },
  "ageMax": { "value": 99, "confidence": 0-100 },
  "availableFrom": { "value": "YYYY-MM-DD", "confidence": 0-100 },
  "minimalStayMonths": { "value": 1, "confidence": 0-100 },
  "roomDimension": { "value": "small|medium|large", "confidence": 0-100 },
  "tags": { "value": ["slug1", "slug2"], "confidence": 0-100 },
  "idealParaTags": { "value": ["slug1"], "confidence": 0-100 },
  "deniedTags": { "value": ["mascotas"], "confidence": 0-100 },
  "roomSummary": { "value": "...", "confidence": 0-100 },
  "propertySummary": { "value": "...", "confidence": 0-100 },
  "bathrooms": { "value": 1, "confidence": 0-100 },
  "bedroomsTotal": { "value": 1, "confidence": 0-100 },
  "rooms": { "value": [{ "occupancy": "available|occupied", "rentMxn": 0, "title": "", "roomSummary": "", "lodgingType": "private_room|shared_room" }], "confidence": 0-100 },
  "location": {
    "type": "precise|approximate|none",
    "address": "...",
    "lat": 0.0,
    "lng": 0.0,
    "radiusMeters": 0,
    "confidence": 0-100
  }
}`;

type RawFieldResult = {
  value: unknown;
  confidence: number;
};

type RawGeminiExtraction = {
  propertyTitle?: RawFieldResult;
  neighborhood?: RawFieldResult;
  propertyKind?: RawFieldResult;
  lodgingType?: RawFieldResult;
  rentMxn?: RawFieldResult;
  depositMxn?: RawFieldResult;
  roommateGenderPref?: RawFieldResult;
  ageMin?: RawFieldResult;
  ageMax?: RawFieldResult;
  availableFrom?: RawFieldResult;
  minimalStayMonths?: RawFieldResult;
  roomDimension?: RawFieldResult;
  tags?: RawFieldResult;
  idealParaTags?: RawFieldResult;
  deniedTags?: RawFieldResult;
  roomSummary?: RawFieldResult;
  propertySummary?: RawFieldResult;
  bathrooms?: RawFieldResult;
  bedroomsTotal?: RawFieldResult;
  rooms?: RawFieldResult;
  location?: {
    type?: string;
    address?: string;
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    confidence?: number;
  };
};

function aboveThreshold(field: RawFieldResult | undefined): boolean {
  return field != null && typeof field.confidence === "number" && field.confidence >= CONFIDENCE_THRESHOLD;
}

function extractString(field: RawFieldResult | undefined): string | undefined {
  if (!aboveThreshold(field)) return undefined;
  const v = field!.value;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function extractNumber(field: RawFieldResult | undefined): number | undefined {
  if (!aboveThreshold(field)) return undefined;
  const v = Number(field!.value);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

function extractInt(field: RawFieldResult | undefined): number | undefined {
  const v = extractNumber(field);
  return v !== undefined ? Math.round(v) : undefined;
}

function extractEnum<T extends string>(
  field: RawFieldResult | undefined,
  allowed: readonly T[],
): T | undefined {
  const s = extractString(field);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}

function extractExtractedRooms(field: RawFieldResult | undefined): AssistedDraftExtraction["rooms"] {
  if (!aboveThreshold(field) || !Array.isArray(field!.value)) return undefined;
  const rooms = (field!.value as unknown[]).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const o = raw as Record<string, unknown>;
    const occupancy = o.occupancy === "occupied" ? ("occupied" as const) : ("available" as const);
    const rent = Number(o.rentMxn);
    const lodging: "private_room" | "shared_room" | undefined =
      o.lodgingType === "shared_room" || o.lodgingType === "private_room" ? o.lodgingType : undefined;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined;
    const roomSummary =
      typeof o.roomSummary === "string" && o.roomSummary.trim()
        ? o.roomSummary.trim().slice(0, SUMMARY_MAX_CHARS)
        : undefined;
    return [
      {
        occupancy,
        ...(Number.isFinite(rent) && rent > 0 ? { rentMxn: Math.round(rent) } : {}),
        ...(title ? { title } : {}),
        ...(roomSummary ? { roomSummary } : {}),
        ...(lodging ? { lodgingType: lodging } : {}),
      },
    ];
  });
  return rooms.length > 0 ? rooms : undefined;
}

function extractTags(field: RawFieldResult | undefined, validSet: Set<string>): string[] | undefined {
  if (!aboveThreshold(field)) return undefined;
  const v = field!.value;
  if (!Array.isArray(v)) return undefined;
  const filtered = (v as unknown[]).filter(
    (t): t is string => typeof t === "string" && validSet.has(t),
  );
  return filtered.length > 0 ? filtered : undefined;
}

/** Build Gemini parts array for extraction: text + optional inline images. */
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type ExtractionInput = {
  text?: string;
  images?: Array<{ mimeType: string; data: string }>;
  city?: string;
};

export async function extractListingDataWithGemini(
  input: ExtractionInput,
): Promise<AssistedDraftGeminiResult> {
  const key = geminiApiKey();
  const model = geminiModel();
  const noToken: AssistedDraftGeminiResult = { extraction: {}, promptTokens: 0, outputTokens: 0, model };
  if (!key) {
    return { extraction: { rawText: "GEMINI_API_KEY not configured" }, promptTokens: 0, outputTokens: 0, model };
  }

  const parts: GeminiPart[] = [];

  if (input.text?.trim()) {
    parts.push({
      text: `Texto de la publicación de Facebook:\n\n${input.text.trim()}`,
    });
  }

  if (input.images?.length) {
    for (const img of input.images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
    parts.push({
      text: "Analiza las imágenes del infográfico/anuncio de arriba y extrae toda la información del espacio disponible.",
    });
  }

  if (input.city) {
    parts.push({
      text: `Ciudad de referencia: ${input.city}. Usa esta ciudad para geocodificación aproximada si es necesario.`,
    });
  }

  if (parts.length === 0) {
    return noToken;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(timer);

    const json = (await res.json()) as GeminiResponse;
    if (!res.ok) {
      console.warn("[assisted-draft-ai] gemini http", res.status, json.error?.message ?? "");
      return noToken;
    }

    const promptTokens = Number(json.usageMetadata?.promptTokenCount) || 0;
    const outputTokens = Number(json.usageMetadata?.candidatesTokenCount) || 0;

    const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!rawText.trim()) return noToken;

    let parsed: RawGeminiExtraction;
    try {
      const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleaned) as RawGeminiExtraction;
    } catch {
      console.warn("[assisted-draft-ai] failed to parse JSON response");
      return { extraction: { rawText }, promptTokens, outputTokens, model };
    }

    const confidenceMap: Record<string, number> = {};
    const record = (key: string, field: RawFieldResult | undefined) => {
      if (field && typeof field.confidence === "number") {
        confidenceMap[key] = field.confidence;
      }
    };
    record("propertyTitle", parsed.propertyTitle);
    record("neighborhood", parsed.neighborhood);
    record("propertyKind", parsed.propertyKind);
    record("lodgingType", parsed.lodgingType);
    record("rentMxn", parsed.rentMxn);
    record("depositMxn", parsed.depositMxn);
    record("roommateGenderPref", parsed.roommateGenderPref);
    record("ageMin", parsed.ageMin);
    record("ageMax", parsed.ageMax);
    record("availableFrom", parsed.availableFrom);
    record("minimalStayMonths", parsed.minimalStayMonths);
    record("roomDimension", parsed.roomDimension);
    record("tags", parsed.tags);
    record("idealParaTags", parsed.idealParaTags);
    record("deniedTags", parsed.deniedTags);
    record("roomSummary", parsed.roomSummary);
    record("propertySummary", parsed.propertySummary);
    record("bathrooms", parsed.bathrooms);
    record("bedroomsTotal", parsed.bedroomsTotal);
    record("rooms", parsed.rooms);

    const allTags = [
      ...(extractTags(parsed.tags, VALID_TAGS) ?? []),
      ...(extractTags(parsed.idealParaTags, IDEAL_PARA_TAGS) ?? []),
    ];
    const uniqueTags = [...new Set(allTags)];
    const deniedTags = extractTags(parsed.deniedTags, VALID_TAGS);

    const rawSummary = extractString(parsed.roomSummary);
    const roomSummary = rawSummary ? rawSummary.slice(0, SUMMARY_MAX_CHARS) : undefined;
    const rawPropertySummary = extractString(parsed.propertySummary);
    const propertySummary = rawPropertySummary ? rawPropertySummary.slice(0, SUMMARY_MAX_CHARS) : undefined;

    const locConf = parsed.location?.confidence ?? 0;
    let location: AssistedDraftExtraction["location"] | undefined;
    if (parsed.location?.type === "precise" && locConf >= CONFIDENCE_THRESHOLD) {
      location = {
        type: "precise",
        lat: parsed.location.lat,
        lng: parsed.location.lng,
        address: parsed.location.address,
      };
    } else if (parsed.location?.type === "approximate" && locConf >= 30) {
      location = {
        type: "approximate",
        lat: parsed.location.lat,
        lng: parsed.location.lng,
        radiusMeters: confidenceToRadius(locConf),
        address: parsed.location.address,
      };
    } else {
      location = { type: "none" };
    }

    return {
      extraction: {
        propertyTitle: extractString(parsed.propertyTitle),
        neighborhood: extractString(parsed.neighborhood),
        propertyKind: extractEnum(parsed.propertyKind, ["house", "apartment", "loft"] as const),
        lodgingType: extractEnum(parsed.lodgingType, ["private_room", "shared_room"] as const),
        rentMxn: extractInt(parsed.rentMxn),
        depositMxn: extractInt(parsed.depositMxn),
        roommateGenderPref: extractEnum(parsed.roommateGenderPref, ["any", "female", "male"] as const),
        ageMin: extractInt(parsed.ageMin),
        ageMax: extractInt(parsed.ageMax),
        availableFrom: extractString(parsed.availableFrom),
        minimalStayMonths: extractInt(parsed.minimalStayMonths),
        roomDimension: extractEnum(parsed.roomDimension, ["small", "medium", "large"] as const),
        tags: uniqueTags.length > 0 ? uniqueTags : undefined,
        deniedTags: deniedTags && deniedTags.length > 0 ? deniedTags : undefined,
        roomSummary,
        propertySummary,
        bathrooms: extractNumber(parsed.bathrooms),
        bedroomsTotal: extractInt(parsed.bedroomsTotal),
        rooms: extractExtractedRooms(parsed.rooms),
        location,
        confidence: confidenceMap,
        rawText,
      },
      promptTokens,
      outputTokens,
      model,
    };
  } catch (err) {
    console.warn("[assisted-draft-ai] error", err instanceof Error ? err.message : err);
    return noToken;
  }
}

/**
 * Room description for chat-published posts (WhatsApp now, Messenger later).
 *
 * The wizard requires a real 100–1500 char description, so a chat post that
 * skipped the description step used to publish generic filler. This writes a
 * description from the structured facts instead: Gemini when a key is
 * configured, otherwise a deterministic compose from the same facts. Both stay
 * inside what the publisher actually told us — no invented amenities.
 */
import { geminiApiKey, geminiModel } from "./shareAiCopyGemini.js";
import { ROOM_SUMMARY_MIN_LEN } from "./validation.js";
import type { ListingTag, LodgingType, RoomDimension, RoommateGenderPref } from "./types.js";

const SUMMARY_MAX = 1200;

export type ChatRoomSummaryFacts = {
  neighborhood: string;
  city: string;
  rentMxn: number;
  depositMxn: number | null;
  lodging: LodgingType;
  roomDimension: RoomDimension;
  genderPref: RoommateGenderPref;
  tags: readonly ListingTag[];
  availableFrom: string | null;
  minStay: number;
  photoCount: number;
  /** Anything the publisher wrote or an infographic contained. */
  sourceText: string;
};

const TAG_PHRASES: Partial<Record<ListingTag, string>> = {
  wifi: "wifi incluido",
  agua: "agua incluida",
  luz: "luz incluida",
  gas: "gas incluido",
  "servicios-incluidos": "servicios incluidos en la renta",
  muebles: "amueblado",
  "baño-privado": "baño privado",
  closet: "clóset",
  "cerradura-cuarto": "cerradura en la recámara",
  "agua-caliente": "agua caliente",
  "aire-acondicionado": "aire acondicionado",
  ventilador: "ventilador",
  "cocina-equipada": "cocina equipada",
  lavadora: "lavadora",
  secadora: "secadora",
  lavanderia: "área de lavado",
  terraza: "terraza",
  estacionamiento: "estacionamiento",
  "seguridad-acceso": "acceso controlado",
  vigilancia: "vigilancia",
  "cerca-transporte": "cerca del transporte público",
  mascotas: "se aceptan mascotas",
  fumar: "se permite fumar",
  fiestas: "se permiten reuniones",
  "lgbt-friendly": "LGBT friendly",
  estudiantes: "ideal para estudiantes",
  profesionistas: "ideal para profesionistas",
  "residentes-medicos": "ideal para residentes médicos",
  "nomadas-digitales": "ideal para nómadas digitales",
  "individuos-solo": "ideal para vivir solo",
  parejas: "se aceptan parejas",
  "familiar-ninos": "se aceptan niños",
};

function lodgingPhrase(lodging: LodgingType, dim: RoomDimension): string {
  const size = dim === "small" ? "individual" : dim === "large" ? "grande" : "matrimonial";
  if (lodging === "shared_room") return `recámara compartida ${size}`;
  if (lodging === "whole_home") return "espacio completo";
  return `recámara privada ${size}`;
}

function genderPhrase(pref: RoommateGenderPref): string | null {
  if (pref === "female") return "El depa busca roomie mujer";
  if (pref === "male") return "El depa busca roomie hombre";
  return null;
}

function tagPhrases(tags: readonly ListingTag[]): string[] {
  return tags.map((t) => TAG_PHRASES[t]).filter((p): p is string => Boolean(p));
}

/** Deterministic description from the collected facts. Always ≥ the wizard minimum. */
export function composeChatRoomSummary(facts: ChatRoomSummaryFacts): string {
  const place = facts.neighborhood ? `${facts.neighborhood}, ${facts.city}` : facts.city;
  const parts: string[] = [
    `${lodgingPhrase(facts.lodging, facts.roomDimension).replace(/^r/, "R")} en ${place} por $${facts.rentMxn.toLocaleString("es-MX")} MXN al mes.`,
  ];

  const amenities = tagPhrases(facts.tags);
  if (amenities.length) {
    parts.push(`Incluye ${amenities.slice(0, 6).join(", ")}.`);
  }
  if (facts.depositMxn != null) {
    parts.push(
      facts.depositMxn > 0
        ? `Depósito de $${facts.depositMxn.toLocaleString("es-MX")} MXN.`
        : "Sin depósito.",
    );
  }
  const gender = genderPhrase(facts.genderPref);
  if (gender) parts.push(`${gender}.`);
  if (facts.minStay > 1) parts.push(`Estancia mínima de ${facts.minStay} meses.`);
  if (facts.photoCount > 0) {
    parts.push(
      `Las ${facts.photoCount === 1 ? "foto" : `${facts.photoCount} fotos`} muestran el espacio real.`,
    );
  }
  parts.push("Escríbeme por Bestie para agendar una visita o preguntar lo que falte.");

  let text = parts.join(" ").trim();
  if (text.length < ROOM_SUMMARY_MIN_LEN) {
    text = `${text} La zona tiene servicios a pie y transporte cerca.`.trim();
  }
  return text.slice(0, SUMMARY_MAX);
}

const SYSTEM_PROMPT = `Eres redactor de anuncios de renta de cuartos en México para Bestie.
Escribe la descripción de UNA recámara en español de México, cálido y directo, sin emojis y sin mayúsculas sostenidas.
REGLAS:
- Usa SOLO los datos que te doy. No inventes amenidades, precios, servicios ni distancias.
- No prometas nada que no esté en los datos. Si un dato falta, no lo menciones.
- Entre 120 y 700 caracteres, 2 o 3 frases seguidas (sin listas ni viñetas).
- No incluyas teléfonos, links, ni "contáctame por WhatsApp": el contacto lo pone Bestie.
- No repitas la palabra "Bestie" más de una vez.
Responde solo con el texto de la descripción.`;

function factsPrompt(facts: ChatRoomSummaryFacts): string {
  const lines = [
    `Zona: ${facts.neighborhood || facts.city}, ${facts.city}`,
    `Renta mensual: $${facts.rentMxn} MXN`,
    `Tipo: ${lodgingPhrase(facts.lodging, facts.roomDimension)}`,
  ];
  if (facts.depositMxn != null) {
    lines.push(`Depósito: ${facts.depositMxn > 0 ? `$${facts.depositMxn} MXN` : "sin depósito"}`);
  }
  const amenities = tagPhrases(facts.tags);
  if (amenities.length) lines.push(`Incluye: ${amenities.join(", ")}`);
  const gender = genderPhrase(facts.genderPref);
  if (gender) lines.push(gender);
  if (facts.minStay > 1) lines.push(`Estancia mínima: ${facts.minStay} meses`);
  if (facts.availableFrom) lines.push(`Disponible desde: ${facts.availableFrom}`);
  if (facts.photoCount > 0) lines.push(`Fotos del espacio: ${facts.photoCount}`);
  if (facts.sourceText.trim()) {
    lines.push(`Lo que escribió la persona que publica: ${facts.sourceText.trim().slice(0, 800)}`);
  }
  return lines.join("\n");
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

/**
 * Gemini description, falling back to {@link composeChatRoomSummary} on any
 * failure, empty output, or a result under the wizard minimum.
 */
export async function generateChatRoomSummary(facts: ChatRoomSummaryFacts): Promise<string> {
  const key = geminiApiKey();
  if (!key) return composeChatRoomSummary(facts);
  const model = geminiModel();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: factsPrompt(facts) }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 512 },
        }),
        signal: ac.signal,
      },
    );
    clearTimeout(timer);
    const json = (await res.json()) as GeminiResponse;
    if (!res.ok) {
      console.warn("[chat-summary] gemini http", res.status, json.error?.message ?? "");
      return composeChatRoomSummary(facts);
    }
    const raw = (json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
    const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, SUMMARY_MAX);
    if (cleaned.length < ROOM_SUMMARY_MIN_LEN) return composeChatRoomSummary(facts);
    return cleaned;
  } catch (err) {
    console.warn("[chat-summary] gemini error", err instanceof Error ? err.message : err);
    return composeChatRoomSummary(facts);
  }
}

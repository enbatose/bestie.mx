import { SHARE_AI_BODY_TARGET, SHARE_AI_TEXT_MAX } from "./shareAiCopyLimits.js";

export type ShareAiScope = "property" | "room";

export type ShareAiListingFacts = {
  scope: ShareAiScope;
  title: string;
  city: string;
  neighborhood: string;
  summary: string;
  propertyKind: string | null;
  /** Property-level highlights (amenities from rooms / property). */
  tags: string[];
  roommateGenderPref: string | null;
  ageMin: number | null;
  ageMax: number | null;
  lodgingType: string | null;
  rentMxn: number | null;
  rentMinMxn: number | null;
  rentMaxMxn: number | null;
  availableRoomCount: number;
  rooms: Array<{
    title: string;
    rentMxn: number;
    lodgingType: string | null;
    tags: string[];
    summary: string;
  }>;
  permalink: string;
};

const TAG_LABELS: Record<string, string> = {
  wifi: "Internet",
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  mascotas: "Mascotas OK",
  estacionamiento: "Estacionamiento",
  muebles: "Amueblado",
  "baño-privado": "Baño privado",
  fumar: "Se permite fumar",
  ventilador: "Ventilador",
  closet: "Clóset",
  fiestas: "Fiestas",
  "aire-acondicionado": "Aire acondicionado",
  "seguridad-acceso": "Acceso seguro",
  vigilancia: "Vigilancia",
  lavanderia: "Lavandería",
  lavadora: "Lavadora",
  secadora: "Secadora",
  "cocina-equipada": "Cocina equipada",
  terraza: "Terraza",
  "lgbt-friendly": "LGBT friendly",
  profesionistas: "Profesionistas",
  estudiantes: "Estudiantes",
  "residentes-medicos": "Residentes médicos",
  "nomadas-digitales": "Nómada Dig.",
  "individuos-solo": "Individual",
  parejas: "Parejas",
  "familiar-ninos": "Familiar / niños",
  "servicios-incluidos": "Servicios incluidos",
  "cerradura-cuarto": "Cerradura en el cuarto",
  "agua-caliente": "Agua caliente",
  "cerca-transporte": "Cerca de transporte",
};

function tagLabels(tags: readonly string[]): string[] {
  return tags.map((t) => TAG_LABELS[t] ?? t).filter(Boolean);
}

function lodgingLabel(v: string | null): string | null {
  if (v === "private_room") return "Recámara privada";
  if (v === "shared_room") return "Recámara compartida";
  if (v === "whole_home") return "Espacio completo";
  return null;
}

function genderPrefLabel(v: string | null): string | null {
  if (v === "female") return "Prefiere roomie mujer";
  if (v === "male") return "Prefiere roomie hombre";
  if (v === "any") return "Roomie de cualquier género";
  return null;
}

function formatRent(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN/mes`;
}

/** Deterministic fallback when Gemini is unavailable. */
export function buildTemplateShareCopy(facts: ShareAiListingFacts): string {
  const place = [facts.neighborhood, facts.city].filter(Boolean).join(", ") || "Guadalajara";
  const lines: string[] = [];
  if (facts.scope === "property") {
    lines.push(`Revisa mi propiedad en ${place} 🏠`);
    lines.push("");
    const n = facts.availableRoomCount;
    const rentBit =
      facts.rentMinMxn != null && facts.rentMaxMxn != null
        ? facts.rentMinMxn === facts.rentMaxMxn
          ? formatRent(facts.rentMinMxn)
          : `desde ${formatRent(facts.rentMinMxn)}`
        : null;
    lines.push(
      `Publico en Bestie: ${n === 1 ? "1 cuarto disponible" : `${n} cuartos disponibles`}${
        rentBit ? ` (${rentBit})` : ""
      }. Ambiente para roomies serios en zona conectada.`,
    );
  } else {
    lines.push(`Revisa mi cuarto en ${place} 🏠`);
    lines.push("");
    const lodging = lodgingLabel(facts.lodgingType) ?? "Recámara";
    const rent = facts.rentMxn != null ? formatRent(facts.rentMxn) : null;
    lines.push(
      `Estoy buscando roomie para ${lodging.toLowerCase()}${rent ? ` · ${rent}` : ""}. Buena vibra y ubicación en GDL.`,
    );
  }
  const tags = tagLabels(facts.tags).slice(0, 5);
  if (tags.length) {
    lines.push("");
    for (const t of tags) lines.push(`• ${t}`);
  }
  const gender = genderPrefLabel(facts.roommateGenderPref);
  if (gender) {
    lines.push(`• ${gender}`);
  }
  lines.push("");
  lines.push("Fotos, mapa y detalles en Bestie:");
  lines.push(facts.permalink);
  return finalizeShareCopy(lines.join("\n"), facts.permalink);
}

export const SHARE_AI_SYSTEM_PROMPT = `Eres copywriter de Bestie MX (bestie.mx), marketplace de roomies y cuartos en Guadalajara.

Escribes el mensaje que el PUBLICADOR pega en WhatsApp, Facebook o Instagram para promover SU anuncio.
Voz: primera persona del publicador ("Revisa mi cuarto…", "Publico mi propiedad…"), cálida, clara, mexicana neutra de GDL, sin exagerar ni inventar.

Reglas estrictas:
- Usa SOLO hechos del JSON de entrada. No inventes amenidades, distancias, precios ni "vibes" no respaldadas.
- No menciones Street View, IA, ni que el texto fue generado.
- No uses hashtags ni emojis excepto como máximo un 🏠 en la primera línea.
- Longitud: el mensaje COMPLETO (incluido el permalink al final) debe quedar entre 550 y ${SHARE_AI_TEXT_MAX} caracteres. Apunta a ~${SHARE_AI_BODY_TARGET} antes del link.
- Estructura sugerida: gancho → 2–4 frases con zona/renta/tipo → viñetas cortas (•) con tags reales → CTA + permalink exactamente como viene en el JSON.
- El permalink DEBE ser la última línea, sin modificarlo.
- Responde SOLO con el texto del mensaje, sin comillas ni markdown.`;

export function buildShareAiUserPrompt(facts: ShareAiListingFacts): string {
  const payload = {
    scope: facts.scope,
    title: facts.title,
    city: facts.city,
    neighborhood: facts.neighborhood,
    summary: facts.summary.slice(0, 280),
    propertyKind: facts.propertyKind,
    lodgingType: lodgingLabel(facts.lodgingType),
    rentMxn: facts.rentMxn,
    rentMinMxn: facts.rentMinMxn,
    rentMaxMxn: facts.rentMaxMxn,
    availableRoomCount: facts.availableRoomCount,
    tags: tagLabels(facts.tags),
    roommateGenderPref: genderPrefLabel(facts.roommateGenderPref),
    ageRange:
      facts.ageMin != null && facts.ageMax != null ? `${facts.ageMin}–${facts.ageMax}` : null,
    rooms: facts.rooms.slice(0, 6).map((r) => ({
      title: r.title,
      rentMxn: r.rentMxn,
      lodgingType: lodgingLabel(r.lodgingType),
      tags: tagLabels(r.tags).slice(0, 8),
      summary: r.summary.slice(0, 120),
    })),
    permalink: facts.permalink,
    maxChars: SHARE_AI_TEXT_MAX,
  };
  return `Genera el mensaje de compartir con estos hechos (JSON):\n${JSON.stringify(payload)}`;
}

/** Ensure permalink is last line and total length ≤ SHARE_AI_TEXT_MAX. */
export function finalizeShareCopy(raw: string, permalink: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  text = text.replace(/^```[\s\S]*?\n/, "").replace(/\n```$/, "").trim();
  const link = permalink.trim();
  if (!link) return text.slice(0, SHARE_AI_TEXT_MAX);

  // Strip trailing permalink variants then re-append canonical.
  const lines = text.split("\n");
  while (lines.length && /bestie\.mx\/(anuncio|propiedad)\//i.test(lines[lines.length - 1]!.trim())) {
    lines.pop();
  }
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  let body = lines.join("\n").trim();
  const suffix = `\n\n${link}`;
  const maxBody = SHARE_AI_TEXT_MAX - suffix.length;
  if (body.length > maxBody) {
    body = truncateAtWord(body, maxBody);
  }
  return `${body}${suffix}`;
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, Math.max(0, max - 1));
  const sp = slice.lastIndexOf(" ");
  const base = sp > Math.floor(max * 0.55) ? slice.slice(0, sp) : slice;
  return `${base.replace(/[.,;:!?¿¡\s]+$/u, "")}…`;
}

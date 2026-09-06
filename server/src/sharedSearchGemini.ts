import { geminiApiKey, geminiModel } from "./shareAiCopyGemini.js";
import type { SharedSearchExtraction } from "./sharedSearchCompose.js";

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
};

export type SharedSearchGeminiResult = {
  extraction: SharedSearchExtraction;
  promptTokens: number;
  outputTokens: number;
  model: string;
};

const SYSTEM_PROMPT = `Eres un asistente de extracción para búsquedas de cuarto en México (Bestie).
Analizas publicaciones de Facebook de personas que BUSCAN roomie / cuarto (no de quienes rentan).

REGLAS:
- Solo extrae lo EXPLÍCITO o claramente visible. No inventes.
- confidence 0-100 por campo. Omite lo que no esté al menos a 60.
- budgetMin/budgetMax en MXN mensuales. Si dice "máximo 7000", budgetMax=7000.
- neighborhoods: colonias o zonas nombradas.
- pois: universidades, plazas, hospitales, Glorieta Minerva, Andares, ITESO, CUCS, etc.
- Si hay un mapa o polígono en una imagen, estima un bbox [minLat,minLng,maxLat,maxLng] de Guadalajara.
- lodgingType: private_room | shared_room | whole_home si lo piden.
- tags: slugs Bestie que QUIEREN (mascotas, muebles, baño-privado, estacionamiento, lgbt-friendly, estudiantes, profesionistas, wifi, servicios-incluidos, …).
- requiredTags: solo no-negociables explícitos (ej. "tengo perro, tiene que aceptar mascotas" → ["mascotas"]).
- deniedTags: lo que rechazan.
- genderPref: si buscan depa/cuarto de mujeres o de hombres (filtro del anuncio).
- seekerGenderInferred: género de quien publica según nombre mexicano y texto ("soy chica", "busco roomie mujer" dicho de sí misma). Usa female|male o omite si es ambiguo (Alex, Guadalupe, Rosario, José María).
- unmappedCriteria: deseos que NO son un filtro Bestie (cerca del hospital, sin fiestas, "para tesista", etc.).
- nonNegotiables: {kind,value,reason} para género, mascotas, recámara privada, tope de renta si lo marcan como techo duro.
- descriptionKeywords: 1-3 frases cortas de lo no mapeable para buscar en descripciones.
- mainAreaLabel: la zona o punto de interés principal (una sola).

TAGS válidos: wifi, agua, luz, gas, mascotas, estacionamiento, muebles, baño-privado, fumar, ventilador, closet, fiestas, aire-acondicionado, seguridad-acceso, vigilancia, lavanderia, lavadora, secadora, cocina-equipada, terraza, lgbt-friendly, profesionistas, estudiantes, residentes-medicos, nomadas-digitales, individuos-solo, parejas, familiar-ninos, servicios-incluidos, cerradura-cuarto, agua-caliente, cerca-transporte.

Responde SOLO JSON:
{
  "budgetMin": {"value": 0, "confidence": 0},
  "budgetMax": {"value": 0, "confidence": 0},
  "neighborhoods": {"value": ["Americana"], "confidence": 0},
  "pois": {"value": ["ITESO"], "confidence": 0},
  "lodgingType": {"value": "private_room", "confidence": 0},
  "wantHouse": {"value": false, "confidence": 0},
  "wantApartment": {"value": false, "confidence": 0},
  "wantLoft": {"value": false, "confidence": 0},
  "tags": {"value": ["mascotas"], "confidence": 0},
  "requiredTags": {"value": ["mascotas"], "confidence": 0},
  "deniedTags": {"value": [], "confidence": 0},
  "genderPref": {"value": "female", "confidence": 0},
  "seekerGenderInferred": {"value": "female", "confidence": 0},
  "age": {"value": 25, "confidence": 0},
  "ageMin": {"value": 22, "confidence": 0},
  "ageMax": {"value": 35, "confidence": 0},
  "availableFrom": {"value": "YYYY-MM-DD", "confidence": 0},
  "minimalStayMonths": {"value": 6, "confidence": 0},
  "bbox": {"value": {"minLat": 0, "minLng": 0, "maxLat": 0, "maxLng": 0}, "confidence": 0},
  "mainAreaLabel": {"value": "Americana", "confidence": 0},
  "descriptionKeywords": {"value": "", "confidence": 0},
  "unmappedCriteria": {"value": [{"label": "", "text": ""}], "confidence": 0},
  "nonNegotiables": {"value": [{"kind": "gender", "value": "female", "reason": ""}], "confidence": 0}
}`;

const CONFIDENCE_THRESHOLD = 60;

type RawField = { value?: unknown; confidence?: number };

function above(field: RawField | undefined): boolean {
  return field != null && typeof field.confidence === "number" && field.confidence >= CONFIDENCE_THRESHOLD;
}

function num(field: RawField | undefined): number | undefined {
  if (!above(field)) return undefined;
  const n = Number(field!.value);
  return Number.isFinite(n) ? n : undefined;
}

function str(field: RawField | undefined): string | undefined {
  if (!above(field) || typeof field!.value !== "string") return undefined;
  const t = field!.value.trim();
  return t || undefined;
}

function strs(field: RawField | undefined): string[] | undefined {
  if (!above(field) || !Array.isArray(field!.value)) return undefined;
  const out = (field!.value as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

function bool(field: RawField | undefined): boolean | undefined {
  if (!above(field)) return undefined;
  return field!.value === true;
}

export async function extractSeekerSearchWithGemini(input: {
  text?: string;
  images?: Array<{ mimeType: string; data: string }>;
  city?: string;
  seekerName?: string;
  seekerGender?: "female" | "male" | null;
}): Promise<SharedSearchGeminiResult> {
  const key = geminiApiKey();
  const model = geminiModel();
  const empty: SharedSearchGeminiResult = { extraction: {}, promptTokens: 0, outputTokens: 0, model };
  if (!key) return empty;

  const parts: GeminiPart[] = [];
  if (input.seekerName?.trim()) {
    parts.push({ text: `Nombre de la persona que publica (Facebook): ${input.seekerName.trim()}` });
  }
  if (input.seekerGender) {
    parts.push({
      text: `Género indicado por el operador: ${input.seekerGender === "female" ? "mujer" : "hombre"}. Úsalo como seekerGenderInferred.`,
    });
  }
  if (input.text?.trim()) {
    parts.push({ text: `Texto de la publicación (persona que BUSCA cuarto):\n\n${input.text.trim()}` });
  }
  if (input.images?.length) {
    for (const img of input.images.slice(0, 2)) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
    parts.push({
      text: "Analiza las imágenes (infográfico o mapa de zona de interés) y extrae criterios de búsqueda, incluido bbox si hay un perímetro.",
    });
  }
  if (input.city) parts.push({ text: `Ciudad de referencia: ${input.city}.` });
  if (!parts.length) return empty;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
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
    if (!res.ok) return empty;
    const promptTokens = Number(json.usageMetadata?.promptTokenCount) || 0;
    const outputTokens = Number(json.usageMetadata?.candidatesTokenCount) || 0;
    const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!rawText.trim()) return { ...empty, promptTokens, outputTokens };

    const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, RawField>;
    const extraction: SharedSearchExtraction = {
      budgetMin: num(parsed.budgetMin),
      budgetMax: num(parsed.budgetMax),
      neighborhoods: strs(parsed.neighborhoods),
      pois: strs(parsed.pois),
      lodgingType: (() => {
        const v = str(parsed.lodgingType);
        return v === "private_room" || v === "shared_room" || v === "whole_home" ? v : undefined;
      })(),
      wantHouse: bool(parsed.wantHouse),
      wantApartment: bool(parsed.wantApartment),
      wantLoft: bool(parsed.wantLoft),
      tags: strs(parsed.tags),
      requiredTags: strs(parsed.requiredTags),
      deniedTags: strs(parsed.deniedTags),
      genderPref: str(parsed.genderPref) === "male" || str(parsed.genderPref) === "female" ? (str(parsed.genderPref) as "female" | "male") : undefined,
      seekerGenderInferred:
        str(parsed.seekerGenderInferred) === "male" || str(parsed.seekerGenderInferred) === "female"
          ? (str(parsed.seekerGenderInferred) as "female" | "male")
          : undefined,
      age: num(parsed.age),
      ageMin: num(parsed.ageMin),
      ageMax: num(parsed.ageMax),
      availableFrom: str(parsed.availableFrom),
      minimalStayMonths: num(parsed.minimalStayMonths),
      bbox: (() => {
        if (!above(parsed.bbox) || parsed.bbox?.value == null || typeof parsed.bbox.value !== "object") return undefined;
        const b = parsed.bbox.value as Record<string, unknown>;
        const minLat = Number(b.minLat);
        const minLng = Number(b.minLng);
        const maxLat = Number(b.maxLat);
        const maxLng = Number(b.maxLng);
        if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return undefined;
        if (minLat > maxLat || minLng > maxLng) return undefined;
        return { minLat, minLng, maxLat, maxLng };
      })(),
      mainAreaLabel: str(parsed.mainAreaLabel),
      descriptionKeywords: str(parsed.descriptionKeywords),
      unmappedCriteria: Array.isArray(parsed.unmappedCriteria?.value)
        ? (parsed.unmappedCriteria!.value as unknown[]).flatMap((row) => {
            if (!row || typeof row !== "object") return [];
            const o = row as { label?: unknown; text?: unknown };
            const text = typeof o.text === "string" ? o.text.trim() : typeof o.label === "string" ? o.label.trim() : "";
            if (!text) return [];
            return [{ label: typeof o.label === "string" ? o.label.trim() : text, text }];
          })
        : undefined,
      nonNegotiables: Array.isArray(parsed.nonNegotiables?.value)
        ? (parsed.nonNegotiables!.value as unknown[]).flatMap((row) => {
            if (!row || typeof row !== "object") return [];
            const o = row as { kind?: unknown; value?: unknown; reason?: unknown };
            const value = typeof o.value === "string" ? o.value.trim() : "";
            if (!value) return [];
            return [
              {
                kind: typeof o.kind === "string" ? o.kind.trim() : "other",
                value,
                reason: typeof o.reason === "string" ? o.reason.trim() : value,
              },
            ];
          })
        : undefined,
    };
    return { extraction, promptTokens, outputTokens, model };
  } catch {
    return empty;
  }
}

/** Exact sign-off so admins can @-link Equipo Bestie MX on Facebook. */
export const DIFFUSION_COMMENT_SIGN_OFF = "Atte. Equipo Bestie MX.";

/** Live site for paste-ready Facebook comments (not Dev/localhost). */
export const DIFFUSION_PUBLIC_ORIGIN = "https://www.bestie.mx";

const MAX_COMMENT_CHARS = 750;

export type DiffusionCommentInput = {
  sharePath: string;
  seekerName?: string | null;
  zoneRule?: string | null;
  placeHint?: string | null;
  exactCount?: number | null;
  similarCount?: number | null;
  extraCriteria?: string[] | null;
  previousText?: string | null;
  variantSeed?: string | null;
  variantOffset?: number;
};

export function diffusionPublicShareUrl(sharePathOrUrl: string): string {
  const raw = sharePathOrUrl.trim();
  if (!raw) return DIFFUSION_PUBLIC_ORIGIN;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return `${DIFFUSION_PUBLIC_ORIGIN}${u.pathname}${u.search}`;
    }
  } catch {
    /* fall through */
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${DIFFUSION_PUBLIC_ORIGIN}${path}`;
}

function firstName(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return t.split(/\s+/)[0] || null;
}

function usefulZone(zone: string | null | undefined, placeHint: string | null | undefined): string | null {
  const cityish = /^(guadalajara|gdl|área del mapa|area del mapa)$/i;
  for (const candidate of [zone, placeHint]) {
    const t = (candidate ?? "").trim();
    if (!t) continue;
    if (cityish.test(t)) continue;
    return t.length > 48 ? `${t.slice(0, 45).trimEnd()}…` : t;
  }
  return null;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function scrubProseDomains(text: string, url: string): string {
  const placeholder = "\uE000BESTIE_DIFFUSION_URL\uE000";
  const protectedUrl = text.includes(url) ? text.split(url).join(placeholder) : text;
  return protectedUrl
    .replace(/https?:\/\/(?:www\.)?bestie\.mx\/?\S*/gi, "")
    .replace(/\b(?:www\.)?bestie\.mx\b/gi, "Bestie")
    .replace(/\bBestie\.mx\b/g, "Bestie")
    .split(placeholder)
    .join(url);
}

function ensureUrl(text: string, url: string): string {
  if (text.includes(url)) return text;
  const signIdx = text.lastIndexOf(DIFFUSION_COMMENT_SIGN_OFF);
  if (signIdx >= 0) {
    return `${text.slice(0, signIdx).trimEnd()}\n\n${url}\n\n${DIFFUSION_COMMENT_SIGN_OFF}`;
  }
  return `${text.trimEnd()}\n\n${url}`;
}

function ensureSignOff(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.endsWith(DIFFUSION_COMMENT_SIGN_OFF)) return trimmed;
  const lines = trimmed.split(/\n+/);
  const last = (lines[lines.length - 1] ?? "").trim();
  if (/^atte\.?\s+equipo\s+bestie/i.test(last) || /^equipo\s+bestie/i.test(last)) {
    lines.pop();
  }
  return `${lines.join("\n").trimEnd()}\n\n${DIFFUSION_COMMENT_SIGN_OFF}`;
}

function countsPhrase(exact: number, similar: number): string | null {
  if (exact > 0 && similar > 0) return `${exact} en zona y ${similar} cerca`;
  if (exact > 0) return `${exact} en zona`;
  if (similar > 0) return `${similar} cerca de tu zona`;
  return null;
}

function extraLine(criteria: string[] | null | undefined): string | null {
  const cleaned = (criteria ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!cleaned.length) return null;
  const joined = cleaned.join(", ");
  if (joined.length > 70) return null;
  return `Tomamos en cuenta: ${joined}.`;
}

function stripCodeFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t.replace(/^["“]|["”]$/g, "").trim();
}

type VariantCtx = {
  name: string | null;
  zone: string | null;
  counts: string | null;
  url: string;
  extra: string | null;
};

/** Free pillars — always present in template fallbacks (paraphrased by Gemini). */
const FREE_LINES = [
  "En Bestie publicar, buscar cuartos y contactar al anunciante es gratis.",
  "Publicar, buscar cuarto y escribirle al anunciante no cuesta en Bestie.",
  "En Bestie es gratis publicar, buscar cuartos y contactar a quien publicó.",
];

const VARIANTS: Array<(ctx: VariantCtx) => string[]> = [
  ({ name, zone, counts, url, extra }) => [
    name ? `Hola ${name} 👋` : "Hola 👋",
    zone
      ? `Armamos una búsqueda en Bestie con opciones${counts ? ` (${counts})` : ""} cerca de lo que pediste en ${zone}.`
      : `Armamos una búsqueda en Bestie con opciones${counts ? ` (${counts})` : ""} cerca de lo que pediste.`,
    FREE_LINES[0]!,
    ...(extra ? [extra] : []),
    "Échales un ojo en el mapa: fotos y WhatsApp, sin el rollo de los grupos.",
    url,
  ],
  ({ name, zone, counts, url, extra }) => [
    name ? `Qué tal ${name},` : "Qué tal,",
    zone
      ? `En Bestie ya dejamos lista una búsqueda para ${zone}${counts ? `: ${counts}` : ""}.`
      : `En Bestie ya dejamos lista una búsqueda con opciones${counts ? ` (${counts})` : ""} según lo que comentaste.`,
    FREE_LINES[1]!,
    ...(extra ? [extra] : []),
    "Abre el enlace, filtra y escríbele al que te cuadre 🏡",
    url,
  ],
  ({ name, zone, counts, url, extra }) => [
    name ? `Hola ${name},` : "Hola,",
    "Vimos que buscas cuarto/roomie y preparamos opciones en Bestie para que no empieces de cero.",
    zone
      ? `Va enfocada a ${zone}${counts ? ` (${counts})` : ""}.`
      : counts
        ? `Hay ${counts} para revisar.`
        : "Revisa el mapa y los anuncios que te armamos.",
    FREE_LINES[2]!,
    ...(extra ? [extra] : []),
    "Un clic y ya estás en el mapa 👀",
    url,
  ],
  ({ name, zone, counts, url, extra }) => [
    name ? `Hola ${name}!` : "Hola!",
    zone
      ? `Te dejamos una búsqueda lista en Bestie para ${zone}${counts ? ` — ${counts}` : ""}.`
      : `Te dejamos una búsqueda lista en Bestie${counts ? ` (${counts})` : ""} según tu post.`,
    FREE_LINES[0]!,
    ...(extra ? [extra] : []),
    "Mapa, fotos y WhatsApp: entra y checa las opciones.",
    url,
  ],
];

export const OUTREACH_DIFFUSION_SYSTEM_PROMPT = `Eres copywriter de Bestie (marketplace de roomies y cuartos en Guadalajara, México).

Redactas un comentario corto para pegar BAJO el post de Facebook de alguien que BUSCA cuarto o roomie (seeker). El objetivo: invitarle a abrir un enlace de búsqueda ya armada en Bestie.

Voz de marca (Equipo Bestie):
- Español de México, tú, cercano y profesional — no corporativo frío, no infantil.
- Habla como el equipo de Bestie ("te armamos", "en Bestie…"), no como un perfil personal anónimo.
- Cero hashtags. Sin pedir like/follow. Sin criticar Facebook ni el grupo.
- No prometas leads, métricas ni resultados garantizados.
- 1–3 emojis máximo, solo si aportan. Sin spam de emojis ni signos de exclamación en cascada.

Must-include (puedes parafrasear, pero el sentido debe quedar):
1) Saludar (con nombre si te lo pasan).
2) Decir que preparamos / armamos una búsqueda con opciones según lo que pidió (zona y conteos si te los dan).
3) Dejar claro que en Bestie es GRATIS: publicar anuncios, buscar cuartos y contactar al anunciante.
4) Invitar a abrir el enlace (mapa / opciones).
5) Exactamente UN URL: el que te pasan en el prompt (en su propia línea).
6) Cierre EXACTO en la última línea: ${DIFFUSION_COMMENT_SIGN_OFF}

Reglas del enlace (crítico para Facebook):
- En prosa escribe "Bestie" SIN ".mx" (nunca "Bestie.mx", "bestie.mx" ni "www.bestie.mx" fuera del URL).
- El único URL del comentario es el enlace de /busquedas/ que te dan.

Formato:
- 3–6 oraciones cortas + URL + firma. Longitud de comentario de Facebook (no párrafo largo).
- Variar estructura y vocabulario en cada generación para que no suene a plantilla spam / bot.
- Responde SOLO con el comentario listo para pegar. Sin comillas, sin markdown, sin notas.`;

export function buildOutreachDiffusionUserPrompt(input: DiffusionCommentInput): string {
  const url = diffusionPublicShareUrl(input.sharePath);
  const name = firstName(input.seekerName);
  const zone = usefulZone(input.zoneRule, input.placeHint);
  const exact = Math.max(0, Math.floor(Number(input.exactCount) || 0));
  const similar = Math.max(0, Math.floor(Number(input.similarCount) || 0));
  const counts = countsPhrase(exact, similar);
  const previous = (input.previousText ?? "").trim();
  const extras = (input.extraCriteria ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 3);

  const parts: string[] = [
    "Genera un comentario distinto (parafraseado) para pegar bajo el post de Facebook del seeker.",
    `URL obligatorio (única URL del comentario): ${url}`,
  ];
  if (name) parts.push(`Nombre del seeker (úsalo solo en el saludo si suena natural): ${name}`);
  else parts.push("No hay nombre: saludo genérico amable.");
  if (zone) parts.push(`Zona / lugar de la búsqueda: ${zone}`);
  if (counts) parts.push(`Conteos disponibles: ${counts}`);
  if (extras.length) parts.push(`Criterios extra a mencionar si caben (breves): ${extras.join(" · ")}`);
  if (previous) {
    parts.push(
      "Versión anterior (NO la copies; cambia apertura, orden de frases y redacción):\n---\n" +
        previous +
        "\n---",
    );
  }
  parts.push(
    `Recuerda: gratis publicar + buscar cuartos + contactar anunciante; URL ${url}; firma exacta "${DIFFUSION_COMMENT_SIGN_OFF}".`,
  );
  return parts.join("\n\n");
}

export function finalizeOutreachDiffusionCopy(raw: string, sharePathOrUrl: string): string {
  const url = diffusionPublicShareUrl(sharePathOrUrl);
  let text = scrubProseDomains(stripCodeFences(raw), url);
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  text = ensureUrl(text, url);
  text = ensureSignOff(text);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > MAX_COMMENT_CHARS) {
    const body = text
      .replace(url, "")
      .replace(DIFFUSION_COMMENT_SIGN_OFF, "")
      .trim()
      .slice(0, MAX_COMMENT_CHARS - url.length - DIFFUSION_COMMENT_SIGN_OFF.length - 10);
    text = `${body}\n\n${url}\n\n${DIFFUSION_COMMENT_SIGN_OFF}`;
  }
  return text;
}

export function buildTemplateOutreachDiffusion(input: DiffusionCommentInput): string {
  const url = diffusionPublicShareUrl(input.sharePath);
  const name = firstName(input.seekerName);
  const zone = usefulZone(input.zoneRule, input.placeHint);
  const exact = Math.max(0, Math.floor(Number(input.exactCount) || 0));
  const similar = Math.max(0, Math.floor(Number(input.similarCount) || 0));
  const counts = countsPhrase(exact, similar);
  const extra = extraLine(input.extraCriteria ?? null);
  const seed = (input.variantSeed ?? url).trim() || url;
  const previous = (input.previousText ?? "").trim();
  let offset = Math.max(0, Math.floor(Number(input.variantOffset) || 0));
  if (previous) offset += 1;
  const idx = (hashSeed(seed) + offset) % VARIANTS.length;
  const lines = VARIANTS[idx]!({ name, zone, counts, url, extra });
  return finalizeOutreachDiffusionCopy(lines.filter(Boolean).join("\n\n"), input.sharePath);
}

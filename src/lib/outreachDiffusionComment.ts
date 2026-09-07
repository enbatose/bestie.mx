/** Exact sign-off so admins can @-link Equipo Bestie MX on Facebook. */
export const DIFFUSION_COMMENT_SIGN_OFF = "Atte. Equipo Bestie MX.";

/** Live site for paste-ready Facebook comments (not Dev/localhost). */
export const DIFFUSION_PUBLIC_ORIGIN = "https://www.bestie.mx";

const MAX_COMMENT_CHARS = 700;

export type DiffusionCommentInput = {
  sharePath: string;
  seekerName?: string | null;
  zoneRule?: string | null;
  /** Short place / caption fragment when zoneRule is weak. */
  placeHint?: string | null;
  exactCount?: number | null;
  similarCount?: number | null;
  /** Unmapped seeker criteria to weave in (optional, keep short). */
  extraCriteria?: string[] | null;
  /** Stable seed (share id) so the same link keeps a variant until regenerate. */
  variantSeed?: string | null;
  /** Force a different variant index (regenerate). */
  variantOffset?: number;
};

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

type VariantCtx = {
  name: string | null;
  zone: string | null;
  counts: string | null;
  url: string;
  extra: string | null;
};

const VARIANTS: Array<(ctx: VariantCtx) => string[]> = [
  ({ name, zone, counts, url, extra }) => [
    name ? `Hola ${name} 👋` : "Hola 👋",
    zone
      ? `Armamos una búsqueda en Bestie con opciones${counts ? ` (${counts})` : ""} cerca de lo que pediste en ${zone}.`
      : `Armamos una búsqueda en Bestie con opciones${counts ? ` (${counts})` : ""} cerca de lo que pediste.`,
    ...(extra ? [extra] : []),
    "Échales un ojo en el mapa: fotos y WhatsApp, sin el rollo de los grupos.",
    url,
  ],
  ({ name, zone, counts, url, extra }) => [
    name ? `Qué tal ${name},` : "Qué tal,",
    zone
      ? `En Bestie ya dejamos lista una búsqueda para ${zone}${counts ? `: ${counts}` : ""}.`
      : `En Bestie ya dejamos lista una búsqueda con opciones${counts ? ` (${counts})` : ""} según lo que comentaste.`,
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
    ...(extra ? [extra] : []),
    "Un clic y ya estás en el mapa 👀",
    url,
  ],
  ({ name, zone, counts, url, extra }) => [
    name ? `Hola ${name}!` : "Hola!",
    zone
      ? `Te dejamos una búsqueda lista en Bestie para ${zone}${counts ? ` — ${counts}` : ""}.`
      : `Te dejamos una búsqueda lista en Bestie${counts ? ` (${counts})` : ""} según tu post.`,
    ...(extra ? [extra] : []),
    "Mapa, fotos y WhatsApp: entra y checa las opciones.",
    url,
  ],
];

export function buildDiffusionFacebookComment(input: DiffusionCommentInput): string {
  const url = diffusionPublicShareUrl(input.sharePath);
  const name = firstName(input.seekerName);
  const zone = usefulZone(input.zoneRule, input.placeHint);
  const exact = Math.max(0, Math.floor(Number(input.exactCount) || 0));
  const similar = Math.max(0, Math.floor(Number(input.similarCount) || 0));
  const counts = countsPhrase(exact, similar);
  const extra = extraLine(input.extraCriteria ?? null);
  const seed = (input.variantSeed ?? url).trim() || url;
  const offset = Math.max(0, Math.floor(Number(input.variantOffset) || 0));
  const idx = (hashSeed(seed) + offset) % VARIANTS.length;
  const lines = VARIANTS[idx]!({ name, zone, counts, url, extra });
  let text = lines.filter(Boolean).join("\n\n");
  text = scrubProseDomains(text, url);
  if (!text.includes(url)) {
    text = `${text.trimEnd()}\n\n${url}`;
  }
  text = ensureSignOff(text);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > MAX_COMMENT_CHARS) {
    const body = text
      .replace(url, "")
      .replace(DIFFUSION_COMMENT_SIGN_OFF, "")
      .trim()
      .slice(0, MAX_COMMENT_CHARS - url.length - DIFFUSION_COMMENT_SIGN_OFF.length - 8);
    text = `${body}\n\n${url}\n\n${DIFFUSION_COMMENT_SIGN_OFF}`;
  }
  return text;
}

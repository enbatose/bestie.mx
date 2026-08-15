/**
 * Per-route SEO injected into the SPA HTML shell (crawlers / answer engines that skip JS).
 * Intent keywords lead; brand (Bestie MX) is secondary.
 */
import {
  upsertCanonical,
  upsertJsonLd,
  upsertMetaByName,
  upsertMetaByProperty,
  upsertTitle,
} from "./htmlMeta.js";
import { publicBaseUrl } from "./publicBaseUrl.js";

export type RouteSeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  /** Absolute path to a 1200x630 JPEG; falls back to the shell's og-default.jpg. */
  ogImagePath?: string;
  ogImageAlt?: string;
  jsonLd?: unknown;
  jsonLdId?: string;
  /** App surfaces (wizard, account) that must not enter the search index. */
  noindex?: boolean;
};

const GDL_OG_IMAGE = "/brand/og-gdl.jpg";

const GDL_OG_IMAGE_ALT =
  "Roomie en Guadalajara — Bestie MX, con la silueta de La Minerva";

const HOME_DESC =
  "Bestie MX: marketplace de roomies y cuartos compartidos en México. Empieza por Guadalajara (GDL); más ciudades pronto.";

const GDL_LANDING_DESC =
  "Roomie Guadalajara y roomie GDL: hechos locales, anuncios activos y mapa con filtros para cuartos compartidos y comparto depa en la ZMG.";

const FAQ_DESC =
  "Preguntas frecuentes sobre buscar roomie en Guadalajara, publicar cuartos compartidos, comparto depa GDL y cómo funciona Bestie MX.";

const NOSOTROS_DESC =
  "Bestie MX es la plataforma para encontrar roomie en Guadalajara: cuartos en renta, cuarto compartido y comparto depa con mapa, filtros y contacto directo.";

const GDL_SEARCH_DESC =
  "Roomie Guadalajara y roomie GDL: explora cuartos compartidos, comparto depa y rentas compartidas en el mapa de Bestie MX. Filtra por zona, precio y preferencias.";

const CONTACT_DESC =
  "Contacto Bestie MX — ayuda para buscar roomie en Guadalajara, publicar un cuarto compartido o resolver dudas de tu cuenta.";

const PUBLICAR_DESC =
  "Publica un cuarto compartido o una propiedad en Bestie MX. El asistente de publicación no se indexa; los anuncios públicos viven en /anuncio y /propiedad.";

/** Static marketing / city routes with crawler-visible head tags. */
export const ROUTE_SEO: ReadonlyArray<{ match: RegExp; seo: RouteSeoMeta }> = [
  {
    match: /^\/$/,
    seo: {
      title: "Bestie MX | Roomies y cuartos compartidos en México",
      description: HOME_DESC,
      canonicalPath: "/",
    },
  },
  {
    match: /^\/guadalajara\/?$/i,
    seo: {
      title: "Roomie Guadalajara | Cuartos compartidos y comparto depa GDL — Bestie MX",
      description: GDL_LANDING_DESC,
      canonicalPath: "/guadalajara",
      ogImagePath: GDL_OG_IMAGE,
      ogImageAlt: GDL_OG_IMAGE_ALT,
    },
  },
  {
    match: /^\/gdl\/?$/i,
    seo: {
      title: "Roomie Guadalajara | Cuartos compartidos y comparto depa GDL — Bestie MX",
      description: GDL_LANDING_DESC,
      canonicalPath: "/guadalajara",
      ogImagePath: GDL_OG_IMAGE,
      ogImageAlt: GDL_OG_IMAGE_ALT,
    },
  },
  {
    match: /^\/buscar\/?$/i,
    seo: {
      title: "Buscar roomie Guadalajara | Cuartos compartidos GDL — Bestie MX",
      description: GDL_SEARCH_DESC,
      // Keep the default share card: bare /buscar is city-agnostic once more
      // metros ship. Minerva belongs only on GDL-scoped paths below.
      canonicalPath: "/buscar/gdl",
    },
  },
  {
    match: /^\/buscar\/gdl\/?$/i,
    seo: {
      title: "Roomie GDL | Cuartos en Guadalajara y comparto depa — Bestie MX",
      description: GDL_SEARCH_DESC,
      canonicalPath: "/buscar/gdl",
      ogImagePath: GDL_OG_IMAGE,
      ogImageAlt: GDL_OG_IMAGE_ALT,
    },
  },
  {
    match: /^\/faq\/?$/i,
    seo: {
      title: "FAQ: roomie Guadalajara, cuartos compartidos y Bestie MX",
      description: FAQ_DESC,
      canonicalPath: "/faq",
    },
  },
  {
    match: /^\/nosotros\/?$/i,
    seo: {
      title: "Sobre Bestie MX | Roomies y cuartos compartidos en Guadalajara",
      description: NOSOTROS_DESC,
      canonicalPath: "/nosotros",
    },
  },
  {
    match: /^\/contacto\/?$/i,
    seo: {
      title: "Contacto | Bestie MX — roomie Guadalajara",
      description: CONTACT_DESC,
      canonicalPath: "/contacto",
    },
  },
  {
    match: /^\/publicar(?:\/.*)?$/i,
    seo: {
      title: "Publicar anuncio | Bestie MX",
      description: PUBLICAR_DESC,
      canonicalPath: "/publicar",
      noindex: true,
    },
  },
  {
    match: /^\/legal\/?$/i,
    seo: {
      title: "Legal | Bestie MX",
      description: "Documentos legales de Bestie MX (bestie.mx): términos, privacidad y datos del operador.",
      canonicalPath: "/legal",
    },
  },
  {
    match: /^\/legal\/terminos\/?$/i,
    seo: {
      title: "Términos y Condiciones | Bestie MX",
      description: "Términos y Condiciones del servicio Bestie MX (bestie.mx).",
      canonicalPath: "/legal/terminos",
    },
  },
  {
    match: /^\/legal\/privacidad\/?$/i,
    seo: {
      title: "Aviso de Privacidad | Bestie MX",
      description: "Aviso de Privacidad de Bestie MX (bestie.mx), incluyendo eliminación de datos.",
      canonicalPath: "/legal/privacidad",
    },
  },
];

export function resolveRouteSeo(pathname: string): RouteSeoMeta | null {
  const path = pathname.split("?")[0] || "/";
  for (const row of ROUTE_SEO) {
    if (row.match.test(path)) return row.seo;
  }
  return null;
}

export function injectRouteSeo(
  html: string,
  seo: RouteSeoMeta,
  base: string = publicBaseUrl(),
): string {
  const origin = base.replace(/\/+$/, "");
  const canonical = `${origin}${seo.canonicalPath.startsWith("/") ? seo.canonicalPath : `/${seo.canonicalPath}`}`;
  let out = html;
  out = upsertTitle(out, seo.title);
  out = upsertMetaByName(out, "description", seo.description);
  out = upsertCanonical(out, canonical);
  out = upsertMetaByProperty(out, "og:title", seo.title);
  out = upsertMetaByProperty(out, "og:description", seo.description);
  out = upsertMetaByProperty(out, "og:url", canonical);
  out = upsertMetaByProperty(out, "og:type", "website");
  out = upsertMetaByProperty(out, "og:site_name", "Bestie");
  out = upsertMetaByName(out, "twitter:title", seo.title);
  out = upsertMetaByName(out, "twitter:description", seo.description);
  if (seo.ogImagePath) {
    const imageUrl = `${origin}${seo.ogImagePath}`;
    out = upsertMetaByProperty(out, "og:image", imageUrl);
    out = upsertMetaByProperty(out, "og:image:secure_url", imageUrl);
    out = upsertMetaByName(out, "twitter:image", imageUrl);
    if (seo.ogImageAlt) {
      out = upsertMetaByProperty(out, "og:image:alt", seo.ogImageAlt);
    }
  }
  if (seo.jsonLd != null) {
    out = upsertJsonLd(out, seo.jsonLdId ?? "route", seo.jsonLd);
  }
  if (seo.noindex) {
    out = upsertMetaByName(out, "robots", "noindex, nofollow");
  }
  return out;
}

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
  jsonLd?: unknown;
  jsonLdId?: string;
};

const HOME_DESC =
  "Busca roomie en Guadalajara (GDL): cuartos compartidos, comparto depa y rentas compartidas con mapa y filtros. Publica tu cuarto en Bestie MX.";

const FAQ_DESC =
  "Preguntas frecuentes sobre buscar roomie en Guadalajara, publicar cuartos compartidos, comparto depa GDL y cómo funciona Bestie MX.";

const NOSOTROS_DESC =
  "Bestie MX es la plataforma para encontrar roomie en Guadalajara: cuartos en renta, cuarto compartido y comparto depa con mapa, filtros y contacto directo.";

const GDL_SEARCH_DESC =
  "Roomie Guadalajara y roomie GDL: explora cuartos compartidos, comparto depa y rentas compartidas en el mapa de Bestie MX. Filtra por zona, precio y preferencias.";

const CONTACT_DESC =
  "Contacto Bestie MX — ayuda para buscar roomie en Guadalajara, publicar un cuarto compartido o resolver dudas de tu cuenta.";

/** Static marketing / city routes with crawler-visible head tags. */
export const ROUTE_SEO: ReadonlyArray<{ match: RegExp; seo: RouteSeoMeta }> = [
  {
    match: /^\/$/,
    seo: {
      title: "Roomie Guadalajara | Cuartos compartidos y comparto depa GDL — Bestie MX",
      description: HOME_DESC,
      canonicalPath: "/",
    },
  },
  {
    match: /^\/buscar\/?$/i,
    seo: {
      title: "Buscar roomie Guadalajara | Cuartos compartidos GDL — Bestie MX",
      description: GDL_SEARCH_DESC,
      canonicalPath: "/buscar/gdl",
    },
  },
  {
    match: /^\/buscar\/gdl\/?$/i,
    seo: {
      title: "Roomie GDL | Cuartos en Guadalajara y comparto depa — Bestie MX",
      description: GDL_SEARCH_DESC,
      canonicalPath: "/buscar/gdl",
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
  if (seo.jsonLd != null) {
    out = upsertJsonLd(out, seo.jsonLdId ?? "route", seo.jsonLd);
  }
  return out;
}

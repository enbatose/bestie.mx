/**
 * Client-side document head helpers for per-route SEO.
 * Marketing/search pages also get server-injected meta in production (see server/routeSeo).
 */

export const SITE_ORIGIN = "https://www.bestie.mx";
export const BRAND_NAME = "Bestie MX";
export const BRAND_SHORT = "Bestie";

/** Primary intent keywords — country hub. City pages carry GDL-specific copy. */
export const PRIMARY_SEO_DESCRIPTION =
  "Bestie MX: marketplace de roomies y cuartos compartidos en México. Empieza por Guadalajara (GDL); más ciudades pronto.";

export const DEFAULT_SEO = {
  title: "Bestie MX | Roomies y cuartos compartidos en México",
  description: PRIMARY_SEO_DESCRIPTION,
  canonicalPath: "/",
} as const;

export type PageSeoInput = {
  title: string;
  description: string;
  /** Path starting with `/`, or absolute URL. */
  canonicalPath?: string;
  ogType?: string;
  noindex?: boolean;
  /** JSON-LD objects to inject (replaces previous bestie-jsonld scripts). */
  jsonLd?: readonly Record<string, unknown>[];
};

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

function upsertMetaByName(name: string, content: string) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLinkRel(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

const JSON_LD_ATTR = "data-bestie-jsonld";

function clearManagedJsonLd() {
  document.head.querySelectorAll(`script[${JSON_LD_ATTR}]`).forEach((n) => n.remove());
}

function injectJsonLd(blocks: readonly Record<string, unknown>[]) {
  clearManagedJsonLd();
  for (const block of blocks) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(JSON_LD_ATTR, "1");
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  }
}

/** Apply title, description, canonical, OG/Twitter, optional robots and JSON-LD. */
export function applyPageSeo(input: PageSeoInput): () => void {
  const prevTitle = document.title;
  const canonical = absoluteUrl(input.canonicalPath ?? window.location.pathname);
  const ogType = input.ogType ?? "website";

  document.title = input.title;
  upsertMetaByName("description", input.description);
  upsertLinkRel("canonical", canonical);
  upsertMetaByProperty("og:title", input.title);
  upsertMetaByProperty("og:description", input.description);
  upsertMetaByProperty("og:url", canonical);
  upsertMetaByProperty("og:type", ogType);
  upsertMetaByProperty("og:site_name", BRAND_SHORT);
  upsertMetaByName("twitter:title", input.title);
  upsertMetaByName("twitter:description", input.description);

  if (input.noindex) {
    upsertMetaByName("robots", "noindex, nofollow");
  } else {
    const robots = document.head.querySelector('meta[name="robots"]');
    if (robots?.getAttribute("content")?.includes("noindex")) {
      robots.remove();
    }
  }

  if (input.jsonLd?.length) {
    injectJsonLd(input.jsonLd);
  }

  return () => {
    document.title = prevTitle;
    clearManagedJsonLd();
  };
}

export function faqPageJsonLd(
  items: readonly { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function aboutPageJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre Bestie MX",
    url: `${SITE_ORIGIN}/nosotros`,
    description: PRIMARY_SEO_DESCRIPTION,
    about: {
      "@type": "Organization",
      name: BRAND_NAME,
      alternateName: [BRAND_SHORT, "bestie.mx"],
      url: SITE_ORIGIN,
    },
  };
}

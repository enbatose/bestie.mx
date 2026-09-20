import type { Express, Request, Response } from "express";

/**
 * Clean, same-domain short links for offline / social outreach (Facebook groups,
 * WhatsApp, etc.) where a raw `?utm_source=...` query string reads as spammy or
 * trips group anti-spam bots. Each slug 302-redirects to the real destination
 * with UTM params attached server-side, invisible to whoever clicks the link.
 *
 * Add a new campaign by adding one entry below — no other wiring needed.
 */
export type VanityRedirect = {
  /** Path segment after the domain, e.g. "roomies-gdl" for bestie.mx/roomies-gdl. */
  slug: string;
  /** Destination path (canonical site route), e.g. "/guadalajara". */
  destinationPath: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
  };
};

/** Absolute off-site targets (e.g. wa.me) behind a short bestie.mx path. */
export type ExternalVanityRedirect = {
  slug: string;
  /** Full URL including query string. */
  targetUrl: string;
};

export const VANITY_REDIRECTS: readonly VanityRedirect[] = [
  {
    slug: "roomies-gdl",
    destinationPath: "/guadalajara",
    utm: { source: "facebook", medium: "group", campaign: "roomies_gdl_doria", content: "pinned_post" },
  },
  {
    slug: "gdl-grupo",
    destinationPath: "/guadalajara",
    utm: { source: "facebook", medium: "group", campaign: "roomies_gdl_doria", content: "cover_photo" },
  },
];

const WHATSAPP_BOT_SUPPORT_PREFILL =
  "Hola, necesito ayuda con el flujo de creación o búsqueda de publicaciones en WhatsApp";

/** Human support line (+52 331 835713 7) — short link for WhatsApp Ayuda. */
export const WHATSAPP_BOT_SUPPORT_VANITY: ExternalVanityRedirect = {
  slug: "ayuda-wa",
  targetUrl: `https://wa.me/523318357137?text=${encodeURIComponent(WHATSAPP_BOT_SUPPORT_PREFILL)}`,
};

export const EXTERNAL_VANITY_REDIRECTS: readonly ExternalVanityRedirect[] = [WHATSAPP_BOT_SUPPORT_VANITY];

export function buildVanityRedirectUrl(entry: VanityRedirect, base: string): string {
  const url = new URL(entry.destinationPath, base);
  url.searchParams.set("utm_source", entry.utm.source);
  url.searchParams.set("utm_medium", entry.utm.medium);
  url.searchParams.set("utm_campaign", entry.utm.campaign);
  url.searchParams.set("utm_content", entry.utm.content);
  return url.toString();
}

/** Mount before the SPA static/catch-all handler. */
export function installVanityRedirects(app: Express, baseForRequest: (req: Request) => string): void {
  for (const entry of VANITY_REDIRECTS) {
    app.get(`/${entry.slug}`, (req: Request, res: Response) => {
      res.redirect(302, buildVanityRedirectUrl(entry, baseForRequest(req)));
    });
  }
  for (const entry of EXTERNAL_VANITY_REDIRECTS) {
    app.get(`/${entry.slug}`, (_req: Request, res: Response) => {
      res.redirect(302, entry.targetUrl);
    });
  }
}

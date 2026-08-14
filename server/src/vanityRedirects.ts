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
}

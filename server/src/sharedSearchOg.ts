import type { DatabaseSync } from "node:sqlite";
import {
  injectListingShareOg,
  truncateOgText,
  OG_TITLE_MAX,
  OG_DESC_MAX,
  type ListingShareOgMeta,
} from "./listingShareOg.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import { findGdlSeekerCampaign, formatCampaignShareOg } from "./gdlSeekerCampaigns.js";
import { sharedSearchPublicMeta } from "./sharedSearches.js";

const BUSQUEDAS_RE = /^\/busquedas\/([a-z0-9]{6,16})\/?$/i;

export function resolveSharedSearchOg(
  db: DatabaseSync,
  pathname: string,
  origin: string = publicBaseUrl(),
): ListingShareOgMeta | null {
  const match = pathname.match(BUSQUEDAS_RE);
  if (!match) return null;
  const slug = match[1]!;
  const meta = sharedSearchPublicMeta(db, slug);
  if (!meta) return null;
  const url = `${origin.replace(/\/$/, "")}${meta.sharePath}`;
  const campaign = findGdlSeekerCampaign(slug);
  if (campaign) {
    const og = formatCampaignShareOg(campaign, meta.exactCount, meta.similarCount, origin);
    return {
      title: og.title,
      description: og.description,
      url,
      imageUrl: og.imageUrl,
      noIndex: true,
    };
  }
  return {
    title: truncateOgText(meta.caption, OG_TITLE_MAX),
    description: truncateOgText(
      `${meta.label}. Inicia sesión en Bestie para ver coincidencias exactas y similares en el mapa.`,
      OG_DESC_MAX,
    ),
    url,
    imageUrl: `${origin.replace(/\/$/, "")}/brand/og-gdl.jpg`,
    noIndex: true,
  };
}

export function injectSharedSearchOg(html: string, meta: ListingShareOgMeta): string {
  return injectListingShareOg(html, meta);
}

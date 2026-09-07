import type { DatabaseSync } from "node:sqlite";
import {
  injectListingShareOg,
  truncateOgText,
  OG_TITLE_MAX,
  OG_DESC_MAX,
  type ListingShareOgMeta,
} from "./listingShareOg.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import { findGdlSeekerCampaign, formatCampaignShareOg, CAMPAIGN_OG_IMAGE_EDGE } from "./gdlSeekerCampaigns.js";
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
  const campaign = findGdlSeekerCampaign(slug);
  const originBase = origin.replace(/\/$/, "");
  // Paid campaign slugs must still emit POI cards if boot-seed has not run yet.
  if (campaign) {
    const og = formatCampaignShareOg(
      campaign,
      meta?.exactCount ?? 0,
      meta?.similarCount ?? 0,
      originBase,
    );
    return {
      title: og.title,
      description: og.description,
      url: `${originBase}/busquedas/${campaign.id}`,
      imageUrl: og.imageUrl,
      imageAlt: og.imageAlt,
      imageWidth: CAMPAIGN_OG_IMAGE_EDGE,
      imageHeight: CAMPAIGN_OG_IMAGE_EDGE,
      noIndex: true,
    };
  }
  if (!meta) return null;
  return {
    title: truncateOgText(meta.caption, OG_TITLE_MAX),
    description: truncateOgText(
      meta.zoneRule && meta.zoneRule !== "Área del mapa"
        ? `${meta.zoneRule}. ${meta.exactCount} en zona y ${meta.similarCount} cerca en Bestie — abre el mapa.`
        : `${meta.label}. Abre en Bestie para ver cuartos en zona y cerca en el mapa.`,
      OG_DESC_MAX,
    ),
    url: `${originBase}${meta.sharePath}`,
    imageUrl: `${originBase}/brand/og-gdl.jpg`,
    noIndex: true,
  };
}

export function injectSharedSearchOg(html: string, meta: ListingShareOgMeta): string {
  return injectListingShareOg(html, meta);
}

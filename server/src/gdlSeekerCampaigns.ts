import type { DatabaseSync } from "node:sqlite";
import { GDL_SEARCH_POIS } from "./gdlSearchPois.js";
import type { Bbox } from "./searchFilters.js";
import { EMPTY_SEARCH_FILTERS, defaultSimilarConfig } from "./sharedSearchMatch.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";
import { OG_DESC_MAX, OG_TITLE_MAX, truncateOgText } from "./listingShareOg.js";
import { upsertSharedSearch, type SharedSearchRow } from "./sharedSearches.js";

/** Same “cerca” radius as GDL seeker ads. */
export const CAMPAIGN_EXACT_KM = 3.5;

export type GdlSeekerCampaign = {
  id: string;
  poiName: string;
  label: string;
  lat: number;
  lng: number;
  zoom: number;
  ogImagePath: string;
  imageAlt: string;
  /** Live exact/similar counts are filled in at crawl time. */
  title: (exact: number, similar: number) => string;
  description: (exact: number, similar: number) => string;
};

/** Bump when the JPEG changes so WhatsApp / Facebook recrawl the preview. */
export const CAMPAIGN_OG_IMAGE_VERSION = "4";
export const CAMPAIGN_OG_IMAGE_EDGE = 1200;

function roomsWord(n: number): string {
  return n === 1 ? "cuarto" : "cuartos";
}

function similarWord(n: number): string {
  return n === 1 ? "similar" : "similares";
}

function campaignOgTitle(where: string, exact: number, similar: number): string {
  if (exact <= 0) return `Bestie: cuartos ${where}`;
  if (similar <= 0) return `Bestie: ${exact} ${roomsWord(exact)} ${where}`;
  return `Bestie: ${exact} ${roomsWord(exact)} y ${similar} ${similarWord(similar)} ${where}`;
}

function campaignOgCountsLead(exact: number, similar: number): string {
  const exactLabel = `${exact} ${exact === 1 ? "coincidencia exacta" : "coincidencias exactas"}`;
  return `${exactLabel}, ${similar} ${similarWord(similar)}`;
}

function poi(name: string) {
  const hit = GDL_SEARCH_POIS.find((p) => p.name === name);
  if (!hit) throw new Error(`missing GDL POI ${name}`);
  return hit;
}

export function radiusBbox(lat: number, lng: number, km: number): Bbox {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

const chapu = poi("Zona Chapultepec/Americana");
const centro = poi("Centro");
const cucs = poi("CUCS");

export const GDL_SEEKER_CAMPAIGNS: readonly GdlSeekerCampaign[] = [
  {
    id: "gdlchapu",
    poiName: chapu.name,
    label: "GDL · Zona Chapultepec/Americana",
    lat: chapu.lat,
    lng: chapu.lng,
    zoom: 14,
    ogImagePath: "/brand/og-busquedas/gdlchapu.jpg",
    imageAlt: "Glorieta Niños Héroes en Avenida Chapultepec — Bestie MX",
    title: (exact, similar) => campaignOgTitle("en Zona Chapultepec/Americana", exact, similar),
    description: (exact, similar) =>
      exact > 0
        ? `${campaignOgCountsLead(exact, similar)}. Time Out eligió Americana el barrio más cool del mundo.`
        : "Time Out eligió Americana el barrio más cool del mundo. Entra para ver los cuartos en el mapa.",
  },
  {
    id: "gdlcentro",
    poiName: centro.name,
    label: "GDL · Centro",
    lat: centro.lat,
    lng: centro.lng,
    zoom: 14,
    ogImagePath: "/brand/og-busquedas/gdlcentro.jpg",
    imageAlt: "Catedral de Guadalajara en el Centro — Bestie MX",
    title: (exact, similar) => campaignOgTitle("en el Centro de Guadalajara", exact, similar),
    description: (exact, similar) =>
      exact > 0
        ? `${campaignOgCountsLead(exact, similar)}. Línea 3 te deja en la Catedral.`
        : "Línea 3 te deja en la Catedral. Entra para abrir los cuartos en el mapa.",
  },
  {
    id: "gdlcucs",
    poiName: cucs.name,
    label: "GDL · CUCS",
    lat: cucs.lat,
    lng: cucs.lng,
    zoom: 14,
    ogImagePath: "/brand/og-busquedas/gdlcucs.jpg",
    imageAlt: "Plaza junto a CUCS y el Hospital Civil — Bestie MX",
    title: (exact, similar) => campaignOgTitle("cerca de CUCS", exact, similar),
    description: (exact, similar) =>
      exact > 0
        ? `${campaignOgCountsLead(exact, similar)}. CUCS y el Hospital Civil.`
        : "CUCS y el Hospital Civil. Entra para ver los cuartos en el mapa.",
  },
];

export function findGdlSeekerCampaign(id: string): GdlSeekerCampaign | null {
  return GDL_SEEKER_CAMPAIGNS.find((c) => c.id === id) ?? null;
}

export function formatCampaignShareOg(
  campaign: GdlSeekerCampaign,
  exactCount: number,
  similarCount: number,
  origin: string,
): { title: string; description: string; imageUrl: string; imageAlt: string } {
  const base = origin.replace(/\/$/, "");
  return {
    title: truncateOgText(campaign.title(exactCount, similarCount), OG_TITLE_MAX),
    description: truncateOgText(campaign.description(exactCount, similarCount), OG_DESC_MAX),
    imageUrl: `${base}${campaign.ogImagePath}?v=${CAMPAIGN_OG_IMAGE_VERSION}`,
    imageAlt: campaign.imageAlt,
  };
}

function campaignRow(campaign: GdlSeekerCampaign, createdBy: string, now: string): SharedSearchRow {
  const bbox = radiusBbox(campaign.lat, campaign.lng, CAMPAIGN_EXACT_KM);
  const location: SavedSearchLocationSnapshot = {
    cityCode: "gdl",
    cityLabel: "Guadalajara",
    neighborhoods: [],
    lat: campaign.lat,
    lng: campaign.lng,
    zoom: campaign.zoom,
  };
  const similar = defaultSimilarConfig({
    pois: [{ name: campaign.poiName, lat: campaign.lat, lng: campaign.lng }],
    bbox,
    radiusKm: CAMPAIGN_EXACT_KM,
  });
  return {
    id: campaign.id,
    kind: "campaign",
    forked_from_id: null,
    owner_user_id: null,
    created_by_user_id: createdBy,
    source_facebook_url: null,
    source_facebook_key: null,
    seeker_name: null,
    seeker_gender: null,
    city_code: "gdl",
    city_label: "Guadalajara",
    label: campaign.label,
    filters_json: JSON.stringify(EMPTY_SEARCH_FILTERS),
    location_json: JSON.stringify(location),
    similar_json: JSON.stringify(similar),
    insights_json: JSON.stringify([
      { label: "Campaña", text: `Seekers Meta ads · ${campaign.poiName}`, mapped: true },
    ]),
    non_negotiables_json: JSON.stringify([]),
    q_text: campaign.poiName,
    created_at: now,
    updated_at: now,
  };
}

/** Idempotent: keeps `/busquedas/gdlchapu` etc. stable for paid ads. */
export function ensureGdlSeekerCampaignShares(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const createdBy = "gdl-seeker-campaigns";
  for (const campaign of GDL_SEEKER_CAMPAIGNS) {
    upsertSharedSearch(db, campaignRow(campaign, createdBy, now));
  }
}

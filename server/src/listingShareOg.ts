/**
 * Open Graph / social preview meta for shareable listing URLs.
 * WhatsApp, Messenger, and Facebook scrapers do not run the SPA — they need
 * listing-specific tags in the HTML served for `/anuncio/…` and `/propiedad/…`.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  upsertCanonical,
  upsertJsonLd,
  upsertMetaByName,
  upsertMetaByProperty,
  upsertTitle,
} from "./htmlMeta.js";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import {
  propertyReferenceCode,
  roomReferenceCode,
} from "./listingReference.js";
import { publicBaseUrl } from "./publicBaseUrl.js";
import {
  resolvePropertyIdFromRouteParam,
  resolveRoomIdFromRouteParam,
} from "./resolveListingRouteId.js";
import { coverUploadFilename, shareOgImagePublicPath } from "./shareOgImage.js";
import type { PropertyListing } from "./types.js";

/** Facebook-oriented limits (WhatsApp truncates earlier; FB is the longer of the two). */
export const OG_TITLE_MAX = 90;
export const OG_DESC_MAX = 200;

export type ListingShareOgMeta = {
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  /** Optional Offer / RealEstateListing JSON-LD for crawlers. */
  jsonLd?: unknown;
};

/** Trim at a word boundary when possible so previews don't cut mid-word. */
export function truncateOgText(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const sp = slice.lastIndexOf(" ");
  const base = sp > Math.floor(max * 0.55) ? slice.slice(0, sp) : slice;
  return `${base.replace(/[.,;:!?¿¡\s]+$/u, "")}…`;
}

function formatRentMxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN/mes`;
}

function formatRentRange(min: number, max: number): string {
  if (min === max) return formatRentMxn(min);
  return `$${Math.round(min).toLocaleString("es-MX")} – $${Math.round(max).toLocaleString("es-MX")} MXN/mes`;
}

function placeLine(listing: Pick<PropertyListing, "neighborhood" | "city">): string {
  return [listing.neighborhood, listing.city].map((s) => s.trim()).filter(Boolean).join(", ");
}

/** Absolute HTTPS URL for an upload path, or null if unusable. */
export function absoluteUploadUrl(base: string, raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("https://") || t.startsWith("http://")) {
    try {
      const u = new URL(t);
      if (!u.pathname.startsWith("/api/uploads/")) return null;
      return u.toString();
    } catch {
      return null;
    }
  }
  if (!t.startsWith("/api/uploads/") || t.includes("..") || t.includes("\\")) return null;
  return `${base.replace(/\/+$/, "")}${t}`;
}

/**
 * Cover for OG: room posts prefer room photos; property posts prefer property/cover photos.
 * Returns the branded `/api/share-og/…` URL (watermarked) when a cover upload exists.
 */
export function coverImageForPost(
  base: string,
  listing: Pick<
    PropertyListing,
    "id" | "propertyId" | "propertyPostMode" | "propertyImageUrls" | "roomImageUrls"
  >,
  mode: "room" | "property",
): string | null {
  const filename = coverUploadFilename(listing, mode);
  if (!filename) return null;
  const origin = base.replace(/\/+$/, "");
  if (mode === "property") {
    return `${origin}${shareOgImagePublicPath("propiedad", propertyReferenceCode(listing.propertyId))}`;
  }
  return `${origin}${shareOgImagePublicPath("anuncio", roomReferenceCode(listing.id))}`;
}

export function buildRoomShareOg(
  listing: PropertyListing,
  base: string = publicBaseUrl(),
): ListingShareOgMeta {
  const title = truncateOgText(
    (listing.propertyPostMode === "room"
      ? listing.propertyTitle?.trim() || listing.title
      : listing.title
    ).trim() || "Anuncio en Bestie",
    OG_TITLE_MAX,
  );

  const parts: string[] = [formatRentMxn(listing.rentMxn)];
  const place = placeLine(listing);
  if (place) parts.push(place);
  if (listing.lodgingType === "private_room") parts.push("Recámara privada");
  else if (listing.lodgingType === "shared_room") parts.push("Recámara compartida");
  else if (listing.lodgingType === "whole_home") parts.push("Espacio completo");
  const summary = (listing.summary ?? "").trim();
  if (summary) parts.push(summary);

  const url = `${base}/anuncio/${roomReferenceCode(listing.id)}`;
  const description = truncateOgText(parts.join(" · "), OG_DESC_MAX);
  const imageUrl = coverImageForPost(base, listing, "room");
  return {
    title,
    description,
    url,
    imageUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: title,
      description,
      url,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(Number.isFinite(listing.rentMxn) && listing.rentMxn > 0
        ? {
            offers: {
              "@type": "Offer",
              price: listing.rentMxn,
              priceCurrency: "MXN",
              availability: "https://schema.org/InStock",
            },
          }
        : {}),
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.city || "Guadalajara",
        addressRegion: "Jalisco",
        addressCountry: "MX",
        ...(listing.neighborhood ? { addressNeighborhood: listing.neighborhood } : {}),
      },
    },
  };
}

export function buildPropertyShareOg(
  propertyTitle: string,
  place: { neighborhood: string; city: string },
  availableRooms: readonly PropertyListing[],
  coverFrom: Pick<
    PropertyListing,
    "id" | "propertyId" | "propertyPostMode" | "propertyImageUrls" | "roomImageUrls"
  >,
  propertyId: string,
  summary: string,
  base: string = publicBaseUrl(),
): ListingShareOgMeta {
  const title = truncateOgText(propertyTitle.trim() || "Propiedad en Bestie", OG_TITLE_MAX);
  const rents = availableRooms.map((r) => r.rentMxn).filter((n) => Number.isFinite(n) && n > 0);
  const n = availableRooms.length;
  const parts: string[] = [];
  if (rents.length) {
    parts.push(formatRentRange(Math.min(...rents), Math.max(...rents)));
  }
  parts.push(n === 1 ? "1 cuarto disponible" : `${n} cuartos disponibles`);
  const placeLineStr = placeLine(place);
  if (placeLineStr) parts.push(placeLineStr);
  const sum = summary.trim();
  if (sum) parts.push(sum);

  const url = `${base}/propiedad/${propertyReferenceCode(propertyId)}`;
  const description = truncateOgText(parts.join(" · "), OG_DESC_MAX);
  const imageUrl = coverImageForPost(
    base,
    { ...coverFrom, propertyId, id: coverFrom.id || availableRooms[0]?.id || propertyId },
    "property",
  );
  const minRent = rents.length ? Math.min(...rents) : null;
  return {
    title,
    description,
    url,
    imageUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: title,
      description,
      url,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(minRent != null
        ? {
            offers: {
              "@type": "AggregateOffer",
              lowPrice: Math.min(...rents),
              highPrice: Math.max(...rents),
              priceCurrency: "MXN",
              offerCount: n,
            },
          }
        : {}),
      address: {
        "@type": "PostalAddress",
        addressLocality: place.city || "Guadalajara",
        addressRegion: "Jalisco",
        addressCountry: "MX",
        ...(place.neighborhood ? { addressNeighborhood: place.neighborhood } : {}),
      },
    },
  };
}

function loadPublishedRoom(db: DatabaseSync, roomId: string): PropertyListing | null {
  const row = db
    .prepare(
      `${ROOM_PROPERTY_JOIN_SQL}
       WHERE r.id = ?
         AND r.status = 'published'
         AND p.status = 'published'
         AND IFNULL(r.occupancy_status, 'available') != 'occupied'`,
    )
    .get(roomId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return joinRowToPropertyListing(row);
}

function loadPropertyShareContext(
  db: DatabaseSync,
  propertyId: string,
): {
  propertyTitle: string;
  neighborhood: string;
  city: string;
  summary: string;
  coverListing: PropertyListing;
  availableRooms: PropertyListing[];
} | null {
  const prop = db
    .prepare(
      `SELECT id, title, neighborhood, city, summary, status, image_urls_json, post_mode
       FROM properties WHERE id = ?`,
    )
    .get(propertyId) as
    | {
        id: string;
        title: string;
        neighborhood: string;
        city: string;
        summary: string | null;
        status: string;
        image_urls_json: string | null;
        post_mode: string | null;
      }
    | undefined;
  if (!prop || String(prop.status) !== "published") return null;

  const rows = db
    .prepare(
      `${ROOM_PROPERTY_JOIN_SQL}
       WHERE p.id = ?
         AND r.status = 'published'
         AND p.status = 'published'
         AND IFNULL(r.occupancy_status, 'available') != 'occupied'
       ORDER BY r.sort_order ASC, r.rent_mxn ASC, r.id ASC`,
    )
    .all(propertyId) as Record<string, unknown>[];
  const availableRooms = rows.map(joinRowToPropertyListing);
  if (availableRooms.length === 0) return null;

  const coverListing = availableRooms[0]!;
  // Prefer property-row images for cover even if the join already has them.
  try {
    const imgs = JSON.parse(String(prop.image_urls_json ?? "[]")) as unknown;
    if (Array.isArray(imgs) && imgs.length) {
      coverListing.propertyImageUrls = imgs.map(String).filter(Boolean);
    }
  } catch {
    /* keep join images */
  }

  return {
    propertyTitle: String(prop.title ?? ""),
    neighborhood: String(prop.neighborhood ?? ""),
    city: String(prop.city ?? ""),
    summary: String(prop.summary ?? ""),
    coverListing,
    availableRooms,
  };
}

/** Resolve OG payload for a public path, or null to leave the SPA shell as-is. */
export function resolveListingShareOg(
  db: DatabaseSync,
  pathname: string,
  base: string = publicBaseUrl(),
): ListingShareOgMeta | null {
  const anuncio = pathname.match(/^\/anuncio\/([^/]+)\/?$/i);
  if (anuncio) {
    const roomId = resolveRoomIdFromRouteParam(db, decodeURIComponent(anuncio[1]!));
    if (!roomId) return null;
    const listing = loadPublishedRoom(db, roomId);
    if (!listing) return null;
    // Property-mode rooms still get room-level OG when the URL is `/anuncio/…`
    // (e.g. search / email deep links). Owner "Compartir" uses `/propiedad/…`.
    return buildRoomShareOg(listing, base);
  }

  const propiedad = pathname.match(/^\/propiedad\/([^/]+)\/?$/i);
  if (propiedad) {
    const propertyId = resolvePropertyIdFromRouteParam(db, decodeURIComponent(propiedad[1]!));
    if (!propertyId) return null;
    const ctx = loadPropertyShareContext(db, propertyId);
    if (!ctx) return null;
    return buildPropertyShareOg(
      ctx.propertyTitle,
      { neighborhood: ctx.neighborhood, city: ctx.city },
      ctx.availableRooms,
      ctx.coverListing,
      propertyId,
      ctx.summary,
      base,
    );
  }

  return null;
}

/** Public Facebook App ID from env (safe to expose in page meta). */
export function facebookAppIdFromEnv(): string | null {
  const id = process.env.FACEBOOK_APP_ID?.trim();
  return id || null;
}

/** Inject `fb:app_id` when configured — clears Sharing Debugger warning; ties shares to the app. */
export function injectFacebookAppId(html: string, appId: string | null = facebookAppIdFromEnv()): string {
  if (!appId) return html;
  return upsertMetaByProperty(html, "fb:app_id", appId);
}

/** Inject listing OG (+ twitter card) into the SPA `index.html` shell. */
export function injectListingShareOg(html: string, meta: ListingShareOgMeta): string {
  let out = html;
  out = upsertTitle(out, meta.title);
  out = upsertMetaByName(out, "description", meta.description);
  out = upsertCanonical(out, meta.url);
  out = upsertMetaByProperty(out, "og:title", meta.title);
  out = upsertMetaByProperty(out, "og:description", meta.description);
  out = upsertMetaByProperty(out, "og:url", meta.url);
  out = upsertMetaByProperty(out, "og:type", "website");
  out = upsertMetaByProperty(out, "og:site_name", "Bestie");
  if (meta.imageUrl) {
    out = upsertMetaByProperty(out, "og:image", meta.imageUrl);
    out = upsertMetaByProperty(out, "og:image:secure_url", meta.imageUrl);
  }
  out = upsertMetaByName(out, "twitter:card", meta.imageUrl ? "summary_large_image" : "summary");
  out = upsertMetaByName(out, "twitter:title", meta.title);
  out = upsertMetaByName(out, "twitter:description", meta.description);
  if (meta.imageUrl) {
    out = upsertMetaByName(out, "twitter:image", meta.imageUrl);
  }
  if (meta.jsonLd != null) {
    out = upsertJsonLd(out, "listing", meta.jsonLd);
  }
  out = injectFacebookAppId(out);
  return out;
}

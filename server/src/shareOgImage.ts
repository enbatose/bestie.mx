/**
 * Branded JPEG for Open Graph / WhatsApp / Messenger link previews.
 * Listing gallery photos stay unbranded; only `/api/share-og/…` is watermarked.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";
import {
  resolvePropertyIdFromRouteParam,
  resolveRoomIdFromRouteParam,
} from "./resolveListingRouteId.js";
import type { PropertyListing } from "./types.js";

const MAX_SHARE_EDGE = 1200;
/**
 * Lockup width vs photo — WhatsApp thumbs are tiny; keep the wordmark readable.
 * ~45% of edge ≈ 540px on a 1200 canvas.
 */
const LOCKUP_WIDTH_RATIO = 0.45;
/** Inset from edges so WhatsApp round corners / side crops don’t clip the badge. */
const EDGE_PAD_RATIO = 0.055;
const BADGE_PAD_RATIO = 0.018;
/** Bump when overlay layout changes so clients re-fetch. */
export const SHARE_OG_IMAGE_VERSION = "v3";

const UPLOAD_PATH_RE =
  /^\/api\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]{0,200}\.(?:jpg|jpeg|png|webp|gif))$/i;

export function uploadFilenameFromListingPath(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  let pathname = t;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      pathname = new URL(t).pathname;
    } catch {
      return null;
    }
  }
  const m = pathname.match(UPLOAD_PATH_RE);
  return m ? m[1]! : null;
}

/** First cover upload filename for room vs property post mode. */
export function coverUploadFilename(
  listing: Pick<PropertyListing, "propertyPostMode" | "propertyImageUrls" | "roomImageUrls">,
  mode: "room" | "property",
): string | null {
  const property = listing.propertyImageUrls ?? [];
  const room = listing.roomImageUrls ?? [];
  const ordered =
    mode === "room"
      ? room.length > 0
        ? room
        : property
      : property.length > 0
        ? property
        : room;
  for (const u of ordered) {
    const name = uploadFilenameFromListingPath(u);
    if (name) return name;
  }
  return null;
}

export function shareOgImagePublicPath(kind: "anuncio" | "propiedad", refCode: string): string {
  const safe = encodeURIComponent(refCode.replace(/\.jpg$/i, ""));
  return `/api/share-og/${kind}/${safe}.jpg`;
}

function resolveBrandLockupPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Copied next to dist during `npm run build` / Docker.
    path.resolve(here, "assets/brand/logo-lockup-on-dark.svg"),
    path.resolve(here, "../assets/brand/logo-lockup-on-dark.svg"),
    path.resolve(process.cwd(), "assets/brand/logo-lockup-on-dark.svg"),
    path.resolve(process.cwd(), "server/assets/brand/logo-lockup-on-dark.svg"),
    // Vite copies public/brand into dist/brand (sibling of server/ in Docker).
    path.resolve(process.cwd(), "../dist/brand/logo-lockup-on-dark.svg"),
    path.resolve(process.cwd(), "dist/brand/logo-lockup-on-dark.svg"),
    path.resolve(process.cwd(), "public/brand/logo-lockup-on-dark.svg"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function readUploadBytes(
  uploadDir: string,
  db: DatabaseSync | undefined,
  filename: string,
): Buffer | null {
  const fp = path.join(path.resolve(uploadDir), path.basename(filename));
  if (!fp.startsWith(path.resolve(uploadDir))) return null;
  if (fs.existsSync(fp)) {
    try {
      return fs.readFileSync(fp);
    } catch {
      return null;
    }
  }
  const row = db
    ?.prepare(`SELECT bytes FROM upload_blobs WHERE filename = ?`)
    .get(filename) as { bytes?: unknown } | undefined;
  if (!row?.bytes) return null;
  return Buffer.from(row.bytes as Uint8Array);
}

/**
 * Composite Bestie lockup (mark + bestie.mx) top-left on a semi-opaque badge.
 * Square cover crop; inset so WhatsApp’s rounded preview corners don’t clip it.
 */
export async function composeBrandedShareImage(source: Buffer): Promise<Buffer> {
  const lockupPath = resolveBrandLockupPath();
  if (!lockupPath) {
    console.warn("[share-og] brand lockup SVG not found; serving unbranded cover");
    return sharp(source)
      .rotate()
      .resize(MAX_SHARE_EDGE, MAX_SHARE_EDGE, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  }

  const { data: photoBuf, info } = await sharp(source)
    .rotate()
    .resize(MAX_SHARE_EDGE, MAX_SHARE_EDGE, { fit: "cover", position: "centre" })
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const pad = Math.max(48, Math.round(w * EDGE_PAD_RATIO));
  const badgePad = Math.max(12, Math.round(w * BADGE_PAD_RATIO));
  const lockupW = Math.max(220, Math.round(w * LOCKUP_WIDTH_RATIO));
  // Lockup SVG viewBox 251×74
  const lockupH = Math.max(64, Math.round((lockupW * 74) / 251));
  const badgeW = lockupW + badgePad * 2;
  const badgeH = lockupH + badgePad * 2;
  const radius = Math.max(12, Math.round(badgeH * 0.22));

  const badgeSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeW}" height="${badgeH}">
      <rect width="${badgeW}" height="${badgeH}" rx="${radius}" ry="${radius}" fill="rgba(20,61,48,0.88)"/>
    </svg>`,
  );
  const badgePng = await sharp(badgeSvg).png().toBuffer();
  const lockupPng = await sharp(fs.readFileSync(lockupPath))
    .resize(lockupW, lockupH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Top-left with generous inset (WhatsApp clips top-right and outer corners).
  const left = pad;
  const top = pad;

  return sharp(photoBuf)
    .composite([
      { input: badgePng, left, top },
      { input: lockupPng, left: left + badgePad, top: top + badgePad },
    ])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
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

function loadPropertyCoverListing(db: DatabaseSync, propertyId: string): PropertyListing | null {
  const prop = db
    .prepare(`SELECT id, status, image_urls_json FROM properties WHERE id = ?`)
    .get(propertyId) as { id: string; status: string; image_urls_json: string | null } | undefined;
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
  if (!rows.length) return null;
  const cover = joinRowToPropertyListing(rows[0]!);
  try {
    const imgs = JSON.parse(String(prop.image_urls_json ?? "[]")) as unknown;
    if (Array.isArray(imgs) && imgs.length) {
      cover.propertyImageUrls = imgs.map(String).filter(Boolean);
    }
  } catch {
    /* keep join */
  }
  return cover;
}

export type ShareOgImageRequest = {
  kind: "anuncio" | "propiedad";
  refParam: string;
};

/** Resolve source upload for a share-og request, or null if not publicly available. */
export function resolveShareOgSourceFilename(
  db: DatabaseSync,
  req: ShareOgImageRequest,
): string | null {
  const ref = req.refParam.replace(/\.jpe?g$/i, "").trim();
  if (req.kind === "anuncio") {
    const roomId = resolveRoomIdFromRouteParam(db, decodeURIComponent(ref));
    if (!roomId) return null;
    const listing = loadPublishedRoom(db, roomId);
    if (!listing) return null;
    return coverUploadFilename(listing, "room");
  }
  const propertyId = resolvePropertyIdFromRouteParam(db, decodeURIComponent(ref));
  if (!propertyId) return null;
  const listing = loadPropertyCoverListing(db, propertyId);
  if (!listing) return null;
  return coverUploadFilename(listing, "property");
}

import type { DatabaseSync } from "node:sqlite";
import { propertyReferenceCode, roomReferenceCode } from "./listingReference.js";
import { publicBaseUrl } from "./publicBaseUrl.js";

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

const STATIC_PATHS: readonly { path: string; changefreq: SitemapUrl["changefreq"]; priority: number }[] =
  [
    { path: "/", changefreq: "daily", priority: 1 },
    { path: "/guadalajara", changefreq: "daily", priority: 0.98 },
    { path: "/buscar/gdl", changefreq: "daily", priority: 0.95 },
    { path: "/nosotros", changefreq: "monthly", priority: 0.8 },
    { path: "/faq", changefreq: "monthly", priority: 0.75 },
    { path: "/blog", changefreq: "weekly", priority: 0.8 },
    { path: "/contacto", changefreq: "monthly", priority: 0.5 },
    { path: "/legal", changefreq: "yearly", priority: 0.3 },
    { path: "/legal/terminos", changefreq: "yearly", priority: 0.3 },
    { path: "/legal/privacidad", changefreq: "yearly", priority: 0.3 },
    { path: "/llms.txt", changefreq: "monthly", priority: 0.4 },
  ];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toDate(isoOrSqlite: string | null | undefined): string | undefined {
  if (!isoOrSqlite) return undefined;
  const d = new Date(isoOrSqlite);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/** Collect published listing + property URLs for the sitemap. */
export function collectSitemapUrls(db: DatabaseSync, base: string = publicBaseUrl()): SitemapUrl[] {
  const origin = base.replace(/\/+$/, "");
  const urls: SitemapUrl[] = STATIC_PATHS.map((row) => ({
    loc: `${origin}${row.path}`,
    changefreq: row.changefreq,
    priority: row.priority,
  }));

  try {
    const rooms = db
      .prepare(
        `SELECT r.id AS id, COALESCE(r.updated_at, r.created_at, p.published_at) AS updated_at
         FROM rooms r
         INNER JOIN properties p ON p.id = r.property_id
         WHERE r.status = 'published'
           AND p.status = 'published'
           AND IFNULL(r.occupancy_status, 'available') != 'occupied'`,
      )
      .all() as { id: string; updated_at: string | null }[];

    for (const row of rooms) {
      urls.push({
        loc: `${origin}/anuncio/${roomReferenceCode(row.id)}`,
        lastmod: toDate(row.updated_at),
        changefreq: "weekly",
        priority: 0.7,
      });
    }

    const props = db
      .prepare(
        `SELECT p.id AS id,
                COALESCE(
                  (SELECT MAX(r.updated_at) FROM rooms r WHERE r.property_id = p.id),
                  p.published_at,
                  p.created_at
                ) AS updated_at
         FROM properties p
         WHERE p.status = 'published'
           AND EXISTS (
             SELECT 1 FROM rooms r
             WHERE r.property_id = p.id
               AND r.status = 'published'
               AND IFNULL(r.occupancy_status, 'available') != 'occupied'
           )`,
      )
      .all() as { id: string; updated_at: string | null }[];

    for (const row of props) {
      urls.push({
        loc: `${origin}/propiedad/${propertyReferenceCode(row.id)}`,
        lastmod: toDate(row.updated_at),
        changefreq: "weekly",
        priority: 0.65,
      });
    }

    const articles = db
      .prepare(
        `SELECT slug, city_code, COALESCE(published_at, updated_at, created_at) AS updated_at
         FROM blog_articles WHERE status = 'published'`,
      )
      .all() as { slug: string; city_code: string | null; updated_at: string | null }[];
    for (const a of articles) {
      const path =
        a.city_code && a.city_code.trim()
          ? `/blog/${a.city_code.trim()}/${a.slug}`
          : `/blog/${a.slug}`;
      urls.push({
        loc: `${origin}${path}`,
        lastmod: toDate(a.updated_at),
        changefreq: "weekly",
        priority: 0.72,
      });
    }
  } catch {
    /* schema may be incomplete in some tests — static URLs still return */
  }

  return urls;
}

export function renderSitemapXml(urls: readonly SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority != null) parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function buildSitemapXml(db: DatabaseSync, base: string = publicBaseUrl()): string {
  return renderSitemapXml(collectSitemapUrls(db, base));
}

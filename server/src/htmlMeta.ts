/** Shared HTML head tag upsert helpers for SPA shell injection. */

export function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function upsertMetaByProperty(html: string, property: string, content: string): string {
  const re = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["'][^"']*["']\\s*/?>`,
    "i",
  );
  const tag = `<meta property="${property}" content="${escapeHtmlAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

export function upsertMetaByName(html: string, name: string, content: string): string {
  const re = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*/?>`, "i");
  const tag = `<meta name="${name}" content="${escapeHtmlAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

export function upsertTitle(html: string, title: string): string {
  const re = /<title>[^<]*<\/title>/i;
  const tag = `<title>${escapeHtmlAttr(title)}</title>`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

export function upsertCanonical(html: string, href: string): string {
  const re = /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i;
  const tag = `<link rel="canonical" href="${escapeHtmlAttr(href)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

/** Replace or insert a managed JSON-LD block identified by data-bestie-seo. */
export function upsertJsonLd(html: string, id: string, data: unknown): string {
  const safe = JSON.stringify(data).replace(/</g, "\\u003c");
  const tag = `<script type="application/ld+json" data-bestie-seo="${escapeHtmlAttr(id)}">${safe}</script>`;
  const re = new RegExp(
    `<script\\s+type=["']application/ld\\+json["']\\s+data-bestie-seo=["']${id}["']\\s*>[\\s\\S]*?<\\/script>`,
    "i",
  );
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

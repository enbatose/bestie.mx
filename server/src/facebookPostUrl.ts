/** Max length stored on `properties.source_facebook_url`. */
export const SOURCE_FACEBOOK_URL_MAX_LEN = 2048;
const SOURCE_FACEBOOK_KEY_MAX_LEN = 512;

const TRACKING_PARAMS = new Set([
  "fbclid",
  "rdid",
  "__tn__",
  "__cft__",
  "__xts__[0]",
  "mibextid",
  "ref",
  "refid",
  "refsrc",
  "hrc",
  "locale",
  "_rdr",
  "sfnsn",
  "amp",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "share_url",
  "hash",
  "comment_id",
  "reply_comment_id",
  "notif_id",
  "notif_t",
  "ref_component",
  "ref_page",
]);

export type NormalizedFacebookPostUrl = {
  /** Cleaned URL to persist (tracking params stripped). */
  url: string;
  /** Stable key so permalink / posts / m-dot variants of the same post match. */
  key: string;
};

function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function isFacebookHost(host: string): boolean {
  const h = stripWww(host);
  return h === "facebook.com" || h === "fb.com" || h === "fb.watch" || h.endsWith(".facebook.com");
}

function tryParseUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t);
    return new URL(`https://${t}`);
  } catch {
    return null;
  }
}

function unwrapFacebookRedirect(u: URL): URL {
  if (!isFacebookHost(u.hostname)) return u;
  const path = u.pathname.replace(/\/+$/, "") || "/";
  if (path === "/l.php" || path === "/l") {
    const target = u.searchParams.get("u");
    if (target) {
      const inner = tryParseUrl(target);
      if (inner) return inner;
    }
  }
  return u;
}

function extractKey(u: URL): string | null {
  const parts = u.pathname.split("/").filter(Boolean);
  const q = u.searchParams;
  const story = q.get("story_fbid") || q.get("fbid") || q.get("v");
  if (story?.trim()) return `post:${story.trim().toLowerCase()}`;

  const view = (q.get("view") || "").toLowerCase();
  const id = q.get("id");
  if (view === "permalink" && id?.trim()) return `post:${id.trim().toLowerCase()}`;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!.toLowerCase();
    const next = parts[i + 1];
    if (!next) continue;
    if (p === "posts" || p === "permalink") return `post:${next.toLowerCase()}`;
    if (p === "videos" || p === "watch") return `video:${next.toLowerCase()}`;
    if (p === "reel" || p === "reels") return `reel:${next.toLowerCase()}`;
    if (p === "share") {
      const shareId = next.toLowerCase() === "p" && parts[i + 2] ? parts[i + 2]! : next;
      return `share:${shareId.toLowerCase()}`;
    }
  }
  return null;
}

function fallbackKey(u: URL): string {
  const host = stripWww(u.hostname);
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const keep = ["story_fbid", "fbid", "id", "v"];
  const q = keep
    .map((k) => {
      const v = u.searchParams.get(k);
      return v ? `${k}=${v.toLowerCase()}` : null;
    })
    .filter((x): x is string => Boolean(x))
    .join("&");
  return `url:${host}${path}${q ? `?${q}` : ""}`.toLowerCase();
}

function cleanedUrl(u: URL): string {
  const copy = new URL(u.toString());
  for (const key of [...copy.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("__xts__")) {
      copy.searchParams.delete(key);
    }
  }
  if (copy.pathname.length > 1) copy.pathname = copy.pathname.replace(/\/+$/, "");
  return copy.toString();
}

/** Parse a pasted Facebook (or other) source URL for outreach de-duplication. */
export function normalizeSourceFacebookUrl(raw: string): NormalizedFacebookPostUrl | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > SOURCE_FACEBOOK_URL_MAX_LEN) return null;
  let u = tryParseUrl(trimmed);
  if (!u) return null;
  u = unwrapFacebookRedirect(u);
  const url = cleanedUrl(u).slice(0, SOURCE_FACEBOOK_URL_MAX_LEN);
  const key = (extractKey(u) ?? fallbackKey(u)).slice(0, SOURCE_FACEBOOK_KEY_MAX_LEN);
  if (!url || !key) return null;
  return { url, key };
}

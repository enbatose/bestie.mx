import { listingPublicPath } from "@/lib/listingReference";
import type { FeedbackSource } from "@/lib/messagesApi";

const CLOSES_KEY = "bestie.feedback.listingCloses";
const PROMPTED_KEY = "bestie.feedback.searchPrompted";
const VIEWED_KEY = "bestie.feedback.viewedListings";
const SEARCH_PROMPT_NEEDED = 3;

export type FeedbackViewedListing = { id: string; title: string };

export type FeedbackOpenDetail = {
  source: FeedbackSource;
  publishedRoomId?: string;
  publishedTitle?: string;
  viewedListings?: FeedbackViewedListing[];
  /** When true, map FAB should flash (search prompt). */
  flashMapFab?: boolean;
};

export const FEEDBACK_OPEN_EVENT = "bestie:open-feedback";

function readCloses(): number {
  try {
    const n = Number(sessionStorage.getItem(CLOSES_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeCloses(n: number): void {
  try {
    sessionStorage.setItem(CLOSES_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function wasSearchPrompted(): boolean {
  try {
    return sessionStorage.getItem(PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markSearchPrompted(): void {
  try {
    sessionStorage.setItem(PROMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function readViewed(): FeedbackViewedListing[] {
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is FeedbackViewedListing =>
        Boolean(x && typeof x === "object" && typeof (x as FeedbackViewedListing).id === "string"),
      )
      .map((x) => ({ id: x.id, title: typeof x.title === "string" ? x.title : x.id }))
      .slice(-12);
  } catch {
    return [];
  }
}

function pushViewed(listing: FeedbackViewedListing): FeedbackViewedListing[] {
  const next = [...readViewed().filter((x) => x.id !== listing.id), listing].slice(-12);
  try {
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getViewedListingsForFeedback(): FeedbackViewedListing[] {
  return readViewed();
}

/**
 * Call when the user leaves a full listing page that was opened from search.
 * Returns true once when the third close in this session should open feedback.
 */
export function recordSearchListingClosed(listing: FeedbackViewedListing): boolean {
  const viewed = pushViewed(listing);
  if (wasSearchPrompted()) return false;
  const closes = readCloses() + 1;
  writeCloses(closes);
  if (closes < SEARCH_PROMPT_NEEDED) return false;
  markSearchPrompted();
  dispatchFeedbackOpen({
    source: "search",
    viewedListings: viewed.slice(-SEARCH_PROMPT_NEEDED),
    flashMapFab: true,
  });
  return true;
}

export function dispatchFeedbackOpen(detail: FeedbackOpenDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FeedbackOpenDetail>(FEEDBACK_OPEN_EVENT, { detail }));
}

function listingMarkdownLink(id: string, title: string): string {
  const label = title.trim() || "Anuncio";
  // Escape brackets in titles so markdown stays parseable.
  const safeLabel = label.replace(/[\[\]]/g, "");
  return `[${safeLabel}](${listingPublicPath(id)})`;
}

export function buildFeedbackMessageBody(input: {
  rating: number;
  comment: string;
  source: FeedbackSource;
  publishedRoomId?: string;
  publishedTitle?: string;
  viewedListings?: FeedbackViewedListing[];
}): string {
  const stars = "★".repeat(input.rating) + "☆".repeat(5 - input.rating);
  const lines = [`${stars}  ${input.rating}/5`];
  const comment = input.comment.trim();
  if (comment) {
    lines.push("", comment);
  }
  lines.push("", "Contexto:");
  if (input.source === "publish" && (input.publishedRoomId || input.publishedTitle)) {
    const title = (input.publishedTitle || "").trim() || "Anuncio publicado";
    if (input.publishedRoomId) {
      lines.push(`- Publicación: ${listingMarkdownLink(input.publishedRoomId, title)}`);
    } else {
      lines.push(`- Publicación: ${title}`);
    }
  } else if (input.source === "search") {
    const viewed = input.viewedListings?.length ? input.viewedListings : getViewedListingsForFeedback();
    if (viewed.length) {
      lines.push("- Anuncios abiertos en la búsqueda:");
      for (const v of viewed.slice(-SEARCH_PROMPT_NEEDED)) {
        lines.push(`  · ${listingMarkdownLink(v.id, v.title.trim() || v.id)}`);
      }
    } else {
      lines.push("- Origen: búsqueda (mapa)");
    }
  } else if (input.source === "map") {
    lines.push("- Origen: botón de feedback en el mapa");
  } else {
    lines.push("- Origen: menú Feedback");
  }
  return lines.join("\n");
}

export function feedbackSubjectForSource(source: FeedbackSource): string {
  switch (source) {
    case "publish":
      return "Feedback · Publicación";
    case "search":
      return "Feedback · Búsqueda";
    case "map":
      return "Feedback · Mapa";
    default:
      return "Feedback";
  }
}

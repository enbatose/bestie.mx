import type { DatabaseSync } from "node:sqlite";
import type { ChatSink } from "./chatChannel.js";
import {
  applyPoiToChatSearch,
  enrichChatSearchFromText,
  replyChatSearchNearby,
  replyChatSearchResults,
  runChatSearch,
  type ChatSearchFollowupPayloads,
} from "./chatSearchEngine.js";
import { GDL_SEARCH_POIS, type SearchPoi } from "./gdlSearchPois.js";
import type { WhatsAppBotDraft } from "./whatsappSessionStore.js";

export type ChatMenuPoi = {
  id: string;
  title: string;
  poi: SearchPoi;
};

const POI_BY_NAME = new Map(GDL_SEARCH_POIS.map((p) => [p.name, p]));

function mustPoi(name: string): SearchPoi {
  const p = POI_BY_NAME.get(name);
  if (!p) throw new Error(`missing GDL POI ${name}`);
  return p;
}

/** GDL-first shortcuts in chat (Andares / Tec stay out until stock is advertised). */
export const CHAT_MENU_POIS: readonly ChatMenuPoi[] = [
  { id: "chapu", title: "Chapu / Americana", poi: mustPoi("Zona Chapultepec/Americana") },
  { id: "centro", title: "Centro", poi: mustPoi("Centro") },
  { id: "iteso", title: "ITESO", poi: mustPoi("ITESO") },
  { id: "cucs", title: "CUCS", poi: mustPoi("CUCS") },
  { id: "minerva", title: "Minerva", poi: mustPoi("Zona Minerva") },
  { id: "midtown", title: "Midtown", poi: mustPoi("Punto Sao Paulo") },
  { id: "galerias", title: "Galerías", poi: mustPoi("Galerías") },
];

/** @deprecated use {@link CHAT_MENU_POIS} — kept for existing imports. */
export const WHATSAPP_MENU_POIS = CHAT_MENU_POIS;

export function menuPoiById(id: string): ChatMenuPoi | null {
  return CHAT_MENU_POIS.find((p) => p.id === id) ?? null;
}

export function applyMenuPoiToDraft(draft: WhatsAppBotDraft, poi: SearchPoi): WhatsAppBotDraft {
  return applyPoiToChatSearch(draft, poi);
}

export function enrichDraftFromSearchText(
  draft: WhatsAppBotDraft,
  text: string,
): Promise<WhatsAppBotDraft> {
  return enrichChatSearchFromText(
    { ...draft, sourceText: [draft.sourceText, text].filter(Boolean).join("\n").slice(0, 4000) },
    text,
  );
}

const WA_FOLLOWUPS: ChatSearchFollowupPayloads = {
  nearby: "WA_NEARBY",
  budget: "WA_BUDGET",
  zone: "WA_SEARCH",
  menu: "WA_MENU",
};

export async function runWhatsAppSearchAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
): Promise<void> {
  await replyChatSearchResults(sink, runChatSearch(db, draft), draft, WA_FOLLOWUPS);
}

export async function runWhatsAppNearbyAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
): Promise<void> {
  await replyChatSearchNearby(sink, runChatSearch(db, draft), draft, WA_FOLLOWUPS);
}

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
import { createPublishHandoff, publicWebOrigin } from "./handoffTokens.js";
import {
  emptyMessengerDraft,
  getMessengerChat,
  upsertMessengerChat,
  type MessengerSearchDraft,
} from "./messengerSessionStore.js";
import {
  sendMessengerGenericCarousel,
  sendMessengerQuickReplies,
  sendMessengerText,
} from "./messengerSend.js";
import { CHAT_MENU_POIS, menuPoiById } from "./whatsappBotSearch.js";

const DEFAULT_SEARCH_CITY = "Guadalajara";

const MB_FOLLOWUPS: ChatSearchFollowupPayloads = {
  nearby: "MB_NEARBY",
  budget: "MB_BUDGET",
  zone: "MB_SEARCH",
  menu: "MB_MENU",
};

function messengerSink(psid: string): ChatSink {
  return {
    sendText: (text) => sendMessengerText(psid, text),
    sendQuickReplies: (text, replies) => sendMessengerQuickReplies(psid, text, replies),
    sendListingCards: async (cards, footer) => {
      await sendMessengerGenericCarousel(
        psid,
        cards.map((c) => ({
          title: c.title.slice(0, 80),
          subtitle: c.subtitle.slice(0, 80),
          ...(c.imageUrl ? { image_url: c.imageUrl } : {}),
          default_action: { type: "web_url" as const, url: c.url, webview_height_ratio: "tall" as const },
          buttons: [{ type: "web_url" as const, title: "Ver anuncio", url: c.url }],
        })),
      );
      await sendMessengerText(psid, footer);
    },
  };
}

function isGreeting(text: string): boolean {
  return /^(hola|hello|hi|hey|buenas|buen[oa]s(\s+d[ií]as)?|qu[eé]\s+tal)[\s!.,¿?]*$/i.test(text.trim());
}

async function sendMainMenu(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Hola, soy Bestie. ¿Qué quieres hacer?", [
    { title: "Buscar cuarto", payload: "MB_SEARCH" },
    { title: "Publicar", payload: "MB_PUB" },
    { title: "Ayuda", payload: "MB_HELP" },
  ]);
}

async function sendHelp(sink: ChatSink, base: string): Promise<void> {
  await sink.sendText(
    [
      "Elige una zona de Guadalajara y te mando anuncios de inmediato, más lo que hay cerca y en toda la ciudad. Después puedes ajustar presupuesto o preferencia de roomies.",
      `Mapa y filtros avanzados: ${base}/buscar`,
      `Publicar (fotos y mapa en la web): usa “Publicar” o ${base}/publicar`,
      "Soporte: contacto@bestie.mx",
    ].join("\n\n"),
  );
}

async function sendZoneStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    "¿Cerca de dónde buscas? Te mando anuncios en cuanto elijas (Guadalajara, ~3.5 km).",
    [
      ...CHAT_MENU_POIS.map((p) => ({ title: p.title, payload: `MB_POI:${p.id}` })),
      { title: "Toda la ciudad", payload: "MB_POI:*" },
    ],
  );
}

async function sendBudgetStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("¿Presupuesto mensual máximo aproximado?", [
    { title: "Hasta $5,000", payload: "MB_BD:5000" },
    { title: "Hasta $8,000", payload: "MB_BD:8000" },
    { title: "Hasta $12,000", payload: "MB_BD:12000" },
    { title: "Sin tope", payload: "MB_BD:*" },
  ]);
}

async function sendPrefStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Preferencia de roomies (filtro de anuncio)", [
    { title: "Cualquiera", payload: "MB_PREF:any" },
    { title: "Pref. mujer", payload: "MB_PREF:female" },
    { title: "Pref. hombre", payload: "MB_PREF:male" },
  ]);
}

async function runSearchAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  draft: MessengerSearchDraft,
): Promise<void> {
  await replyChatSearchResults(sink, runChatSearch(db, draft), draft, MB_FOLLOWUPS, {
    maxFollowups: 5,
  });
}

function finishSearch(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: MessengerSearchDraft,
): Promise<void> {
  upsertMessengerChat(db, psid, { flow: "idle", draft });
  return runSearchAndReply(db, sink, draft);
}

/**
 * Handles a single Messenger / WhatsApp user action (postback, quick reply, or free text).
 */
export async function processMessengerUserInput(
  db: DatabaseSync,
  psid: string,
  opts: { postback?: string; quickReplyPayload?: string; text?: string },
  sink?: ChatSink,
): Promise<void> {
  const out = sink ?? messengerSink(psid);
  const base = publicWebOrigin();
  let payload = opts.postback ?? opts.quickReplyPayload ?? null;
  const textRaw = opts.text?.trim() ?? "";
  const lower = textRaw.toLowerCase();

  let chat = getMessengerChat(db, psid);
  if (!chat) {
    upsertMessengerChat(db, psid, { flow: "idle", draft: emptyMessengerDraft() });
    chat = getMessengerChat(db, psid)!;
  }

  if (!payload && chat.flow === "idle") {
    if (isGreeting(textRaw)) payload = "MB_MENU";
    else if (/^ayuda$|^help$/i.test(lower)) payload = "MB_HELP";
    else if (/^publicar$|^anunciar$/i.test(lower)) payload = "MB_PUB";
    else if (/^buscar$|^busco$/i.test(lower)) payload = "MB_SEARCH";
    else if (textRaw.length > 0) {
      // Free text can carry zone, budget, preference and tags — search on the spot.
      const draft = await enrichChatSearchFromText({ ...chat.draft }, textRaw);
      if (draft.poiLat == null) {
        upsertMessengerChat(db, psid, { flow: "search_zone", draft });
        await sendZoneStep(out);
        return;
      }
      await finishSearch(db, psid, out, draft);
      return;
    }
  }

  if (!payload && chat.flow === "search_zone" && textRaw) {
    const draft = await enrichChatSearchFromText({ ...chat.draft }, textRaw);
    if (draft.poiLat == null) {
      upsertMessengerChat(db, psid, { flow: "search_zone", draft });
      await out.sendText("No ubiqué esa zona. Prueba con Chapu, Centro, ITESO, CUCS… o elige de la lista.");
      await sendZoneStep(out);
      return;
    }
    await finishSearch(db, psid, out, draft);
    return;
  }

  if (!payload && chat.flow !== "idle") {
    await out.sendText("Elige una de las opciones de arriba, o escribe Ayuda para reiniciar.");
    return;
  }

  if (!payload) {
    await sendMainMenu(out);
    return;
  }

  if (payload === "MB_HELP") {
    await sendHelp(out, base);
    upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
    return;
  }

  if (payload === "GET_STARTED" || payload === "MB_MENU") {
    await sendMainMenu(out);
    upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
    return;
  }

  if (payload === "MB_SEARCH") {
    upsertMessengerChat(db, psid, { flow: "search_zone", draft: emptyMessengerDraft() });
    await sendZoneStep(out);
    return;
  }

  if (payload === "MB_PUB") {
    const c = getMessengerChat(db, psid)!;
    const { url } = createPublishHandoff(db, c.publisherId, null);
    await out.sendText(
      `Abre este enlace en el navegador para terminar tu anuncio (fotos, mapa, legal). Válido 24 h:\n${url}`,
    );
    upsertMessengerChat(db, psid, { flow: "idle", draft: c.draft });
    return;
  }

  // Zone pick (or "toda la ciudad") returns matches on the first reply.
  if (payload.startsWith("MB_POI:") || payload.startsWith("MB_CITY:")) {
    const id = payload.slice(payload.indexOf(":") + 1);
    const c = getMessengerChat(db, psid)!;
    const base = { ...c.draft, city: DEFAULT_SEARCH_CITY };
    const item = id === "*" ? null : menuPoiById(id);
    if (id !== "*" && !item) {
      upsertMessengerChat(db, psid, { flow: "search_zone", draft: base });
      await sendZoneStep(out);
      return;
    }
    const draft = item
      ? applyPoiToChatSearch(base, item.poi)
      : { ...base, poiName: null, poiLat: null, poiLng: null, zoneLabel: DEFAULT_SEARCH_CITY };
    await finishSearch(db, psid, out, draft);
    return;
  }

  if (payload.startsWith("MB_BD:")) {
    const v = payload.slice("MB_BD:".length);
    const c = getMessengerChat(db, psid)!;
    const budgetMax = v === "*" ? null : Number(v);
    await finishSearch(db, psid, out, {
      ...c.draft,
      budgetMax: budgetMax != null && Number.isFinite(budgetMax) ? budgetMax : null,
    });
    return;
  }

  if (payload === "MB_BUDGET") {
    upsertMessengerChat(db, psid, { flow: "search_budget", draft: getMessengerChat(db, psid)!.draft });
    await sendBudgetStep(out);
    return;
  }

  if (payload === "MB_PREF_ASK") {
    upsertMessengerChat(db, psid, { flow: "search_pref", draft: getMessengerChat(db, psid)!.draft });
    await sendPrefStep(out);
    return;
  }

  if (payload === "MB_NEARBY") {
    const c = getMessengerChat(db, psid)!;
    upsertMessengerChat(db, psid, { flow: "idle", draft: c.draft });
    await replyChatSearchNearby(out, runChatSearch(db, c.draft), c.draft, MB_FOLLOWUPS, {
      maxFollowups: 5,
    });
    return;
  }

  if (payload.startsWith("MB_PREF:")) {
    const v = payload.slice("MB_PREF:".length);
    const c = getMessengerChat(db, psid)!;
    const pref = v === "any" ? null : v === "female" ? "female" : v === "male" ? "male" : null;
    await finishSearch(db, psid, out, { ...c.draft, pref });
    return;
  }

  await sendMainMenu(out);
  upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
}

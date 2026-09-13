import type { DatabaseSync } from "node:sqlite";
import type { ChatSink } from "./chatChannel.js";
import type { PropertyListing } from "./types.js";
import { createPublishHandoff, publicWebOrigin } from "./handoffTokens.js";
import { roomReferenceCode } from "./listingReference.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, parseFilters } from "./searchFilters.js";
import {
  getMessengerChat,
  upsertMessengerChat,
  type MessengerSearchDraft,
} from "./messengerSessionStore.js";
import {
  sendMessengerGenericCarousel,
  sendMessengerQuickReplies,
  sendMessengerText,
} from "./messengerSend.js";

const DEFAULT_FEATURED = ["Guadalajara"];
const DEFAULT_SEARCH_CITY = "Guadalajara";

function featuredCitiesList(db: DatabaseSync): string[] {
  const row = db.prepare(`SELECT value_json FROM site_settings WHERE key = 'featured_cities'`).get() as
    | { value_json: string }
    | undefined;
  if (!row) return [...DEFAULT_FEATURED];
  try {
    const j = JSON.parse(row.value_json) as unknown;
    if (!Array.isArray(j)) return [...DEFAULT_FEATURED];
    const list = j.filter((x): x is string => typeof x === "string").map((s) => s.trim());
    return list.length ? list : [...DEFAULT_FEATURED];
  } catch {
    return [...DEFAULT_FEATURED];
  }
}

function listingPrimaryImage(base: string, l: PropertyListing): string | undefined {
  const mode = l.propertyPostMode === "property" ? "property" : "room";
  const ordered =
    mode === "room"
      ? [...(l.roomImageUrls ?? []), ...(l.propertyImageUrls ?? [])]
      : [...(l.propertyImageUrls ?? []), ...(l.roomImageUrls ?? [])];
  for (const raw of ordered) {
    const u = raw?.trim();
    if (!u) continue;
    if (u.startsWith("http")) return u;
    return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  }
  return undefined;
}

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
      "Puedes buscar cuarto con filtros guiados (ciudad, presupuesto, preferencia de roomies) y ver resultados aquí.",
      `Mapa y filtros avanzados: ${base}/buscar`,
      `Publicar (fotos y mapa en la web): usa “Publicar” o ${base}/publicar`,
      "Soporte: contacto@bestie.mx",
    ].join("\n\n"),
  );
}

async function sendCityStep(db: DatabaseSync, sink: ChatSink): Promise<void> {
  const cities = featuredCitiesList(db).slice(0, 8);
  const replies = [
    ...cities.map((c) => ({ title: c.length > 20 ? `${c.slice(0, 17)}…` : c, payload: `MB_CITY:${c}` })),
    { title: "Cualquier ciudad", payload: "MB_CITY:*" },
  ];
  await sink.sendQuickReplies(
    "Paso 1/3: ¿En qué ciudad buscas? (Si ya escribiste palabras clave, las combino con la ciudad.)",
    replies,
  );
}

async function sendBudgetStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Paso 2/3: ¿Presupuesto mensual máximo aproximado?", [
    { title: "Hasta $5,000", payload: "MB_BD:5000" },
    { title: "Hasta $8,000", payload: "MB_BD:8000" },
    { title: "Hasta $12,000", payload: "MB_BD:12000" },
    { title: "Sin tope", payload: "MB_BD:*" },
  ]);
}

async function sendPrefStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Paso 3/3: Preferencia de roomies (filtro de anuncio)", [
    { title: "Cualquiera", payload: "MB_PREF:any" },
    { title: "Pref. mujer", payload: "MB_PREF:female" },
    { title: "Pref. hombre", payload: "MB_PREF:male" },
  ]);
}

function searchParamsFromDraft(draft: MessengerSearchDraft): URLSearchParams {
  const p = new URLSearchParams();
  const qparts = [draft.city ?? DEFAULT_SEARCH_CITY, draft.q].filter(Boolean) as string[];
  const q = qparts.join(" ").trim();
  if (q) p.set("q", q);
  if (draft.budgetMax != null) p.set("max", String(draft.budgetMax));
  if (draft.pref) p.set("gender", draft.pref);
  return p;
}

async function runSearchAndReply(
  db: DatabaseSync,
  sink: ChatSink,
  base: string,
  draft: MessengerSearchDraft,
): Promise<void> {
  const params = searchParamsFromDraft(draft);
  const filters = parseFilters(params);
  const list = filterListings(fetchPublishedListings(db), filters);
  const web = `${base}/buscar?${params.toString()}`;

  if (list.length === 0) {
    await sink.sendText(
      `No encontré resultados con esos filtros. Prueba en el mapa y ajusta tags/edad en la web:\n${web}`,
    );
    return;
  }

  const top = list.slice(0, 5);
  const cards = top.map((l) => {
    const url = `${base}/anuncio/${encodeURIComponent(roomReferenceCode(l.id))}`;
    return {
      title: l.title.slice(0, 80),
      subtitle: `${l.city} · $${l.rentMxn} MXN/mes`.slice(0, 80),
      url,
      imageUrl: listingPrimaryImage(base, l),
    };
  });
  await sink.sendListingCards(
    cards,
    `Mostrando ${top.length}${list.length > top.length ? ` de ${list.length}` : ""} anuncios. Más filtros en la web: ${web}`,
  );
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
    upsertMessengerChat(db, psid, {
      flow: "idle",
      draft: { q: "", city: null, budgetMax: null, pref: null },
    });
    chat = getMessengerChat(db, psid)!;
  }

  if (!payload && chat.flow === "idle") {
    if (isGreeting(textRaw)) payload = "MB_MENU";
    else if (/^ayuda$|^help$/i.test(lower)) payload = "MB_HELP";
    else if (/^publicar$|^anunciar$/i.test(lower)) payload = "MB_PUB";
    else if (/^buscar$|^busco\b/i.test(lower)) payload = "MB_SEARCH";
    else if (textRaw.length > 0) {
      upsertMessengerChat(db, psid, {
        flow: "search_city",
        draft: { ...chat.draft, q: textRaw.slice(0, 120) },
      });
      await sendCityStep(db, out);
      return;
    }
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
    upsertMessengerChat(db, psid, {
      flow: "search_city",
      draft: { ...chat.draft, city: null, budgetMax: null, pref: null },
    });
    await sendCityStep(db, out);
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

  if (payload.startsWith("MB_CITY:")) {
    const v = payload.slice("MB_CITY:".length);
    const c = getMessengerChat(db, psid)!;
    upsertMessengerChat(db, psid, {
      flow: "search_budget",
      draft: { ...c.draft, city: v === "*" ? DEFAULT_SEARCH_CITY : v },
    });
    await sendBudgetStep(out);
    return;
  }

  if (payload.startsWith("MB_BD:")) {
    const v = payload.slice("MB_BD:".length);
    const c = getMessengerChat(db, psid)!;
    const budgetMax = v === "*" ? null : Number(v);
    upsertMessengerChat(db, psid, {
      flow: "search_pref",
      draft: {
        ...c.draft,
        budgetMax: budgetMax != null && Number.isFinite(budgetMax) ? budgetMax : null,
      },
    });
    await sendPrefStep(out);
    return;
  }

  if (payload.startsWith("MB_PREF:")) {
    const v = payload.slice("MB_PREF:".length);
    const c = getMessengerChat(db, psid)!;
    const pref = v === "any" ? null : v === "female" ? "female" : v === "male" ? "male" : null;
    const nextDraft: MessengerSearchDraft = { ...c.draft, pref };
    upsertMessengerChat(db, psid, { flow: "idle", draft: nextDraft });
    await runSearchAndReply(db, out, base, nextDraft);
    return;
  }

  await sendMainMenu(out);
  upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
}

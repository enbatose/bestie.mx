import type { DatabaseSync } from "node:sqlite";
import type { PropertyListing } from "./types.js";
import { createPublishHandoff, publicWebOrigin } from "./handoffTokens.js";
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

const DEFAULT_FEATURED = ["Guadalajara", "Mérida", "Puerto Vallarta", "Sayulita", "Bucerías"];

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
  const u = l.propertyImageUrls?.[0] ?? l.roomImageUrls?.[0];
  if (!u) return undefined;
  if (u.startsWith("http")) return u;
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}

async function sendMainMenu(psid: string): Promise<void> {
  await sendMessengerQuickReplies(psid, "Hola, soy Bestie. ¿Qué quieres hacer?", [
    { title: "Buscar cuarto", payload: "MB_SEARCH" },
    { title: "Publicar", payload: "MB_PUB" },
    { title: "Ayuda", payload: "MB_HELP" },
  ]);
}

async function sendHelp(psid: string, base: string): Promise<void> {
  await sendMessengerText(
    psid,
    [
      "Puedes buscar cuarto con filtros guiados (ciudad, presupuesto, preferencia de roomies) y ver resultados aquí.",
      `Mapa y filtros avanzados: ${base}/buscar`,
      `Publicar (fotos y mapa en la web): usa “Publicar” o ${base}/publicar`,
      "Soporte: support@bestie.mx",
    ].join("\n\n"),
  );
}

async function sendCityStep(db: DatabaseSync, psid: string): Promise<void> {
  const cities = featuredCitiesList(db).slice(0, 8);
  const replies = [
    ...cities.map((c) => ({ title: c.length > 20 ? `${c.slice(0, 17)}…` : c, payload: `MB_CITY:${c}` })),
    { title: "Cualquier ciudad", payload: "MB_CITY:*" },
  ];
  await sendMessengerQuickReplies(
    psid,
    "Paso 1/3: ¿En qué ciudad buscas? (Si ya escribiste palabras clave, las combino con la ciudad.)",
    replies,
  );
}

async function sendBudgetStep(psid: string): Promise<void> {
  await sendMessengerQuickReplies(psid, "Paso 2/3: ¿Presupuesto mensual máximo aproximado?", [
    { title: "Hasta $5,000", payload: "MB_BD:5000" },
    { title: "Hasta $8,000", payload: "MB_BD:8000" },
    { title: "Hasta $12,000", payload: "MB_BD:12000" },
    { title: "Sin tope", payload: "MB_BD:*" },
  ]);
}

async function sendPrefStep(psid: string): Promise<void> {
  await sendMessengerQuickReplies(psid, "Paso 3/3: Preferencia de roomies (filtro de anuncio)", [
    { title: "Cualquiera", payload: "MB_PREF:any" },
    { title: "Pref. mujer", payload: "MB_PREF:female" },
    { title: "Pref. hombre", payload: "MB_PREF:male" },
  ]);
}

function searchParamsFromDraft(draft: MessengerSearchDraft): URLSearchParams {
  const p = new URLSearchParams();
  const qparts = [draft.city, draft.q].filter(Boolean) as string[];
  const q = qparts.join(" ").trim();
  if (q) p.set("q", q);
  if (draft.budgetMax != null) p.set("max", String(draft.budgetMax));
  if (draft.pref) p.set("gender", draft.pref);
  return p;
}

async function runSearchAndReply(db: DatabaseSync, psid: string, base: string, draft: MessengerSearchDraft) {
  const params = searchParamsFromDraft(draft);
  const filters = parseFilters(params);
  const list = filterListings(fetchPublishedListings(db), filters);
  const web = `${base}/buscar?${params.toString()}`;

  if (list.length === 0) {
    await sendMessengerText(
      psid,
      `No encontré resultados con esos filtros. Prueba en el mapa y ajusta tags/edad en la web:\n${web}`,
    );
    return;
  }

  const top = list.slice(0, 5);
  const elements = top.map((l) => {
    const url = `${base}/anuncio/${encodeURIComponent(l.id)}`;
    const img = listingPrimaryImage(base, l);
    return {
      title: l.title.slice(0, 80),
      subtitle: `${l.city} · $${l.rentMxn} MXN/mes`.slice(0, 80),
      ...(img ? { image_url: img } : {}),
      default_action: { type: "web_url" as const, url, webview_height_ratio: "tall" as const },
      buttons: [{ type: "web_url" as const, title: "Ver anuncio", url }],
    };
  });
  await sendMessengerGenericCarousel(psid, elements);
  await sendMessengerText(
    psid,
    `Mostrando ${top.length}${list.length > top.length ? ` de ${list.length}` : ""} anuncios. Más filtros en la web: ${web}`,
  );
}

/**
 * Handles a single Messenger user action (postback, quick reply, or free text).
 */
export async function processMessengerUserInput(
  db: DatabaseSync,
  psid: string,
  opts: { postback?: string; quickReplyPayload?: string; text?: string },
): Promise<void> {
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
    if (/^ayuda$|^help$/i.test(lower)) payload = "MB_HELP";
    else if (/^publicar$|^anunciar$/i.test(lower)) payload = "MB_PUB";
    else if (/^buscar$|^busco\b/i.test(lower)) payload = "MB_SEARCH";
    else if (textRaw.length > 0) {
      upsertMessengerChat(db, psid, {
        flow: "search_city",
        draft: { ...chat.draft, q: textRaw.slice(0, 120) },
      });
      await sendCityStep(db, psid);
      return;
    }
  }

  if (!payload && chat.flow !== "idle") {
    await sendMessengerText(psid, "Elige una de las opciones de arriba, o escribe Ayuda para reiniciar.");
    return;
  }

  if (!payload) {
    await sendMainMenu(psid);
    return;
  }

  if (payload === "MB_HELP") {
    await sendHelp(psid, base);
    upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
    return;
  }

  if (payload === "GET_STARTED" || payload === "MB_MENU") {
    await sendMainMenu(psid);
    upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
    return;
  }

  if (payload === "MB_SEARCH") {
    upsertMessengerChat(db, psid, {
      flow: "search_city",
      draft: { ...chat.draft, city: null, budgetMax: null, pref: null },
    });
    await sendCityStep(db, psid);
    return;
  }

  if (payload === "MB_PUB") {
    const c = getMessengerChat(db, psid)!;
    const { url } = createPublishHandoff(db, c.publisherId, null);
    await sendMessengerText(
      psid,
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
      draft: { ...c.draft, city: v === "*" ? null : v },
    });
    await sendBudgetStep(psid);
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
    await sendPrefStep(psid);
    return;
  }

  if (payload.startsWith("MB_PREF:")) {
    const v = payload.slice("MB_PREF:".length);
    const c = getMessengerChat(db, psid)!;
    const pref = v === "any" ? null : v === "female" ? "female" : v === "male" ? "male" : null;
    const nextDraft: MessengerSearchDraft = { ...c.draft, pref };
    upsertMessengerChat(db, psid, { flow: "idle", draft: nextDraft });
    await runSearchAndReply(db, psid, base, nextDraft);
    return;
  }

  await sendMainMenu(psid);
  upsertMessengerChat(db, psid, { flow: "idle", draft: chat.draft });
}

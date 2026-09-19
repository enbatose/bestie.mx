import type { DatabaseSync } from "node:sqlite";
import { SELF_SERVE_MAX_INFOGRAPHICS, listingPhotoSlotsRemaining } from "./assistedDraftLimits.js";
import type { ChatSink } from "./chatChannel.js";
import {
  chatAmenityMenuText,
  chatTagLabels,
  parseChatAmenityReply,
} from "./chatPublishAmenities.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { ensureWhatsAppBotAccount } from "./whatsappBotAccount.js";
import { saveWhatsAppMediaImage } from "./whatsappBotMedia.js";
import {
  applyLocationText,
  applyNativeLocation,
  composeWhatsAppListingFields,
  enrichPublishDraftFromInfographics,
  enrichPublishDraftFromText,
  ensurePublishDraftSummary,
  formatPublishPreview,
  parseRentFromText,
  publishDraftReady,
  publishWhatsAppRoom,
} from "./whatsappBotPublish.js";
import {
  applyMenuPoiToDraft,
  CHAT_MENU_POIS,
  enrichDraftFromSearchText,
  menuPoiById,
  runWhatsAppNearbyAndReply,
  runWhatsAppSearchAndReply,
} from "./whatsappBotSearch.js";
import {
  appendWhatsAppInfographicUrls,
  appendWhatsAppPhotoUrls,
  emptyWhatsAppDraft,
  getWhatsAppChat,
  upsertWhatsAppChat,
  type WhatsAppBotDraft,
} from "./whatsappSessionStore.js";

export type WhatsAppInbound = {
  text?: string;
  quickReplyPayload?: string;
  imageMediaId?: string;
  imageMediaIds?: string[];
  imageCaption?: string;
  location?: { lat: number; lng: number; name?: string };
};

export type WhatsAppFlowOptions = {
  uploadDir?: string;
  /** Wait for an album burst to finish before asking if more photos are coming. */
  photoAckDelayMs?: number;
  saveImage?: (mediaId: string) => Promise<string | null>;
};

const DEFAULT_PHOTO_ACK_DELAY_MS = 1800;
const mediaAckTimers = new Map<string, ReturnType<typeof setTimeout>>();

function photoCapFor(draft: WhatsAppBotDraft): number {
  return listingPhotoSlotsRemaining(draft.infographicUrls.length);
}

function isGreeting(text: string): boolean {
  return /^(hola|hello|hi|hey|buenas|buen[oa]s(\s+d[ií]as)?|qu[eé]\s+tal)[\s!.,¿?]*$/i.test(text.trim());
}

function looksLikePublish(text: string): boolean {
  return /\b(publicar|anunciar|tengo\s+(un\s+)?cuarto|renta\s+mi|rento\s+(un\s+)?cuarto|subo\s+(un\s+)?cuarto)\b/i.test(
    text,
  );
}

function isInfographicFlow(flow: string): boolean {
  return flow === "pub_infographic_ask" || flow === "pub_infographics";
}

async function sendMenu(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Hola, soy Bestie. ¿Qué quieres hacer en Guadalajara?", [
    { title: "Buscar cuarto", payload: "WA_SEARCH" },
    { title: "Publicar", payload: "WA_PUB" },
    { title: "Ayuda", payload: "WA_HELP" },
  ]);
}

async function sendHelp(sink: ChatSink): Promise<void> {
  const base = publicWebOrigin();
  await sink.sendText(
    [
      "Elige una zona (Chapu, Centro, ITESO, CUCS…) y te mando anuncios de inmediato, más lo que hay cerca y en todo Guadalajara. Después puedes ajustar presupuesto o preferencia.",
      "También puedes publicar un solo cuarto: infográficos (hasta 2; la IA los lee y van a la galería), fotos del espacio, descripción opcional, renta exacta, tipo de recámara, depósito, etiquetas, ubicación aproximada y un toque para aceptar términos.",
      `Mapa: ${base}/buscar`,
      `Términos: ${base}/legal/terminos`,
      "Soporte: contacto@bestie.mx",
    ].join("\n\n"),
  );
}

async function sendZoneStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    "¿Cerca de dónde buscas? Te mando anuncios en cuanto elijas (Guadalajara, ~3.5 km).",
    [
      ...CHAT_MENU_POIS.map((p) => ({ title: p.title, payload: `WA_POI:${p.id}` })),
      { title: "Otra zona", payload: "WA_POI:other" },
    ],
  );
}

async function sendBudgetStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("¿Presupuesto mensual máximo?", [
    { title: "Hasta $5,000", payload: "WA_BD:5000" },
    { title: "Hasta $8,000", payload: "WA_BD:8000" },
    { title: "Hasta $12,000", payload: "WA_BD:12000" },
    { title: "Sin tope", payload: "WA_BD:*" },
  ]);
}

async function sendPrefStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("Preferencia de roomies del anuncio:", [
    { title: "Cualquiera", payload: "WA_PREF:any" },
    { title: "Pref. mujer", payload: "WA_PREF:female" },
    { title: "Pref. hombre", payload: "WA_PREF:male" },
  ]);
}

function save(db: DatabaseSync, psid: string, flow: string, draft: WhatsAppBotDraft, publisherId?: string) {
  upsertWhatsAppChat(db, psid, { flow, draft, ...(publisherId ? { publisherId } : {}) });
}

async function finishSearch(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  save(db, psid, "idle", draft, publisherId);
  await runWhatsAppSearchAndReply(db, sink, draft);
}

async function sendInfographicAsk(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    [
      "¿Tienes un infográfico del cuarto?",
      "",
      "Es una sola imagen (flyer o plantilla) con datos como renta, zona o reglas — a veces con fotos mezcladas. Puedes mandar hasta 2: la IA los lee para armar el anuncio y también se publican en la galería.",
      "",
      "Las fotos reales del espacio (cuarto, baño, cocina…) las pedimos en el siguiente paso.",
    ].join("\n"),
    [
      { title: "Sí, tengo", payload: "WA_INFO_YES" },
      { title: "No", payload: "WA_INFO_NO" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function sendInfographicPrompt(sink: ChatSink, count: number): Promise<void> {
  if (count <= 0) {
    await sink.sendQuickReplies(
      "Mándame hasta 2 infográficos (JPG o PNG). Después te pediré las fotos reales del espacio.",
      [{ title: "No tengo", payload: "WA_INFO_NO" }, { title: "Cancelar", payload: "WA_CANCEL" }],
    );
    return;
  }
  if (count >= SELF_SERVE_MAX_INFOGRAPHICS) {
    await sink.sendQuickReplies(`Ya tengo ${SELF_SERVE_MAX_INFOGRAPHICS} infográficos, el máximo. ¿Seguimos?`, [
      { title: "No, seguir", payload: "WA_INFO_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ]);
    return;
  }
  await sink.sendQuickReplies(
    `Recibí ${count} infográfico${count === 1 ? "" : "s"}. ¿Tienes otro (máximo ${SELF_SERVE_MAX_INFOGRAPHICS})?`,
    [
      { title: "Sí, otro", payload: "WA_INFO_MORE" },
      { title: "No, seguir", payload: "WA_INFO_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function sendDescPrompt(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  const hasInfo = draft.infographicUrls.length > 0;
  const body = hasInfo
    ? "¿Quieres añadir una descripción del cuarto? Es opcional: el infográfico ya aporta datos. Escríbela o pulsa Saltar."
    : "¿Quieres añadir una descripción del cuarto? Es opcional, pero ayuda si no hay infográfico. Escríbela o pulsa Saltar.";
  await sink.sendQuickReplies(body, [
    { title: "Saltar", payload: "WA_DESC_SKIP" },
    { title: "Cancelar", payload: "WA_CANCEL" },
  ]);
}

async function sendPhotosPrompt(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  const maxPhotos = photoCapFor(draft);
  const count = draft.photoUrls.length;
  if (count <= 0) {
    await sink.sendQuickReplies(
      `Puedes subir hasta ${maxPhotos} fotos.\nMándamelas (varias a la vez está bien). Cuando las reciba te pregunto si hay más pendientes.`,
      [{ title: "Cancelar", payload: "WA_CANCEL" }],
    );
    return;
  }
  if (count >= maxPhotos) {
    await sink.sendQuickReplies(`Ya tengo ${maxPhotos} fotos, el máximo. ¿Seguimos?`, [
      { title: "No, seguir", payload: "WA_PHOTOS_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ]);
    return;
  }
  await sink.sendQuickReplies(
    `Recibí ${count} foto${count === 1 ? "" : "s"} (máximo ${maxPhotos}). ¿Tienes más pendientes? Puedes mandar varias juntas.`,
    [
      { title: "Sí, más fotos", payload: "WA_PHOTOS_MORE" },
      { title: "No, seguir", payload: "WA_PHOTOS_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

function inboundImageIds(inbound: WhatsAppInbound): string[] {
  const ids = [...(inbound.imageMediaIds ?? []), inbound.imageMediaId ?? ""].map((id) => id.trim()).filter(Boolean);
  return [...new Set(ids)];
}

function scheduleMediaAck(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  delayMs: number,
  kind: "photo" | "infographic",
  ctx: { publisherId?: string; uploadDir?: string },
): Promise<void> {
  const prev = mediaAckTimers.get(psid);
  if (prev) clearTimeout(prev);
  const fire = async () => {
    mediaAckTimers.delete(psid);
    const chat = getWhatsAppChat(db, psid);
    if (kind === "infographic") {
      const count = chat?.draft.infographicUrls.length ?? 0;
      if (count >= SELF_SERVE_MAX_INFOGRAPHICS && chat) {
        await continueAfterInfographics(db, psid, sink, chat.draft, ctx.publisherId, ctx.uploadDir);
        return;
      }
      await sendInfographicPrompt(sink, count);
      return;
    }
    await sendPhotosPrompt(sink, chat?.draft ?? emptyWhatsAppDraft());
  };
  if (delayMs <= 0) return fire();
  const t = setTimeout(() => {
    void fire();
  }, delayMs);
  if (typeof t.unref === "function") t.unref();
  mediaAckTimers.set(psid, t);
  return Promise.resolve();
}

async function sendLocationPrompt(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    "Comparte tu ubicación con el clip de WhatsApp, o escribe colonia / calle. El pin será aproximado (100–1000 m) para tu privacidad.",
    [
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

function rentConfirmTitle(amount: number): string {
  const raw = `Sí, $${amount}`;
  return raw.length <= 20 ? raw : "Sí, ese monto";
}

async function sendRentPrompt(sink: ChatSink, draft: WhatsAppBotDraft, forceType = false): Promise<void> {
  if (!forceType && draft.rentMxn != null) {
    await sink.sendQuickReplies(
      `Leí $${draft.rentMxn} MXN al mes en lo que enviaste. ¿Es ese el monto exacto? Si no, escribe un solo número (sin rango).`,
      [
        { title: rentConfirmTitle(draft.rentMxn), payload: "WA_RENT_OK" },
        { title: "Otro monto", payload: "WA_RENT_EDIT" },
        { title: "Cancelar", payload: "WA_CANCEL" },
      ],
    );
    return;
  }
  await sink.sendQuickReplies(
    "¿Cuál es la renta mensual exacta? Escribe un solo monto en pesos, por ejemplo 6500. No uses un rango.",
    [{ title: "Cancelar", payload: "WA_CANCEL" }],
  );
}

async function sendPreview(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  await sink.sendQuickReplies(formatPublishPreview(draft), [
    { title: "Acepto y publicar", payload: "WA_PUBLISH" },
    { title: "Cambiar renta", payload: "WA_RENT_EDIT" },
    { title: "Cambiar etiquetas", payload: "WA_TAGS_EDIT" },
  ]);
}

async function sendRoomKindPrompt(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("¿Cómo es la recámara que rentas?", [
    { title: "Privada individual", payload: "WA_KIND:private:small" },
    { title: "Privada matrimonial", payload: "WA_KIND:private:medium" },
    { title: "Privada grande", payload: "WA_KIND:private:large" },
    { title: "Compartida", payload: "WA_KIND:shared:medium" },
  ]);
}

async function sendRoomiesPrompt(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies("¿Prefieres roomie de algún género? Es un filtro de búsqueda.", [
    { title: "Cualquiera", payload: "WA_GENDER:any" },
    { title: "Prefiero mujer", payload: "WA_GENDER:female" },
    { title: "Prefiero hombre", payload: "WA_GENDER:male" },
  ]);
}

async function sendDepositPrompt(sink: ChatSink, rentMxn: number | null): Promise<void> {
  await sink.sendQuickReplies("¿Pides depósito?", [
    { title: "Sin depósito", payload: "WA_DEP:0" },
    ...(rentMxn != null ? [{ title: "Un mes de renta", payload: "WA_DEP:rent" }] : []),
    { title: "Otro monto", payload: "WA_DEP:other" },
  ]);
}

async function sendTagsPrompt(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  const detected = chatTagLabels(draft.pubTags);
  const head = detected.length
    ? `Ya detecté: ${detected.join(", ")}.`
    : "Todavía no tengo etiquetas del cuarto.";
  await sink.sendQuickReplies(
    [
      head,
      "Responde con los números de lo que SÍ tiene (ej. 1,3,5) y los agrego. Si ya está completo, pulsa Listo.",
      "",
      chatAmenityMenuText(draft.pubTags),
    ].join("\n"),
    [
      { title: "Listo", payload: "WA_TAGS_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function continueAfterPhotos(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  if (draft.photoUrls.length < 1) {
    await sendPhotosPrompt(sink, draft);
    return;
  }
  save(db, psid, "pub_desc", draft, publisherId);
  await sendDescPrompt(sink, draft);
}

/**
 * Wizard-grade data with as few taps as possible: each essential is asked only
 * when neither the description, the infographic, nor a previous tap resolved it.
 * With nothing else to ask, the description is written and the preview goes out.
 */
async function continueToEssentials(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  if (!draft.roomKindSet) {
    save(db, psid, "pub_room_kind", draft, publisherId);
    await sendRoomKindPrompt(sink);
    return;
  }
  if (!draft.genderSet) {
    save(db, psid, "pub_roomies", draft, publisherId);
    await sendRoomiesPrompt(sink);
    return;
  }
  if (draft.depositMxn == null) {
    save(db, psid, "pub_deposit", draft, publisherId);
    await sendDepositPrompt(sink, draft.rentMxn);
    return;
  }
  if (!draft.tagsConfirmed) {
    save(db, psid, "pub_tags", draft, publisherId);
    await sendTagsPrompt(sink, draft);
    return;
  }
  const next = await ensurePublishDraftSummary(draft);
  save(db, psid, "pub_preview", next, publisherId);
  await sendPreview(sink, next);
}

async function continueAfterDesc(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  if (draft.locLat == null) {
    save(db, psid, "pub_location", draft, publisherId);
    await sendLocationPrompt(sink);
    return;
  }
  if (draft.rentMxn == null) {
    save(db, psid, "pub_rent", draft, publisherId);
    await sendRentPrompt(sink, draft);
    return;
  }
  await continueToEssentials(db, psid, sink, draft, publisherId);
}

async function continueAfterInfographics(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId: string | undefined,
  uploadDir?: string,
): Promise<void> {
  let next = draft;
  if (next.infographicUrls.length > 0) {
    await sink.sendText("Estoy leyendo el infográfico…");
    next = await enrichPublishDraftFromInfographics(db, uploadDir, next);
  }
  const photoCap = photoCapFor(next);
  if (next.photoUrls.length > photoCap) next = { ...next, photoUrls: next.photoUrls.slice(0, photoCap) };
  save(db, psid, "pub_photos", next, publisherId);
  await sendPhotosPrompt(sink, next);
}

export async function processWhatsAppUserInput(
  db: DatabaseSync,
  psid: string,
  fromDigits: string,
  inbound: WhatsAppInbound,
  sink: ChatSink,
  opts: WhatsAppFlowOptions = {},
): Promise<void> {
  const account = ensureWhatsAppBotAccount(db, fromDigits);
  let chat = getWhatsAppChat(db, psid);
  if (!chat) {
    chat = upsertWhatsAppChat(db, psid, {
      flow: "idle",
      draft: emptyWhatsAppDraft(),
      publisherId: account?.publisherId,
    });
  } else if (account && chat.publisherId !== account.publisherId) {
    chat = upsertWhatsAppChat(db, psid, { publisherId: account.publisherId });
  }

  let payload = inbound.quickReplyPayload?.trim() || null;
  const textRaw = inbound.text?.trim() ?? "";
  const lower = textRaw.toLowerCase();
  let draft = chat.draft;
  let flow = chat.flow;
  const publisherId = account?.publisherId ?? chat.publisherId;
  if (
    flow !== "idle" &&
    !flow.startsWith("search_") &&
    !flow.startsWith("pub_")
  ) {
    flow = "idle";
  }

  const goIdleMenu = async () => {
    save(db, psid, "idle", emptyWhatsAppDraft(), publisherId);
    await sendMenu(sink);
  };

  if (!payload && inbound.location && Number.isFinite(inbound.location.lat)) {
    if (flow.startsWith("pub") || flow === "idle") {
      draft = applyNativeLocation(draft, inbound.location.lat, inbound.location.lng, inbound.location.name);
      draft.intent = "publish";
      if (isInfographicFlow(flow) || flow === "pub_desc") {
        save(db, psid, flow, draft, publisherId);
        await sink.sendText(`Ubicación guardada (aproximada${draft.locLabel ? `: ${draft.locLabel}` : ""}). Sigue con este paso.`);
        if (isInfographicFlow(flow)) await sendInfographicPrompt(sink, draft.infographicUrls.length);
        else await sendDescPrompt(sink, draft);
        return;
      }
      if (flow === "idle") {
        save(db, psid, "pub_infographic_ask", draft, publisherId);
        await sink.sendText("Ubicación guardada (aproximada).");
        await sendInfographicAsk(sink);
        return;
      }
      if (draft.photoUrls.length < 1) {
        save(db, psid, "pub_photos", draft, publisherId);
        await sink.sendText("Ubicación guardada (aproximada). Ahora mándame fotos del cuarto.");
        await sendPhotosPrompt(sink, draft);
        return;
      }
      if (draft.rentMxn == null) {
        save(db, psid, "pub_rent", draft, publisherId);
        await sink.sendText(`Zona: ${draft.locLabel ?? "pin"} (~${draft.locRadiusM} m).`);
        await sendRentPrompt(sink, draft);
        return;
      }
      await continueToEssentials(db, psid, sink, draft, publisherId);
      return;
    }
  }

  const imageIds = inboundImageIds(inbound);
  if (imageIds.length) {
    if (!flow.startsWith("pub") && flow !== "idle") {
      await sink.sendText("Si quieres publicar, pulsa Publicar en el menú y luego manda las fotos.");
      return;
    }
    const saveImage =
      opts.saveImage ??
      (async (mediaId: string) =>
        opts.uploadDir ? saveWhatsAppMediaImage(db, opts.uploadDir, mediaId) : null);
    const saved = (
      await Promise.all(imageIds.map((id) => saveImage(id).catch(() => null)))
    ).filter((u): u is string => typeof u === "string" && u.startsWith("/api/uploads/"));
    if (!saved.length) {
      await sink.sendText("No pude guardar esas fotos. Mándalas otra vez en JPG o PNG.");
      return;
    }

    const treatAsInfographic = isInfographicFlow(flow);
    if (treatAsInfographic) {
      const row = appendWhatsAppInfographicUrls(db, psid, saved, {
        publisherId,
        sourceText: inbound.imageCaption?.trim(),
        flow: "pub_infographics",
      });
      draft = row.draft;
      const delay = opts.photoAckDelayMs ?? DEFAULT_PHOTO_ACK_DELAY_MS;
      await scheduleMediaAck(db, psid, sink, delay, "infographic", {
        publisherId,
        uploadDir: opts.uploadDir,
      });
      return;
    }

    const photoFlow = flow === "idle" ? "pub_infographic_ask" : flow === "pub_desc" ? "pub_photos" : flow.startsWith("pub_") && flow !== "pub_photos" ? flow : "pub_photos";
    const row = appendWhatsAppPhotoUrls(db, psid, saved, {
      publisherId,
      sourceText: inbound.imageCaption?.trim(),
      flow: photoFlow === "pub_infographic_ask" ? "pub_infographic_ask" : "pub_photos",
    });
    draft = row.draft;
    if (flow === "idle" || photoFlow === "pub_infographic_ask") {
      await sink.sendText(
        draft.photoUrls.length
          ? `Guardé ${draft.photoUrls.length} foto${draft.photoUrls.length === 1 ? "" : "s"} del cuarto.`
          : "Guardé las fotos.",
      );
      save(db, psid, "pub_infographic_ask", draft, publisherId);
      await sendInfographicAsk(sink);
      return;
    }
    if (flow === "pub_photos" || flow === "pub_desc") {
      await scheduleMediaAck(db, psid, sink, opts.photoAckDelayMs ?? DEFAULT_PHOTO_ACK_DELAY_MS, "photo", {
        publisherId,
        uploadDir: opts.uploadDir,
      });
      return;
    }
    save(db, psid, flow, draft, publisherId);
    await sink.sendText("Anoté la foto. Sigue con el paso actual.");
    return;
  }

  if (!payload && flow === "idle" && textRaw) {
    if (isGreeting(textRaw)) payload = "WA_MENU";
    else if (/^ayuda$|^help$/i.test(lower)) payload = "WA_HELP";
    else if (/^publicar$|^anunciar$/i.test(lower)) payload = "WA_PUB";
    else if (/^buscar$/i.test(lower)) payload = "WA_SEARCH";
    else if (looksLikePublish(textRaw)) {
      if (!account) {
        await sink.sendText("Para publicar necesito un celular mexicano (+52) en este chat.");
        return;
      }
      draft = await enrichPublishDraftFromText({ ...emptyWhatsAppDraft(), intent: "publish" }, textRaw);
      if (textRaw.length >= 40 && !draft.summary) draft.summary = textRaw.slice(0, 1500);
      save(db, psid, "pub_infographic_ask", draft, publisherId);
      await sink.sendText("Armo el anuncio con lo que escribiste.");
      await sendInfographicAsk(sink);
      return;
    }
  }

  if (flow === "pub_infographic_ask") {
    if (/^(s[ií]|tengo)[\s!.]*$/i.test(lower)) payload = "WA_INFO_YES";
    else if (/^(no|ninguno)[\s!.]*$/i.test(lower)) payload = "WA_INFO_NO";
  }
  if (flow === "pub_infographics") {
    if (/^(no|seguir|listo|ya|eso\s+es\s+todo)[\s!.]*$/i.test(lower)) payload = "WA_INFO_DONE";
    else if (/^(s[ií]|otro|otra|m[aá]s)[\s!.]*$/i.test(lower)) payload = "WA_INFO_MORE";
  }
  if (flow === "pub_desc") {
    if (/^(saltar|skip|no|pasar)[\s!.]*$/i.test(lower)) payload = "WA_DESC_SKIP";
  }
  if (flow === "pub_photos") {
    if (/^(no|seguir|listo|ya|eso\s+es\s+todo)[\s!.]*$/i.test(lower)) {
      payload = "WA_PHOTOS_DONE";
    } else if (/^(s[ií]|m[aá]s|otra|otras)[\s!.]*$/i.test(lower)) {
      payload = "WA_PHOTOS_MORE";
    }
  }
  if (flow === "pub_room_kind") {
    if (/compartid/i.test(lower)) payload = "WA_KIND:shared:medium";
    else if (/individual|chic[ao]|peque/i.test(lower)) payload = "WA_KIND:private:small";
    else if (/grande|amplia/i.test(lower)) payload = "WA_KIND:private:large";
    else if (/privad|matrimonial/i.test(lower)) payload = "WA_KIND:private:medium";
  }
  if (flow === "pub_roomies") {
    if (/mujer|femenin/i.test(lower)) payload = "WA_GENDER:female";
    else if (/hombre|masculin/i.test(lower)) payload = "WA_GENDER:male";
    else if (/cualquier|indistint|da\s+igual/i.test(lower)) payload = "WA_GENDER:any";
  }
  if (flow === "pub_tags" && /^(listo|ya|no|nada|ninguno|eso\s+es\s+todo)[\s!.]*$/i.test(lower)) {
    payload = "WA_TAGS_DONE";
  }

  if (payload === "WA_MENU" || payload === "WA_CANCEL" || (payload != null && !payload.startsWith("WA_"))) {
    await goIdleMenu();
    return;
  }
  if (payload === "WA_HELP") {
    save(db, psid, "idle", draft, publisherId);
    await sendHelp(sink);
    await sendMenu(sink);
    return;
  }
  if (payload === "WA_SEARCH") {
    draft = { ...emptyWhatsAppDraft(), intent: "search" };
    save(db, psid, "search_zone", draft, publisherId);
    await sendZoneStep(sink);
    return;
  }
  if (payload === "WA_BUDGET") {
    draft.intent = "search";
    save(db, psid, "search_budget", draft, publisherId);
    await sendBudgetStep(sink);
    return;
  }
  if (payload === "WA_PUB") {
    if (!account) {
      await sink.sendText("Para publicar necesito un celular mexicano (+52) en este chat.");
      return;
    }
    draft = { ...emptyWhatsAppDraft(), intent: "publish" };
    save(db, psid, "pub_infographic_ask", draft, publisherId);
    await sendInfographicAsk(sink);
    return;
  }

  if (payload === "WA_INFO_YES") {
    save(db, psid, "pub_infographics", draft, publisherId);
    await sendInfographicPrompt(sink, draft.infographicUrls.length);
    return;
  }
  if (payload === "WA_INFO_NO") {
    const photoCap = photoCapFor(draft);
    if (draft.photoUrls.length > photoCap) draft = { ...draft, photoUrls: draft.photoUrls.slice(0, photoCap) };
    save(db, psid, "pub_photos", draft, publisherId);
    await sendPhotosPrompt(sink, draft);
    return;
  }
  if (payload === "WA_INFO_MORE") {
    save(db, psid, "pub_infographics", draft, publisherId);
    await sink.sendText(
      `Mándalo. Llevo ${draft.infographicUrls.length} de ${SELF_SERVE_MAX_INFOGRAPHICS}.`,
    );
    return;
  }
  if (payload === "WA_INFO_DONE") {
    await continueAfterInfographics(db, psid, sink, draft, publisherId, opts.uploadDir);
    return;
  }
  if (payload === "WA_DESC_SKIP") {
    await continueAfterDesc(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_POI:")) {
    const id = payload.slice("WA_POI:".length);
    draft.intent = "search";
    if (id === "other") {
      save(db, psid, "search_zone_text", draft, publisherId);
      await sink.sendText("Escribe la colonia, campus o punto (ej. Americana, CUCEI, Hospital Civil).");
      return;
    }
    const item = menuPoiById(id);
    if (!item) {
      await sendZoneStep(sink);
      return;
    }
    draft = applyMenuPoiToDraft(draft, item.poi);
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_BD:")) {
    const raw = payload.slice("WA_BD:".length);
    draft.budgetMax = raw === "*" ? null : Number(raw) || null;
    draft.intent = "search";
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_NEARBY") {
    draft.intent = "search";
    save(db, psid, "idle", draft, publisherId);
    await runWhatsAppNearbyAndReply(db, sink, draft);
    return;
  }

  if (payload === "WA_PREF_ASK") {
    draft.intent = "search";
    save(db, psid, "search_pref", draft, publisherId);
    await sendPrefStep(sink);
    return;
  }

  if (payload?.startsWith("WA_PREF:")) {
    const raw = payload.slice("WA_PREF:".length);
    draft.pref = raw === "female" || raw === "male" ? raw : null;
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_PHOTOS_MORE") {
    save(db, psid, "pub_photos", draft, publisherId);
    await sink.sendText(
      `Mándalas (varias a la vez está bien). Llevo ${draft.photoUrls.length} de ${photoCapFor(draft)}. Te pregunto de nuevo cuando las reciba.`,
    );
    return;
  }

  if (payload === "WA_PHOTOS_DONE") {
    if (draft.sourceText.length >= 40) draft = await enrichPublishDraftFromText(draft, draft.sourceText);
    await continueAfterPhotos(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_RENT_OK") {
    if (draft.rentMxn == null) {
      save(db, psid, "pub_rent", draft, publisherId);
      await sendRentPrompt(sink, draft, true);
      return;
    }
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_RENT_EDIT") {
    draft.rentMxn = null;
    save(db, psid, "pub_rent", draft, publisherId);
    await sendRentPrompt(sink, draft, true);
    return;
  }

  if (payload?.startsWith("WA_KIND:")) {
    const [kind, size] = payload.slice("WA_KIND:".length).split(":");
    draft.lodging = kind === "shared" ? "shared_room" : "private_room";
    draft.roomDimension = size === "small" || size === "large" ? size : "medium";
    draft.roomKindSet = true;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_GENDER:")) {
    const raw = payload.slice("WA_GENDER:".length);
    draft.genderPref = raw === "female" || raw === "male" ? raw : "any";
    draft.genderSet = true;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_DEP:")) {
    const raw = payload.slice("WA_DEP:".length);
    if (raw === "other") {
      save(db, psid, "pub_deposit", draft, publisherId);
      await sink.sendText("Escribe el monto del depósito en pesos, por ejemplo 6500.");
      return;
    }
    draft.depositMxn = raw === "rent" ? (draft.rentMxn ?? 0) : 0;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_TAGS_DONE") {
    draft.tagsConfirmed = true;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_TAGS_EDIT") {
    draft.tagsConfirmed = false;
    save(db, psid, "pub_tags", draft, publisherId);
    await sendTagsPrompt(sink, draft);
    return;
  }

  if (payload === "WA_PUBLISH") {
    if (!account) {
      await sink.sendText("Para publicar necesito un celular mexicano (+52) en este chat.");
      return;
    }
    const missing = publishDraftReady(draft);
    if (missing) {
      await sink.sendText(missing);
      return;
    }
    draft = await ensurePublishDraftSummary(draft);
    const fields = composeWhatsAppListingFields(draft);
    draft = { ...draft, title: fields.title, neighborhood: fields.neighborhood, summary: fields.summary };
    const result = publishWhatsAppRoom(db, {
      publisherId: account.publisherId,
      contactStored: account.contactStored,
      draft,
    });
    if (!result.ok) {
      await sink.sendText(result.error);
      return;
    }
    save(db, psid, "idle", emptyWhatsAppDraft(), publisherId);
    await sink.sendText(`Listo, ya está público:\n${result.url}\n\nPuedes editarlo en ${publicWebOrigin()}/mis-anuncios`);
    await sendMenu(sink);
    return;
  }

  if (!textRaw) {
    if (flow === "idle") await sendMenu(sink);
    return;
  }

  if (flow === "search_zone" || flow === "search_zone_text") {
    draft = await enrichDraftFromSearchText(draft, textRaw);
    if (draft.poiLat == null) {
      save(db, psid, "search_zone_text", draft, publisherId);
      await sink.sendText("No ubiqué esa zona. Prueba con Chapu, Centro, ITESO, CUCS… o elige de la lista.");
      await sendZoneStep(sink);
      return;
    }
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "search_budget") {
    draft.budgetMax = parseRentFromText(textRaw);
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_desc") {
    draft.summary = textRaw.slice(0, 1500);
    draft = await enrichPublishDraftFromText(draft, textRaw);
    await continueAfterDesc(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_photos") {
    draft = await enrichPublishDraftFromText(draft, textRaw);
    save(db, psid, "pub_photos", draft, publisherId);
    await sink.sendText("Anotado. Sigue mandando fotos o, si ya no hay más, pulsa No, seguir.");
    await sendPhotosPrompt(sink, draft);
    return;
  }

  if (flow === "pub_location") {
    draft = await applyLocationText(draft, textRaw);
    if (draft.locLat == null) {
      save(db, psid, "pub_location", draft, publisherId);
      await sink.sendText("No pude ubicar eso en Guadalajara. Comparte el pin o escribe otra colonia.");
      return;
    }
    if (draft.rentMxn == null) {
      save(db, psid, "pub_rent", draft, publisherId);
      await sink.sendText(`Zona aproximada: ${draft.locLabel} (~${draft.locRadiusM} m).`);
      await sendRentPrompt(sink, draft);
      return;
    }
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_rent") {
    const n = parseRentFromText(textRaw);
    if (n == null) {
      await sink.sendText("Escribe un monto exacto en pesos, por ejemplo 6500. No uses un rango.");
      return;
    }
    draft.rentMxn = n;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_deposit") {
    if (/^(no|sin|ninguno|0)[\s!.]*$/i.test(lower)) {
      draft.depositMxn = 0;
      await continueToEssentials(db, psid, sink, draft, publisherId);
      return;
    }
    const n = parseRentFromText(textRaw);
    if (n == null) {
      await sink.sendText("Escribe el monto del depósito, por ejemplo 6500, o responde No si no pides.");
      return;
    }
    draft.depositMxn = n;
    await continueToEssentials(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_tags") {
    const picked = parseChatAmenityReply(textRaw);
    if (!picked.length) {
      await sink.sendText("Responde con números del menú, por ejemplo 1,3,5. O pulsa Listo si ya está completo.");
      await sendTagsPrompt(sink, draft);
      return;
    }
    // An explicit tap overrides a "no" the model or the text inferred.
    draft.pubTags = [...new Set([...draft.pubTags, ...picked])];
    draft.deniedTags = draft.deniedTags.filter((t) => !picked.includes(t));
    save(db, psid, "pub_tags", draft, publisherId);
    await sink.sendText(`Anotado: ${chatTagLabels(picked).join(", ")}.`);
    await sendTagsPrompt(sink, draft);
    return;
  }

  if (flow === "idle") {
    draft = await enrichDraftFromSearchText({ ...emptyWhatsAppDraft(), intent: "search" }, textRaw);
    if (draft.poiLat == null) {
      save(db, psid, "search_zone", draft, publisherId);
      await sendZoneStep(sink);
      return;
    }
    await finishSearch(db, psid, sink, draft, publisherId);
    return;
  }

  // Unparsed text inside a publish step: re-ask that step instead of dumping the menu.
  if (flow === "pub_room_kind") {
    await sendRoomKindPrompt(sink);
    return;
  }
  if (flow === "pub_roomies") {
    await sendRoomiesPrompt(sink);
    return;
  }
  if (flow === "pub_infographic_ask") {
    await sendInfographicAsk(sink);
    return;
  }
  if (flow === "pub_infographics") {
    await sendInfographicPrompt(sink, draft.infographicUrls.length);
    return;
  }
  if (flow === "pub_preview") {
    await sendPreview(sink, draft);
    return;
  }

  await sendMenu(sink);
}

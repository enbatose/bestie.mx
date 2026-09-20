import type { DatabaseSync } from "node:sqlite";
import {
  SELF_SERVE_MAX_INFOGRAPHICS,
  SELF_SERVE_MAX_TEXT_CHARS,
  listingPhotoSlotsRemaining,
} from "./assistedDraftLimits.js";
import type { ChatSink } from "./chatChannel.js";
import { publicWebOrigin } from "./handoffTokens.js";
import { ensureWhatsAppBotAccount } from "./whatsappBotAccount.js";
import { saveWhatsAppMediaImage } from "./whatsappBotMedia.js";
import {
  analyzePublishDraftSource,
  appendPublishSourceText,
  applyLocationText,
  applyNativeLocation,
  applyWhatsAppPublishDefaults,
  composeWhatsAppListingFields,
  enrichPublishDraftFromInfographics,
  enrichPublishDraftFromText,
  ensurePublishDraftSummary,
  formatPublishPreview,
  parseRentFromText,
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
import { minimalRoomSummaryOk } from "./validation.js";

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

const DEFAULT_PHOTO_ACK_DELAY_MS = 2_500;
const mediaAckTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * WhatsApp body formatting for step prompts:
 * *bold* = main question, plain = short description, _italic_ = aside / extra context.
 */
function waStep(opts: { question: string; description?: string; aside?: string }): string {
  const parts = [`*${opts.question.trim()}*`];
  const desc = opts.description?.trim();
  if (desc) parts.push("", desc);
  const aside = opts.aside?.trim();
  if (aside) parts.push("", `_${aside}_`);
  return parts.join("\n");
}

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
  await sink.sendQuickReplies(
    ["Hola, soy Bestie.", "", "*¿Qué quieres hacer en Guadalajara?*"].join("\n"),
    [
      { title: "Buscar cuarto", payload: "WA_SEARCH" },
      { title: "Publicar", payload: "WA_PUB" },
      { title: "Ayuda", payload: "WA_HELP" },
    ],
  );
}

async function sendHelp(sink: ChatSink): Promise<void> {
  const base = publicWebOrigin().replace(/\/$/, "");
  const supportLink = `${base}/ayuda-wa`;
  const body = [
    "*¿Cómo te ayudo?*",
    "",
    "*Buscar, publicar y mensajear es y se quedará gratuito.*",
    "",
    "*Buscar:* elige una zona (Chapu, Centro, ITESO, CUCS…) y te mando anuncios de inmediato. Después puedes ajustar presupuesto o preferencia.",
    "",
    "*Publicar:* escribe o pega la descripción del cuarto; si quieres, un flyer con datos y fotos del espacio; revisa el preview y publica. Lo que falte se edita en el sitio.",
    "",
    `Mapa: ${base}/buscar`,
    `Términos: ${base}/legal/terminos`,
    "",
    "*Soporte*",
    "Correo: contacto@bestie.mx",
    "WhatsApp (solo mensajes): +52 331 *835713* 7",
  ].join("\n");

  if (sink.sendCtaUrl) {
    await sink.sendCtaUrl({
      body,
      buttonText: "Ayuda por WhatsApp",
      url: supportLink,
    });
    await sink.sendQuickReplies("_También puedes:_", [
      { title: "Reiniciar", payload: "WA_MENU" },
      { title: "Buscar cuarto", payload: "WA_SEARCH" },
      { title: "Publicar", payload: "WA_PUB" },
    ]);
    return;
  }

  // Fallback (tests / sinks without CTA): list row opens the vanity link via WA_HELP_WA.
  await sink.sendQuickReplies(body, [
    { title: "Reiniciar", payload: "WA_MENU" },
    { title: "Buscar cuarto", payload: "WA_SEARCH" },
    { title: "Publicar", payload: "WA_PUB" },
    { title: "Ayuda por WhatsApp", payload: "WA_HELP_WA" },
  ]);
}

async function sendZoneStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    waStep({
      question: "¿Cerca de dónde buscas?",
      description: "Te mando anuncios en cuanto elijas.",
      aside: "Guadalajara, ~3.5 km.",
    }),
    [
      ...CHAT_MENU_POIS.map((p) => ({ title: p.title, payload: `WA_POI:${p.id}` })),
      { title: "Otra zona", payload: "WA_POI:other" },
    ],
  );
}

async function sendBudgetStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(waStep({ question: "¿Presupuesto mensual máximo?" }), [
    { title: "Hasta $5,000", payload: "WA_BD:5000" },
    { title: "Hasta $8,000", payload: "WA_BD:8000" },
    { title: "Hasta $12,000", payload: "WA_BD:12000" },
    { title: "Sin tope", payload: "WA_BD:*" },
  ]);
}

async function sendPrefStep(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    waStep({
      question: "¿Preferencia de roomies del anuncio?",
      aside: "Es un filtro de búsqueda.",
    }),
    [
      { title: "Cualquiera", payload: "WA_PREF:any" },
      { title: "Pref. mujer", payload: "WA_PREF:female" },
      { title: "Pref. hombre", payload: "WA_PREF:male" },
    ],
  );
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
    waStep({
      question: "¿Tienes un flyer o imagen con los datos del cuarto?",
      description:
        "Una sola imagen con renta, zona o reglas (a veces con fotos mezcladas). Hasta 2.",
      aside: "Las fotos del espacio (cuarto, baño…) las pedimos en el siguiente paso.",
    }),
    [
      { title: "Sí, tengo", payload: "WA_INFO_YES" },
      { title: "No, seguir", payload: "WA_INFO_NO" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function sendInfographicPrompt(sink: ChatSink, count: number): Promise<void> {
  if (count <= 0) {
    await sink.sendQuickReplies(
      waStep({
        question: "¿Me mandas el flyer o imagen?",
        description: "Hasta 2 imágenes en JPG o PNG.",
        aside: "Después te pediré las fotos del espacio.",
      }),
      [{ title: "No tengo", payload: "WA_INFO_NO" }, { title: "Cancelar", payload: "WA_CANCEL" }],
    );
    return;
  }
  if (count >= SELF_SERVE_MAX_INFOGRAPHICS) {
    await sink.sendQuickReplies(
      waStep({
        question: "Listo: ya tengo el máximo de 2",
        description: "Guardé tus flyers o imágenes con datos.",
        aside: "Sigue con las fotos del espacio, o cancela.",
      }),
      [
        { title: "Continuar", payload: "WA_INFO_DONE" },
        { title: "Cancelar", payload: "WA_CANCEL" },
      ],
    );
    return;
  }
  await sink.sendQuickReplies(
    waStep({
      question: "¿Tienes otro flyer o imagen?",
      description: `Recibí ${count} (máximo ${SELF_SERVE_MAX_INFOGRAPHICS}).`,
    }),
    [
      { title: "Sí, otro", payload: "WA_INFO_MORE" },
      { title: "Continuar", payload: "WA_INFO_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function sendDescPrompt(sink: ChatSink): Promise<void> {
  await sink.sendQuickReplies(
    waStep({
      question: "¿Cómo describes el cuarto?",
      description:
        "Escribe aquí la descripción del anuncio: renta, zona, reglas, lo que quieras que vean. Si no cabe en un mensaje, mándalo en varios.",
      aside:
        "Si ya tienes una descripción (por ejemplo la de Facebook), cópiala y pégala aquí. Si no tienes texto, pulsa Saltar y sigue con fotos o un infográfico.",
    }),
    [
      { title: "Saltar", payload: "WA_DESC_SKIP" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function sendDescMorePrompt(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  const chars = draft.sourceText.trim().length;
  const nearCap = chars >= SELF_SERVE_MAX_TEXT_CHARS - 200;
  await sink.sendQuickReplies(
    waStep({
      question: "¿Hay más descripción?",
      description: `Recibí tu texto (~${chars.toLocaleString("es-MX")} caracteres). Si falta otra parte, pégala ahora.`,
      aside: nearCap
        ? "Ya casi llenamos el límite; si falta poco, mándalo. Si ya está completo, pulsa Ya está completa."
        : "Cuando ya esté todo el anuncio, pulsa Ya está completa.",
    }),
    [
      { title: "Ya está completa", payload: "WA_DESC_DONE" },
      { title: "Cancelar", payload: "WA_CANCEL" },
    ],
  );
}

async function finishDescriptionAndContinue(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  if (draft.sourceText.trim()) {
    await sink.sendText("Estoy leyendo todo el texto…");
    draft = await analyzePublishDraftSource(draft);
    if (!minimalRoomSummaryOk(draft.summary) && draft.sourceText.trim().length >= 100) {
      draft.summary = draft.sourceText.trim().slice(0, 1500);
    }
  }
  await continueToMedia(db, psid, sink, draft, publisherId);
}

async function sendPhotosPrompt(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  const maxPhotos = photoCapFor(draft);
  const count = draft.photoUrls.length;
  if (count <= 0) {
    await sink.sendQuickReplies(
      waStep({
        question: "¿Tienes fotos del espacio?",
        description: `Puedes subir hasta ${maxPhotos} fotos. Mándamelas (varias a la vez está bien).`,
        aside: "Si aún no tienes, puedes saltar y subirlas después.",
      }),
      [
        { title: "Saltar", payload: "WA_PHOTOS_SKIP" },
        { title: "Cancelar", payload: "WA_CANCEL" },
      ],
    );
    return;
  }
  if (count >= maxPhotos) {
    await sink.sendQuickReplies(
      waStep({
        question: `Listo: ya tengo el máximo de ${maxPhotos} fotos`,
        description: "El anuncio ya está completo de fotos.",
        aside: "Puedes cambiarlas después en el sitio.",
      }),
      [
        { title: "Continuar", payload: "WA_PHOTOS_DONE" },
        { title: "Cancelar", payload: "WA_CANCEL" },
      ],
    );
    return;
  }
  await sink.sendQuickReplies(
    waStep({
      question: "¿Tienes más fotos pendientes?",
      description: `Recibí ${count} (máximo ${maxPhotos}). Puedes mandar varias juntas.`,
    }),
    [
      { title: "Sí, más fotos", payload: "WA_PHOTOS_MORE" },
      { title: "Continuar", payload: "WA_PHOTOS_DONE" },
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

async function sendPreview(sink: ChatSink, draft: WhatsAppBotDraft): Promise<void> {
  await sink.sendQuickReplies(formatPublishPreview(draft), [
    { title: "Acepto y publicar", payload: "WA_PUBLISH" },
    { title: "Cancelar", payload: "WA_CANCEL" },
  ]);
}

/** Step 3: apply outreach-style defaults and show preview (no follow-up interview). */
async function goToPreview(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  let next = applyWhatsAppPublishDefaults(draft);
  next = await ensurePublishDraftSummary(next);
  save(db, psid, "pub_preview", next, publisherId);
  await sendPreview(sink, next);
}

/** Step 2: optional infographic, then photos. */
async function continueToMedia(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  save(db, psid, "pub_infographic_ask", draft, publisherId);
  await sendInfographicAsk(sink);
}

async function continueAfterPhotos(
  db: DatabaseSync,
  psid: string,
  sink: ChatSink,
  draft: WhatsAppBotDraft,
  publisherId?: string,
): Promise<void> {
  await goToPreview(db, psid, sink, draft, publisherId);
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
      if (isInfographicFlow(flow) || flow === "pub_desc" || flow === "pub_photos") {
        save(db, psid, flow, draft, publisherId);
        await sink.sendText(
          `Ubicación guardada (aproximada${draft.locLabel ? `: ${draft.locLabel}` : ""}). _Sigue con este paso._`,
        );
        if (isInfographicFlow(flow)) await sendInfographicPrompt(sink, draft.infographicUrls.length);
        else if (flow === "pub_photos") await sendPhotosPrompt(sink, draft);
        else await sendDescPrompt(sink);
        return;
      }
      if (flow === "idle" || flow === "pub_preview") {
        save(db, psid, "pub_desc", draft, publisherId);
        await sink.sendText("Ubicación guardada (aproximada).");
        await sendDescPrompt(sink);
        return;
      }
      await goToPreview(db, psid, sink, draft, publisherId);
      return;
    }
  }

  const imageIds = inboundImageIds(inbound);
  if (imageIds.length) {
    if (!flow.startsWith("pub") && flow !== "idle") {
      await sink.sendText("Si quieres publicar, pulsa *Publicar* en el menú y luego manda las fotos.");
      return;
    }
    const saveImage =
      opts.saveImage ??
      (async (mediaId: string) =>
        opts.uploadDir ? saveWhatsAppMediaImage(db, opts.uploadDir, mediaId) : null);
    const attempted = imageIds.length;
    const saved = (
      await Promise.all(imageIds.map((id) => saveImage(id).catch(() => null)))
    ).filter((u): u is string => typeof u === "string" && u.startsWith("/api/uploads/"));
    if (!saved.length) {
      await sink.sendText("*No pude guardar esas fotos.* Mándalas otra vez en JPG o PNG.");
      return;
    }
    const failedSave = Math.max(0, attempted - saved.length);

    const treatAsInfographic = isInfographicFlow(flow);
    if (treatAsInfographic) {
      const row = appendWhatsAppInfographicUrls(db, psid, saved, {
        publisherId,
        sourceText: inbound.imageCaption?.trim(),
        flow: "pub_infographics",
      });
      draft = row.draft;
      if (row.dropped > 0) {
        await sink.sendText(
          `_Máximo ${SELF_SERVE_MAX_INFOGRAPHICS}. Guardé ${draft.infographicUrls.length}; las ${row.dropped} de más no entraron._`,
        );
      } else if (failedSave > 0) {
        await sink.sendText(
          `_Guardé ${row.added} de ${attempted} (algunas no se pudieron leer; usa JPG o PNG)._`,
        );
      }
      const delay = opts.photoAckDelayMs ?? DEFAULT_PHOTO_ACK_DELAY_MS;
      await scheduleMediaAck(db, psid, sink, delay, "infographic", {
        publisherId,
        uploadDir: opts.uploadDir,
      });
      return;
    }

    const photoFlow =
      flow === "idle" || flow === "pub_desc"
        ? "pub_desc"
        : flow.startsWith("pub_") && flow !== "pub_photos"
          ? flow
          : "pub_photos";
    const row = appendWhatsAppPhotoUrls(db, psid, saved, {
      publisherId,
      sourceText: inbound.imageCaption?.trim(),
      flow: photoFlow === "pub_desc" ? "pub_desc" : "pub_photos",
    });
    draft = row.draft;
    const cap = photoCapFor(draft);
    if (row.dropped > 0) {
      await sink.sendText(
        `_Máximo ${cap} fotos. Guardé las primeras ${draft.photoUrls.length}; las ${row.dropped} de más no entraron._`,
      );
    } else if (failedSave > 0) {
      await sink.sendText(
        `_Guardé ${row.added} de ${attempted} (algunas no se pudieron leer; usa JPG o PNG)._`,
      );
    }
    if (flow === "idle" || flow === "pub_desc") {
      await sink.sendText(
        draft.photoUrls.length
          ? `Guardé ${draft.photoUrls.length} foto${draft.photoUrls.length === 1 ? "" : "s"}. Ahora pega el texto del anuncio.`
          : "Guardé las fotos. Ahora pega el texto del anuncio.",
      );
      save(db, psid, "pub_desc", draft, publisherId);
      await sendDescPrompt(sink);
      return;
    }
    if (flow === "pub_photos") {
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
        await sink.sendText("*Para publicar necesito un celular mexicano (+52) en este chat.*");
        return;
      }
      draft = appendPublishSourceText({ ...emptyWhatsAppDraft(), intent: "publish" }, textRaw);
      save(db, psid, "pub_desc", draft, publisherId);
      await sendDescMorePrompt(sink, draft);
      return;
    }
  }

  if (flow === "pub_infographic_ask") {
    if (/^(s[ií]|tengo)[\s!.]*$/i.test(lower)) payload = "WA_INFO_YES";
    else if (/^(no|ninguno)[\s!.]*$/i.test(lower)) payload = "WA_INFO_NO";
  }
  if (flow === "pub_infographics") {
    if (/^(no|seguir|listo|ya|continuar|eso\s+es\s+todo)[\s!.]*$/i.test(lower)) payload = "WA_INFO_DONE";
    else if (/^(s[ií]|otro|otra|m[aá]s)[\s!.]*$/i.test(lower)) payload = "WA_INFO_MORE";
  }
  if (flow === "pub_desc") {
    if (/^(saltar|skip|pasar)[\s!.]*$/i.test(lower)) {
      payload = draft.sourceText.trim() ? "WA_DESC_DONE" : "WA_DESC_SKIP";
    } else if (
      draft.sourceText.trim() &&
      /^(no|seguir|listo|ya|eso\s+es\s+todo|ya\s+est[aá]\s+completa|completa)[\s!.]*$/i.test(lower)
    ) {
      payload = "WA_DESC_DONE";
    }
  }
  if (flow === "pub_photos") {
    if (/^(saltar|skip|sin\s+fotos|después|despues|luego)[\s!.]*$/i.test(lower)) {
      payload = "WA_PHOTOS_SKIP";
    } else if (/^(no|seguir|listo|ya|continuar|eso\s+es\s+todo)[\s!.]*$/i.test(lower)) {
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
  if (
    (flow === "pub_tags" || flow === "pub_tags_add" || flow === "pub_tags_remove") &&
    /^(listo|ya|no|nada|ninguno|seguir|eso\s+es\s+todo|asi\s+esta\s+bien|así\s+está\s+bien)[\s!.]*$/i.test(
      lower,
    )
  ) {
    payload = "WA_TAGS_DONE";
  }

  if (payload === "WA_MENU" || payload === "WA_CANCEL" || (payload != null && !payload.startsWith("WA_"))) {
    await goIdleMenu();
    return;
  }
  if (payload === "WA_HELP") {
    save(db, psid, "idle", draft, publisherId);
    await sendHelp(sink);
    return;
  }
  if (payload === "WA_HELP_WA") {
    const supportLink = `${publicWebOrigin().replace(/\/$/, "")}/ayuda-wa`;
    await sink.sendText(
      [
        "Abre este enlace para escribirle a Soporte (+52 331 *835713* 7):",
        supportLink,
      ].join("\n"),
    );
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
      await sink.sendText("*Para publicar necesito un celular mexicano (+52) en este chat.*");
      return;
    }
    draft = { ...emptyWhatsAppDraft(), intent: "publish" };
    save(db, psid, "pub_desc", draft, publisherId);
    await sendDescPrompt(sink);
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
      waStep({
        question: "¿Me mandas otro?",
        description: `Llevo ${draft.infographicUrls.length} de ${SELF_SERVE_MAX_INFOGRAPHICS}.`,
      }),
    );
    return;
  }
  if (payload === "WA_INFO_DONE") {
    await continueAfterInfographics(db, psid, sink, draft, publisherId, opts.uploadDir);
    return;
  }
  if (payload === "WA_DESC_SKIP") {
    await continueToMedia(db, psid, sink, draft, publisherId);
    return;
  }
  if (payload === "WA_DESC_DONE") {
    await finishDescriptionAndContinue(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_POI:")) {
    const id = payload.slice("WA_POI:".length);
    draft.intent = "search";
    if (id === "other") {
      save(db, psid, "search_zone_text", draft, publisherId);
      await sink.sendText(
        waStep({
          question: "¿Otra zona?",
          description: "Escribe la colonia, campus o punto (ej. Americana, CUCEI, Hospital Civil).",
        }),
      );
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
      waStep({
        question: "¿Me mandas más fotos?",
        description: `Llevo ${draft.photoUrls.length} de ${photoCapFor(draft)}. Puedes mandar varias a la vez.`,
        aside: "Te pregunto de nuevo cuando las reciba.",
      }),
    );
    return;
  }

  if (payload === "WA_PHOTOS_SKIP" || payload === "WA_PHOTOS_DONE") {
    if (draft.sourceText.trim()) draft = await enrichPublishDraftFromText(draft, draft.sourceText);
    await continueAfterPhotos(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_RENT_OK" || payload === "WA_RENT_EDIT" || payload === "WA_TAGS_DONE") {
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_KIND:")) {
    const [kind, size] = payload.slice("WA_KIND:".length).split(":");
    draft.lodging = kind === "shared" ? "shared_room" : "private_room";
    draft.roomDimension = size === "small" || size === "large" ? size : "medium";
    draft.roomKindSet = true;
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_GENDER:")) {
    const raw = payload.slice("WA_GENDER:".length);
    draft.genderPref = raw === "female" || raw === "male" ? raw : "any";
    draft.genderSet = true;
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload?.startsWith("WA_DEP:")) {
    const raw = payload.slice("WA_DEP:".length);
    if (raw === "other") {
      draft.depositMxn = 0;
    } else {
      draft.depositMxn = raw === "rent" ? (draft.rentMxn ?? 0) : 0;
    }
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (payload === "WA_PUBLISH") {
    if (!account) {
      await sink.sendText("*Para publicar necesito un celular mexicano (+52) en este chat.*");
      return;
    }
    draft = applyWhatsAppPublishDefaults(draft);
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
    await sink.sendText(
      [
        "*Listo, ya está público:*",
        result.url,
        "",
        `_Puedes editarlo en ${publicWebOrigin()}/mis-anuncios_`,
        "",
        "_Cuando quieras algo más, escribe Hola._",
      ].join("\n"),
    );
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
      await sink.sendText(
        waStep({
          question: "No ubiqué esa zona.",
          description: "Prueba con Chapu, Centro, ITESO, CUCS… o elige de la lista.",
        }),
      );
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
    const beforeLen = draft.sourceText.trim().length;
    draft = appendPublishSourceText(draft, textRaw);
    const afterLen = draft.sourceText.trim().length;
    if (afterLen <= beforeLen) {
      await sink.sendText("No pude añadir ese texto. Intenta pegarlo de nuevo.");
      await sendDescMorePrompt(sink, draft);
      save(db, psid, "pub_desc", draft, publisherId);
      return;
    }
    save(db, psid, "pub_desc", draft, publisherId);
    await sendDescMorePrompt(sink, draft);
    return;
  }

  if (flow === "pub_photos") {
    draft = await enrichPublishDraftFromText(draft, textRaw);
    save(db, psid, "pub_photos", draft, publisherId);
    await sink.sendText("Anotado. Sigue mandando fotos o, si ya no hay más, pulsa Continuar.");
    await sendPhotosPrompt(sink, draft);
    return;
  }

  if (flow === "pub_location") {
    draft = await applyLocationText(draft, textRaw);
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_rent") {
    const n = parseRentFromText(textRaw);
    if (n != null) draft.rentMxn = n;
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_deposit") {
    if (/^(no|sin|ninguno|0)[\s!.]*$/i.test(lower)) {
      draft.depositMxn = 0;
    } else {
      const n = parseRentFromText(textRaw);
      draft.depositMxn = n ?? 0;
    }
    await goToPreview(db, psid, sink, draft, publisherId);
    return;
  }

  if (flow === "pub_tags" || flow === "pub_tags_add" || flow === "pub_tags_remove") {
    await goToPreview(db, psid, sink, draft, publisherId);
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
  if (flow === "pub_room_kind" || flow === "pub_roomies" || flow === "pub_deposit" || flow === "pub_tags") {
    await goToPreview(db, psid, sink, draft, publisherId);
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

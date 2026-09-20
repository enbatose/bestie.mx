/**
 * Meta WhatsApp Cloud API — inbound bot replies (Bestie Chat app).
 * Distinct from OTP (`META_ACCESS_TOKEN` + `META_WHATSAPP_PHONE_NUMBER_ID`).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import type { ChatQuickReply, ChatSink } from "./chatChannel.js";

const GRAPH = "https://graph.facebook.com/v21.0";

function cloudToken(): string | null {
  return process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() || null;
}

export function whatsappCloudPhoneNumberId(): string | null {
  return process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() || null;
}

export function whatsappSessionId(fromDigits: string): string {
  const d = fromDigits.replace(/\D/g, "");
  return `wa:${d}`;
}

/** Session keys Meta may use for a Mexican +52 mobile (optional extra 1 after country code). */
export function whatsappSessionIdsForStoredPhone(phoneE164: string): string[] {
  const d = phoneE164.replace(/\D/g, "");
  const ids = new Set<string>();
  if (d.length >= 10) ids.add(whatsappSessionId(d));
  if (d.startsWith("52") && d.length === 12) ids.add(whatsappSessionId(`521${d.slice(2)}`));
  if (d.startsWith("521") && d.length === 13) ids.add(whatsappSessionId(`52${d.slice(3)}`));
  if (d.length === 10) {
    ids.add(whatsappSessionId(`52${d}`));
    ids.add(whatsappSessionId(`521${d}`));
  }
  return [...ids];
}

async function postMessages(body: unknown): Promise<void> {
  const token = cloudToken();
  const phoneId = whatsappCloudPhoneNumberId();
  if (!token || !phoneId) return;
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...((body as object) ?? {}) }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn(`[whatsapp-cloud] send failed ${res.status}: ${t.slice(0, 300)}`);
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  await postMessages({
    to,
    type: "text",
    text: { preview_url: true, body: text.slice(0, 4096) },
  });
}

export async function sendWhatsAppImage(to: string, url: string, caption?: string): Promise<void> {
  await postMessages({
    to,
    type: "image",
    image: {
      link: url,
      ...(caption?.trim() ? { caption: caption.trim().slice(0, 1024) } : {}),
    },
  });
}

async function sendWhatsAppButtons(to: string, text: string, replies: ChatQuickReply[]): Promise<void> {
  const buttons = replies.slice(0, 3).map((r) => ({
    type: "reply" as const,
    reply: { id: r.payload.slice(0, 256), title: r.title.slice(0, 20) },
  }));
  await postMessages({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: text.slice(0, 1024) },
      action: { buttons },
    },
  });
}

async function sendWhatsAppList(to: string, text: string, replies: ChatQuickReply[]): Promise<void> {
  const rows = replies.slice(0, 10).map((r) => ({
    id: r.payload.slice(0, 200),
    title: r.title.slice(0, 24),
  }));
  await postMessages({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: text.slice(0, 1024) },
      action: {
        button: "Ver opciones",
        sections: [{ title: "Opciones", rows }],
      },
    },
  });
}

async function sendWhatsAppCtaUrl(
  to: string,
  opts: { body: string; buttonText: string; url: string },
): Promise<void> {
  await postMessages({
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: opts.body.slice(0, 1024) },
      action: {
        name: "cta_url",
        parameters: {
          display_text: opts.buttonText.slice(0, 20),
          url: opts.url.slice(0, 2000),
        },
      },
    },
  });
}

export function whatsappChatSink(to: string): ChatSink {
  return {
    sendText: (text) => sendWhatsAppText(to, text),
    sendQuickReplies: async (text, replies) => {
      if (replies.length <= 3) await sendWhatsAppButtons(to, text, replies);
      else await sendWhatsAppList(to, text, replies);
    },
    sendImage: ({ url, caption }) => sendWhatsAppImage(to, url, caption),
    sendCtaUrl: (opts) => sendWhatsAppCtaUrl(to, opts),
    sendListingCards: async (cards, footer) => {
      for (const c of cards.slice(0, 3)) {
        const caption = `${c.title}\n${c.subtitle}\n${c.url}`.slice(0, 1024);
        if (c.imageUrl?.startsWith("http")) {
          await sendWhatsAppImage(to, c.imageUrl, caption);
        } else {
          await sendWhatsAppText(to, caption);
        }
      }
      if (footer.trim()) await sendWhatsAppText(to, footer.slice(0, 4096));
    },
  };
}

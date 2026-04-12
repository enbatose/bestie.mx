const GRAPH = "https://graph.facebook.com/v21.0/me/messages";

type QuickReply = { title: string; payload: string };

type GenericElement = {
  title: string;
  subtitle: string;
  image_url?: string;
  default_action?: { type: "web_url"; url: string; webview_height_ratio?: "compact" | "tall" | "full" };
  buttons?: { type: "web_url"; title: string; url: string }[];
};

function pageToken(): string | null {
  const t = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim();
  return t || null;
}

async function postMessage(body: unknown): Promise<void> {
  const token = pageToken();
  if (!token) return;
  await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendMessengerText(psid: string, text: string): Promise<void> {
  await postMessage({
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text: text.slice(0, 2000) },
  });
}

export async function sendMessengerQuickReplies(
  psid: string,
  text: string,
  replies: QuickReply[],
): Promise<void> {
  const qr = replies.slice(0, 13).map((r) => ({
    content_type: "text" as const,
    title: r.title.slice(0, 20),
    payload: r.payload.slice(0, 1000),
  }));
  await postMessage({
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      text: text.slice(0, 1000),
      quick_replies: qr,
    },
  });
}

export async function sendMessengerGenericCarousel(psid: string, elements: GenericElement[]): Promise<void> {
  const els = elements.slice(0, 10).map((e) => ({
    title: e.title.slice(0, 80),
    subtitle: e.subtitle.slice(0, 80),
    ...(e.image_url ? { image_url: e.image_url } : {}),
    ...(e.default_action ? { default_action: e.default_action } : {}),
    ...(e.buttons ? { buttons: e.buttons.slice(0, 3) } : {}),
  }));
  await postMessage({
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "generic", elements: els },
      },
    },
  });
}

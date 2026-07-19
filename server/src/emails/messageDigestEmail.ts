import { publicBaseUrl } from "../publicBaseUrl.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  primaryButtonHtml,
  renderEmailShell,
  textLinkHtml,
  defaultSupportFooter,
} from "./emailLayout.js";

export type DigestMessageRow = {
  /** Pre-formatted friendly local time (includes timezone note when needed). */
  whenLabel: string;
  contextTitle: string;
};

export type DigestNotificationRow = {
  text: string;
  link: string;
  whenLabel: string;
};

export type MessageDigestEmailPayload = {
  displayName?: string;
  unreadMessageCount: number;
  messages: DigestMessageRow[];
  notifications: DigestNotificationRow[];
};

function absoluteAppUrl(base: string, link: string): string {
  let path = (link || "").trim() || "/notifications";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      path = `${u.pathname}${u.search}${u.hash}` || "/notifications";
    } catch {
      path = "/notifications";
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  // Legacy Spanish path used in older digests / defaults.
  if (path === "/notificaciones" || path.startsWith("/notificaciones?")) {
    path = path.replace("/notificaciones", "/notifications");
  }
  return `${base}${path}`;
}

export function buildMessageDigestEmail(payload: MessageDigestEmailPayload): BuiltTransactionalEmail {
  const base = publicBaseUrl();
  const messagesUrl = `${base}/mensajes`;
  const notificationsUrl = `${base}/notifications`;
  const count = payload.unreadMessageCount;
  const B = EMAIL_BRAND;

  const subject =
    count === 1 ? "Bestie · tienes un mensaje nuevo" : `Bestie · tienes ${count} mensajes nuevos`;
  const previewText =
    count === 1
      ? "Ábrelo en Mensajes. No incluimos el contenido del chat aquí."
      : `${count} mensajes sin leer. Ábrelos en la app cuando puedas.`;

  const greeting = greetingHtml(payload.displayName);
  const msgLine =
    count === 1
      ? "Tienes <strong style=\"color:#143D30;\">1 mensaje nuevo</strong> en Bestie."
      : `Tienes <strong style="color:#143D30;">${count} mensajes nuevos</strong> en Bestie.`;
  const msgLineText =
    count === 1 ? "Tienes 1 mensaje nuevo en Bestie." : `Tienes ${count} mensajes nuevos en Bestie.`;

  const messageRows = payload.messages.slice(0, 12);
  const messagesHtml =
    messageRows.length > 0
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
          ${messageRows
            .map((m, i) => {
              const border =
                i < messageRows.length - 1 ? `border-bottom:1px solid ${B.border};` : "";
              return `<tr><td style="padding:12px 14px;${border}">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;line-height:1.4;color:${B.primary};">${escapeHtml(m.contextTitle)}</p>
                <p style="margin:0;font-size:12px;line-height:1.4;color:${B.muted};">${escapeHtml(m.whenLabel)}</p>
              </td></tr>`;
            })
            .join("")}
        </table>
      `
      : "";

  const messagesText =
    messageRows.length > 0
      ? ["", "Detalle:", ...messageRows.map((m) => `- ${m.contextTitle} · ${m.whenLabel}`)].join(
          "\n",
        )
      : "";

  const notifRows = payload.notifications.slice(0, 8);
  const notifHtml =
    notifRows.length > 0
      ? `
        <p style="margin:22px 0 8px;font-size:13px;font-weight:700;color:${B.primary};">También en tu actividad reciente</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
          ${notifRows
            .map((n, i) => {
              const href = absoluteAppUrl(base, n.link);
              const border =
                i < notifRows.length - 1 ? `border-bottom:1px solid ${B.border};` : "";
              return `<tr><td style="padding:12px 14px;${border}">
                <a href="${escapeHtml(href)}" style="color:${B.primary};font-weight:600;text-decoration:none;font-size:13px;line-height:1.45;">${escapeHtml(n.text)}</a>
                <p style="margin:4px 0 0;font-size:12px;line-height:1.4;color:${B.muted};">${escapeHtml(n.whenLabel)}</p>
              </td></tr>`;
            })
            .join("")}
        </table>
        <p style="margin:14px 0 0;text-align:center;">${textLinkHtml(notificationsUrl, "Ver notificaciones")}</p>
      `
      : "";

  const notifText =
    notifRows.length > 0
      ? [
          "",
          "También en tu actividad reciente:",
          ...notifRows.map((n) => {
            const href = absoluteAppUrl(base, n.link);
            return `- ${n.text} · ${n.whenLabel} (${href})`;
          }),
          `Ver notificaciones: ${notificationsUrl}`,
        ].join("\n")
      : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greeting},</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${B.muted};">${msgLine}</p>
    <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:${B.muted};">Por tu privacidad, no incluimos el contenido del mensaje en este correo.</p>
    ${messagesHtml}
    <p style="margin:0;text-align:center;">${primaryButtonHtml(messagesUrl, "Ver mensajes")}</p>
    ${notifHtml}
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Nuevos mensajes",
    bodyHtml,
    footerHtml: defaultSupportFooter(
      "Enviamos como máximo un correo de este tipo cada 3 horas cuando hay actividad nueva.",
    ),
  });

  const text = [
    greetingText(payload.displayName) + ",",
    "",
    msgLineText,
    "Por tu privacidad, no incluimos el contenido del mensaje en este correo.",
    messagesText,
    "",
    `Ver mensajes: ${messagesUrl}`,
    notifText,
    "",
    "Enviamos como máximo un correo de este tipo cada 3 horas cuando hay actividad nueva.",
    `Ayuda: ${B.support}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return {
    subject,
    previewText,
    html,
    text,
    replyTo: B.support,
    tags: [
      { name: "category", value: "message_digest" },
      { name: "product", value: "bestie" },
    ],
  };
}

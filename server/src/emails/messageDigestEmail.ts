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

export type MessageDigestEmailPayload = {
  displayName?: string;
  unreadMessageCount: number;
  notifications: { text: string; link: string }[];
};

export function buildMessageDigestEmail(payload: MessageDigestEmailPayload): BuiltTransactionalEmail {
  const base = publicBaseUrl();
  const messagesUrl = `${base}/mensajes`;
  const notificationsUrl = `${base}/notificaciones`;
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

  const notifRows = payload.notifications.slice(0, 8);
  const notifHtml =
    notifRows.length > 0
      ? `
        <p style="margin:22px 0 8px;font-size:13px;font-weight:700;color:${B.primary};">También en tu actividad reciente</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
          ${notifRows
            .map((n, i) => {
              const href = n.link.startsWith("http")
                ? n.link
                : `${base}${n.link.startsWith("/") ? n.link : `/${n.link}`}`;
              const border =
                i < notifRows.length - 1 ? `border-bottom:1px solid ${B.border};` : "";
              return `<tr><td style="padding:12px 14px;${border}font-size:13px;line-height:1.45;color:${B.body};"><a href="${escapeHtml(href)}" style="color:${B.primary};font-weight:600;text-decoration:none;">${escapeHtml(n.text)}</a></td></tr>`;
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
            const href = n.link.startsWith("http")
              ? n.link
              : `${base}${n.link.startsWith("/") ? n.link : `/${n.link}`}`;
            return `- ${n.text} (${href})`;
          }),
        ].join("\n")
      : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greeting},</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${B.muted};">${msgLine}</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.55;color:${B.muted};">Por tu privacidad, no incluimos el contenido del mensaje en este correo.</p>
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

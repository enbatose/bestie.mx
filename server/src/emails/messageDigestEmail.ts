import { publicBaseUrl } from "../publicBaseUrl.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MessageDigestEmailPayload = {
  displayName?: string;
  unreadMessageCount: number;
  notifications: { text: string; link: string }[];
};

export function buildMessageDigestEmail(payload: MessageDigestEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const base = publicBaseUrl();
  const messagesUrl = `${base}/mensajes`;
  const notificationsUrl = `${base}/notificaciones`;
  const count = payload.unreadMessageCount;
  const subject =
    count === 1 ? "Bestie · tienes un mensaje nuevo" : `Bestie · tienes ${count} mensajes nuevos`;
  const greeting = payload.displayName?.trim()
    ? `Hola, ${escapeHtml(payload.displayName.trim())}`
    : "Hola";
  const msgLine =
    count === 1
      ? "Tienes <strong>1 mensaje nuevo</strong> en Bestie."
      : `Tienes <strong>${count} mensajes nuevos</strong> en Bestie.`;
  const msgLineText =
    count === 1 ? "Tienes 1 mensaje nuevo en Bestie." : `Tienes ${count} mensajes nuevos en Bestie.`;

  const notifRows = payload.notifications.slice(0, 10);
  const notifHtml =
    notifRows.length > 0
      ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#143D30;">También desde tu última alerta:</p>
        <ul style="margin:0;padding:0 0 0 18px;color:#4b5563;font-size:13px;line-height:1.55;">
          ${notifRows
            .map((n) => {
              const href = n.link.startsWith("http")
                ? n.link
                : `${base}${n.link.startsWith("/") ? n.link : `/${n.link}`}`;
              return `<li style="margin:0 0 8px;"><a href="${escapeHtml(href)}" style="color:#143D30;text-decoration:underline;">${escapeHtml(n.text)}</a></li>`;
            })
            .join("")}
        </ul>`
      : "";
  const notifText =
    notifRows.length > 0
      ? [
          "",
          "También desde tu última alerta:",
          ...notifRows.map((n) => {
            const href = n.link.startsWith("http")
              ? n.link
              : `${base}${n.link.startsWith("/") ? n.link : `/${n.link}`}`;
            return `- ${n.text} (${href})`;
          }),
        ].join("\n")
      : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:24px 24px 12px;background:#143D30;">
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Bestie.mx</p>
          <p style="margin:8px 0 0;font-size:14px;color:#d1fae5;">Nuevos mensajes</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#374151;">${greeting},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#4b5563;">${msgLine}</p>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.55;color:#6b7280;">Por tu privacidad, no incluimos el contenido del mensaje en este correo.</p>
          <p style="margin:0;text-align:center;"><a href="${escapeHtml(messagesUrl)}" style="display:inline-block;padding:12px 20px;background:#143D30;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Ver mensajes</a></p>
          ${notifHtml}
          ${
            notifRows.length > 0
              ? `<p style="margin:16px 0 0;text-align:center;"><a href="${escapeHtml(notificationsUrl)}" style="font-size:13px;font-weight:600;color:#143D30;">Ver notificaciones</a></p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">Enviamos como máximo un correo de este tipo cada 3 horas cuando hay actividad nueva.<br/>¿Necesitas ayuda? <a href="mailto:contacto@bestie.mx" style="color:#6b7280;">contacto@bestie.mx</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting.replace(/<[^>]+>/g, "")},`,
    "",
    msgLineText,
    "Por tu privacidad, no incluimos el contenido del mensaje en este correo.",
    "",
    `Ver mensajes: ${messagesUrl}`,
    notifText,
    "",
    "Enviamos como máximo un correo de este tipo cada 3 horas cuando hay actividad nueva.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { subject, html, text };
}

import { publicBaseUrl } from "../publicBaseUrl.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function passwordResetEmailSubject(): string {
  return "Bestie · restablecer contraseña";
}

export type PasswordResetEmailPayload = {
  resetUrl: string;
  displayName?: string;
};

export function buildPasswordResetEmail(payload: PasswordResetEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = passwordResetEmailSubject();
  const resetUrl = payload.resetUrl;
  const greeting = payload.displayName?.trim()
    ? `Hola, ${escapeHtml(payload.displayName.trim())}`
    : "Hola";

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:24px 24px 12px;background:#1e3a5f;">
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Bestie.mx</p>
          <p style="margin:8px 0 0;font-size:14px;color:#dbeafe;">Recuperar contraseña</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#374151;">${greeting},</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#4b5563;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el botón para ir a tu perfil y elegir una contraseña nueva.</p>
          <p style="margin:0;text-align:center;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Restablecer contraseña</a></p>
          <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#6b7280;">El enlace expira en <strong>1 hora</strong> y solo puede usarse una vez. Si no lo ves en la bandeja de entrada, revisa <strong>spam</strong> o <strong>promociones</strong>.</p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;word-break:break-all;">Enlace directo:<br/><a href="${escapeHtml(resetUrl)}" style="color:#2563eb;">${escapeHtml(resetUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">Si no solicitaste este cambio, ignora este correo.<br/>¿Necesitas ayuda? <a href="mailto:support@bestie.mx" style="color:#6b7280;">support@bestie.mx</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting.replace(/<[^>]+>/g, "")},`,
    "",
    "Restablece tu contraseña de Bestie con este enlace (expira en 1 hora):",
    resetUrl,
    "",
    "Si no lo solicitaste, ignora este correo.",
  ].join("\n");

  return { subject, html, text };
}

export function passwordResetUrl(token: string): string {
  return `${publicBaseUrl()}/perfil/editar?reset=${encodeURIComponent(token)}`;
}

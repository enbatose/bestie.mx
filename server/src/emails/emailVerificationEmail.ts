import { publicBaseUrl } from "../publicBaseUrl.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Short subject so code is visible in mobile inbox preview (~35 chars). */
export function emailVerificationSubject(code: string): string {
  return `Bestie · código ${code}`;
}

/** Verification page URL; optional `copy=1` opens the page and copies the code in the browser. */
export function emailVerificationPageUrl(code: string, opts?: { copy?: boolean }): string {
  const base = publicBaseUrl();
  const q = new URLSearchParams({ code });
  if (opts?.copy) q.set("copy", "1");
  return `${base}/verificar-correo?${q.toString()}`;
}

export type EmailVerificationEmailPayload = {
  code: string;
  displayName?: string;
};

export function buildEmailVerificationEmail(payload: EmailVerificationEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const code = payload.code;
  const subject = emailVerificationSubject(code);
  const base = publicBaseUrl();
  const verifyUrl = `${base}/verificar-correo`;
  const copyUrl = emailVerificationPageUrl(code, { copy: true });
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
          <p style="margin:8px 0 0;font-size:14px;color:#dbeafe;">Confirma tu correo</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#374151;">${greeting},</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#4b5563;">Para activar tu cuenta, ingresa este código de 6 dígitos en Bestie. También aparece en el asunto de este correo.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
            <tr>
              <td style="padding:12px 12px 0 16px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Tu código</td>
              <td align="right" style="padding:8px 12px 0 8px;vertical-align:top;">
                <a href="${escapeHtml(copyUrl)}" title="Copiar código" style="display:inline-block;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;background:#ffffff;color:#374151;font-size:16px;line-height:1;text-decoration:none;">&#128203;</a>
              </td>
            </tr>
            <tr>
              <td colspan="2" align="center" style="padding:8px 16px 12px;">
                <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.28em;color:#1e3a5f;font-variant-numeric:tabular-nums;">${escapeHtml(code)}</p>
              </td>
            </tr>
            <tr>
              <td colspan="2" align="center" style="padding:0 16px 16px;">
                <a href="${escapeHtml(copyUrl)}" style="display:inline-block;padding:10px 18px;border:1px solid #1e3a5f;border-radius:999px;background:#ffffff;color:#1e3a5f;font-size:13px;font-weight:700;text-decoration:none;">Copiar Código</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b7280;text-align:center;">Los botones de copiar abren Bestie, guardan el código en tu portapapeles y te llevan a la página de verificación.</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4b5563;">El código expira en <strong>10 minutos</strong>. Si no lo ves en la bandeja de entrada, revisa <strong>spam</strong> o <strong>promociones</strong>.</p>
          <p style="margin:0;text-align:center;"><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Ir a verificar</a></p>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">Si no creaste una cuenta en Bestie, ignora este correo.<br/>¿Necesitas ayuda? <a href="mailto:contacto@bestie.mx" style="color:#6b7280;">contacto@bestie.mx</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting.replace(/<[^>]+>/g, "")},`,
    "",
    "Tu código de verificación Bestie:",
    code,
    "",
    "Ingresa los 6 dígitos en la app (expira en 10 minutos).",
    "Si no lo encuentras, revisa spam o promociones.",
    "",
    `Copiar y verificar: ${copyUrl}`,
    "",
    `Verificar: ${verifyUrl}`,
  ].join("\n");

  return { subject, html, text };
}

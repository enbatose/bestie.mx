import { publicBaseUrl } from "../publicBaseUrl.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  primaryButtonHtml,
  renderEmailShell,
  secondaryButtonHtml,
  defaultSupportFooter,
} from "./emailLayout.js";

/** Short subject so the code is visible in mobile inbox (~24 chars). */
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

export function buildEmailVerificationEmail(
  payload: EmailVerificationEmailPayload,
): BuiltTransactionalEmail {
  const code = payload.code;
  const subject = emailVerificationSubject(code);
  const previewText = `Tu código es ${code}. Expira en 10 minutos.`;
  const base = publicBaseUrl();
  const verifyUrl = `${base}/verificar-correo`;
  const copyUrl = emailVerificationPageUrl(code, { copy: true });
  const greeting = greetingHtml(payload.displayName);
  const B = EMAIL_BRAND;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greeting},</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${B.muted};">Para activar tu cuenta, usa este código de 6 dígitos en Bestie. También está en el asunto de este correo.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
      <tr>
        <td style="padding:14px 16px 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${B.muted};">Tu código</td>
      </tr>
      <tr>
        <td align="center" style="padding:4px 16px 12px;">
          <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.28em;color:${B.primary};font-variant-numeric:tabular-nums;">${escapeHtml(code)}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 16px 16px;">
          ${secondaryButtonHtml(copyUrl, "Copiar código")}
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:${B.muted};text-align:center;">El botón abre Bestie, copia el código y te lleva a verificar.</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${B.muted};">El código expira en <strong style="color:${B.body};">10 minutos</strong>. Si no lo ves, revisa spam o promociones.</p>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(verifyUrl, "Ir a verificar")}</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Confirma tu correo",
    bodyHtml,
    footerHtml: defaultSupportFooter(
      "Si no creaste una cuenta en Bestie, puedes ignorar este correo.",
    ),
  });

  const text = [
    greetingText(payload.displayName) + ",",
    "",
    `Tu código de verificación Bestie: ${code}`,
    "",
    "Ingresa los 6 dígitos en la app (expira en 10 minutos).",
    "Si no lo encuentras, revisa spam o promociones.",
    "",
    `Copiar y verificar: ${copyUrl}`,
    `Verificar: ${verifyUrl}`,
    "",
    `Ayuda: ${B.support}`,
  ].join("\n");

  return {
    subject,
    previewText,
    html,
    text,
    replyTo: B.support,
    tags: [
      { name: "category", value: "email_verification" },
      { name: "product", value: "bestie" },
    ],
  };
}

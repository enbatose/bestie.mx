import { publicBaseUrl } from "../publicBaseUrl.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  primaryButtonHtml,
  renderEmailShell,
  defaultSupportFooter,
} from "./emailLayout.js";

export function passwordResetEmailSubject(): string {
  return "Bestie · restablecer contraseña";
}

export type PasswordResetEmailPayload = {
  resetUrl: string;
  displayName?: string;
};

export function buildPasswordResetEmail(payload: PasswordResetEmailPayload): BuiltTransactionalEmail {
  const subject = passwordResetEmailSubject();
  const previewText = "Enlace válido por 1 hora. Si no fuiste tú, ignora este correo.";
  const resetUrl = payload.resetUrl;
  const greeting = greetingHtml(payload.displayName);
  const B = EMAIL_BRAND;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greeting},</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:${B.muted};">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el botón para elegir una contraseña nueva en tu perfil.</p>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(resetUrl, "Restablecer contraseña")}</p>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${B.muted};">El enlace expira en <strong style="color:${B.body};">1 hora</strong> y solo puede usarse una vez. Si no lo ves, revisa spam o promociones.</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94A3B8;word-break:break-all;">Enlace directo:<br/><a href="${escapeHtml(resetUrl)}" style="color:${B.primary};">${escapeHtml(resetUrl)}</a></p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Recuperar contraseña",
    bodyHtml,
    footerHtml: defaultSupportFooter(
      "Si no solicitaste este cambio, ignora este correo. Tu contraseña no se modifica sola.",
    ),
  });

  const text = [
    greetingText(payload.displayName) + ",",
    "",
    "Restablece tu contraseña de Bestie con este enlace (expira en 1 hora):",
    resetUrl,
    "",
    "Si no solicitaste este cambio, ignora este correo.",
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
      { name: "category", value: "password_reset" },
      { name: "product", value: "bestie" },
    ],
  };
}

export function passwordResetUrl(token: string): string {
  return `${publicBaseUrl()}/perfil/editar?reset=${encodeURIComponent(token)}`;
}

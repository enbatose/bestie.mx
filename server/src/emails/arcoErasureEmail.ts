import { publicBaseUrl } from "../publicBaseUrl.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  renderEmailShell,
  textLinkHtml,
  defaultSupportFooter,
} from "./emailLayout.js";

export type ArcoErasureEmailPayload = {
  displayName?: string;
};

/**
 * Bestie inbox copy of ARCO confirmations (Resend receiving for contacto@).
 * Kept as BCC evidence of fulfillment — not marketing, and not Gmail-forwarded
 * (inbound skip when From is @bestie.mx).
 */
export const ARCO_CONFIRMATION_BCC = "contacto@bestie.mx";

export function buildArcoWhatsAppConfirmation(displayName?: string): string {
  const name = displayName?.trim().split(/\s+/)[0];
  const hello = name ? `Hola ${name}` : "Hola";
  return (
    `${hello}, confirmamos que ya eliminamos tu cuenta, tu publicación y los datos personales ` +
    `asociados, conforme a tu solicitud ARCO prevista en la LFPDPPP (Ley Federal de Protección de ` +
    `Datos Personales en Posesión de los Particulares). Si más adelante buscas roomie otra vez, ` +
    `con gusto te recibimos: solo crea una cuenta nueva, siempre es gratis. ¡Éxito con tu nuevo hogar!`
  );
}

/** Compact SMS for phone-only accounts (no email). Keep well under 3 segments. */
export function buildArcoSmsConfirmation(): string {
  return (
    "Bestie: tu solicitud ARCO (cancelacion de datos, LFPDPPP) ya fue atendida. " +
    "Eliminamos tu cuenta y datos personales. Si buscas roomie otra vez, crea una cuenta nueva en bestie.mx (gratis)."
  );
}

export function buildArcoErasureEmail(payload: ArcoErasureEmailPayload): BuiltTransactionalEmail {
  const B = EMAIL_BRAND;
  const base = publicBaseUrl();
  const privacyUrl = `${base}/legal/privacidad#eliminacion-de-datos`;
  const homeUrl = `${base}/`;
  const greeting = greetingHtml(payload.displayName);
  const subject = "Tu solicitud ARCO fue atendida · Bestie";
  const previewText = "Confirmamos la cancelación de tus datos personales en Bestie.";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greeting},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:${B.muted};">
      Atendimos tu solicitud de <strong style="color:${B.body};">cancelación de datos personales</strong>
      (derecho ARCO: Acceso, Rectificación, Cancelación y Oposición) prevista en la
      <strong style="color:${B.body};">Ley Federal de Protección de Datos Personales en Posesión de los Particulares</strong>
      (LFPDPPP), su Reglamento y nuestro
      ${textLinkHtml(privacyUrl, "Aviso de Privacidad")}.
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:${B.body};font-weight:600;">Qué se eliminó</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:${B.muted};">
      Tu cuenta de Bestie, tus anuncios y fotografías, tus datos de perfil (nombre, correo, teléfono y foto),
      búsquedas guardadas, mensajes que enviaste y el resto de los datos personales asociados a esa cuenta.
      La cuenta ya no existe y no podrás iniciar sesión con ella.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:${B.muted};">
      Conservamos un registro interno <em>bloqueado</em> de que procesamos esta solicitud
      (sin tu correo ni teléfono en claro) y una copia de este mismo correo en
      ${escapeHtml(ARCO_CONFIRMATION_BCC)}, únicamente para acreditar que te respondimos.
      Copias de respaldo de la base de datos se eliminan al rotar, en un plazo máximo de unas ocho semanas.
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${B.muted};">
      Siempre nos da gusto tenerte de vuelta. Si más adelante buscas roomie otra vez, crea una cuenta nueva
      en ${textLinkHtml(homeUrl, "bestie.mx")} — publicar sigue siendo gratis.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.55;color:${B.body};">Un abrazo,<br/>El equipo Bestie</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Solicitud ARCO atendida",
    bodyHtml,
    footerHtml: defaultSupportFooter(
      `Más detalle en ${escapeHtml(privacyUrl)}`,
    ),
  });

  const text = [
    greetingText(payload.displayName) + ",",
    "",
    "Atendimos tu solicitud de cancelación de datos personales (derecho ARCO: Acceso, Rectificación, Cancelación y Oposición) prevista en la LFPDPPP y en nuestro Aviso de Privacidad.",
    "",
    "Qué se eliminó: tu cuenta de Bestie, anuncios y fotografías, datos de perfil, búsquedas guardadas, mensajes que enviaste y el resto de los datos personales asociados. La cuenta ya no existe.",
    "",
    "Conservamos un registro interno bloqueado de que procesamos esta solicitud (sin tu correo ni teléfono en claro) y una copia de este mismo correo en contacto@bestie.mx, únicamente para acreditar que te respondimos. Los respaldos rotan en un plazo máximo de unas ocho semanas.",
    "",
    "Siempre nos da gusto tenerte de vuelta. Si más adelante buscas roomie otra vez, crea una cuenta nueva en bestie.mx — publicar sigue siendo gratis.",
    "",
    `Aviso de Privacidad: ${privacyUrl}`,
    "",
    "Un abrazo,",
    "El equipo Bestie",
  ].join("\n");

  return {
    subject,
    previewText,
    html,
    text,
    tags: [
      { name: "category", value: "arco_erasure" },
      { name: "app", value: "bestie" },
    ],
  };
}

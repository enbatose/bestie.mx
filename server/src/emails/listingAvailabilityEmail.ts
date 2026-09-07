import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  primaryButtonHtml,
  renderEmailShell,
  secondaryButtonHtml,
} from "./emailLayout.js";

export type ListingAvailabilityEmailPayload = {
  title: string;
  city: string;
  neighborhood: string;
  publisherName: string | null;
  confirmUrl: string;
  pauseUrl: string;
};

export function buildListingAvailabilityEmail(
  payload: ListingAvailabilityEmailPayload,
): BuiltTransactionalEmail {
  const title = payload.title.trim() || "Anuncio sin título";
  const place = [payload.neighborhood, payload.city].filter((s) => s.trim()).join(" · ") || "Sin ubicación";
  const subject = `Tu anuncio cumple 30 días · ${title}`.slice(0, 90);
  const previewText = `Confirma que sigue disponible o lo pausamos en 5 días.`;
  const B = EMAIL_BRAND;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greetingHtml(payload.publisherName ?? undefined)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${B.body};">Tu anuncio lleva 25 días publicado en Bestie. Confirma que sigue disponible. Si no lo confirmas, lo pausamos en 5 días. Puedes reanudarlo cuando quieras.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;line-height:1.35;color:${B.body};">${escapeHtml(title)}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:${B.muted};">${escapeHtml(place)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(payload.confirmUrl, "Sigue disponible")}</p>
    <p style="margin:12px 0 0;text-align:center;">${secondaryButtonHtml(payload.pauseUrl, "Pausar anuncio")}</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Confirma tu anuncio",
    bodyHtml,
  });

  const text = [
    greetingText(payload.publisherName ?? undefined),
    "",
    "Tu anuncio lleva 25 días publicado en Bestie. Confirma que sigue disponible. Si no lo confirmas, lo pausamos en 5 días. Puedes reanudarlo cuando quieras.",
    "",
    title,
    place,
    "",
    `Sigue disponible: ${payload.confirmUrl}`,
    `Pausar anuncio: ${payload.pauseUrl}`,
  ].join("\n");

  return {
    subject,
    previewText,
    html,
    text,
    replyTo: B.support,
    tags: [
      { name: "category", value: "listing_availability" },
      { name: "product", value: "bestie" },
    ],
  };
}

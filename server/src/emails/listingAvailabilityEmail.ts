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
  /** Public listing page — title card opens this. */
  listingUrl: string;
  /** GET shows the confirm form; does not mark the post free by itself. */
  confirmUrl: string;
  /** GET shows the rented form; does not mark the post rented by itself. */
  rentedUrl: string;
};

export function buildListingAvailabilityEmail(
  payload: ListingAvailabilityEmailPayload,
): BuiltTransactionalEmail {
  const title = payload.title.trim() || "Anuncio sin título";
  const place = [payload.neighborhood, payload.city].filter((s) => s.trim()).join(" · ") || "Sin ubicación";
  const subject = `¿Sigue libre? · ${title}`.slice(0, 90);
  const previewText = `Di si sigue libre o ya se rentó. Si no respondes, lo ocultamos en 5 días.`;
  const B = EMAIL_BRAND;

  const listingHref = escapeHtml(payload.listingUrl);
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greetingHtml(payload.publisherName ?? undefined)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${B.body};">Tu anuncio lleva 25 días publicado en Bestie. Di si sigue libre o ya se rentó. Si no respondes, lo ocultamos en 5 días. Puedes volver a publicarlo cuando quieras.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
      <tr>
        <td style="padding:0;">
          <a href="${listingHref}" style="display:block;padding:14px 16px;text-decoration:none;color:${B.body};">
            <span style="display:block;margin:0 0 8px;font-size:16px;font-weight:700;line-height:1.35;color:${B.body};">${escapeHtml(title)}</span>
            <span style="display:block;font-size:13px;line-height:1.5;color:${B.muted};">${escapeHtml(place)}</span>
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(payload.confirmUrl, "Sigue libre")}</p>
    <p style="margin:10px 0 0;text-align:center;">${secondaryButtonHtml(payload.rentedUrl, "Ya se rentó")}</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Confirma tu anuncio",
    bodyHtml,
  });

  const text = [
    greetingText(payload.publisherName ?? undefined),
    "",
    "Tu anuncio lleva 25 días publicado en Bestie. Di si sigue libre o ya se rentó. Si no respondes, lo ocultamos en 5 días.",
    "",
    title,
    place,
    `Ver anuncio: ${payload.listingUrl}`,
    "",
    `Sigue libre: ${payload.confirmUrl}`,
    `Ya se rentó: ${payload.rentedUrl}`,
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

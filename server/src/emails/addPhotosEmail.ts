import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  greetingHtml,
  greetingText,
  primaryButtonHtml,
  renderEmailShell,
} from "./emailLayout.js";

export type AddPhotosEmailPayload = {
  publisherName: string | null;
  title: string;
  /** Opens the publish preview with the photo editor expanded. */
  editPhotosUrl: string;
  listingUrl: string;
};

/** Nudge after publishing without a gallery — more photos → more seekers writing. */
export function buildAddPhotosEmail(payload: AddPhotosEmailPayload): BuiltTransactionalEmail {
  const title = payload.title.trim() || "tu anuncio";
  const subject = `Sube fotos a tu anuncio · más personas te escriben`.slice(0, 90);
  const previewText = `Los anuncios con fotos reciben más mensajes. Toma 2 minutos y súbelas.`;
  const B = EMAIL_BRAND;
  const editHref = escapeHtml(payload.editPhotosUrl);
  const listingHref = escapeHtml(payload.listingUrl);

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">${greetingHtml(payload.publisherName ?? undefined)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${B.body};">Tu anuncio <strong>${escapeHtml(title)}</strong> ya está publicado en Bestie, pero aún no tiene fotos. Los seekers casi siempre abren primero los que sí muestran el cuarto — con fotos te escriben más y más rápido.</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${B.body};">Toma un par de minutos: sube fotos del cuarto, el baño y las áreas comunes. Puedes editarlas cuando quieras.</p>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(editHref, "Subir fotos ahora")}</p>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${B.muted};text-align:center;">
      <a href="${listingHref}" style="color:${B.muted};">Ver cómo se ve tu anuncio</a>
    </p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Completa tu anuncio",
    bodyHtml,
  });

  const text = [
    greetingText(payload.publisherName ?? undefined),
    "",
    `Tu anuncio "${title}" ya está publicado en Bestie, pero aún no tiene fotos. Con fotos te escriben más.`,
    "",
    `Subir fotos: ${payload.editPhotosUrl}`,
    `Ver anuncio: ${payload.listingUrl}`,
  ].join("\n");

  return { subject, html, text, previewText };
}

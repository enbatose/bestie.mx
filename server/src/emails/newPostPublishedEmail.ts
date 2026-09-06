import { publicBaseUrl } from "../publicBaseUrl.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  primaryButtonHtml,
  renderEmailShell,
  secondaryButtonHtml,
  textLinkHtml,
} from "./emailLayout.js";

export type NewPostPublishedEmailPayload = {
  title: string;
  city: string;
  neighborhood: string;
  postUrl: string;
  replayUrl: string | null;
  publisherName: string | null;
  publisherEmail: string | null;
  shortId: string;
};

export function buildNewPostPublishedEmail(payload: NewPostPublishedEmailPayload): BuiltTransactionalEmail {
  const title = payload.title.trim() || "Anuncio sin título";
  const place = [payload.neighborhood, payload.city].filter((s) => s.trim()).join(" · ") || "Sin ubicación";
  const subject = `Nuevo anuncio publicado · ${title}`.slice(0, 90);
  const previewText = `${title} · ${place}`;
  const B = EMAIL_BRAND;
  const publisher =
    payload.publisherName?.trim() || payload.publisherEmail?.trim()
      ? [payload.publisherName?.trim(), payload.publisherEmail?.trim()].filter(Boolean).join(" · ")
      : "Invitado (sin cuenta)";

  const replayBlock = payload.replayUrl
    ? `<p style="margin:16px 0 0;text-align:center;">${secondaryButtonHtml(payload.replayUrl, "Ver replay de PostHog")}</p>
       <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${B.muted};word-break:break-all;">Replay: ${textLinkHtml(payload.replayUrl, payload.replayUrl)}</p>`
    : `<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:${B.muted};">No hay replay de PostHog para esta publicación (sesión no capturada; habitual en Dev).</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">Se publicó un anuncio nuevo en Bestie.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${B.muted};">${escapeHtml(payload.shortId)}</p>
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;line-height:1.35;color:${B.body};">${escapeHtml(title)}</p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${B.muted};">${escapeHtml(place)}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:${B.muted};">Publicó: ${escapeHtml(publisher)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;text-align:center;">${primaryButtonHtml(payload.postUrl, "Ver anuncio")}</p>
    ${replayBlock}
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Nuevo anuncio publicado",
    bodyHtml,
    footerHtml: `<p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">Aviso interno de Bestie · ${escapeHtml(publicBaseUrl())}</p>`,
  });

  const text = [
    "Se publicó un anuncio nuevo en Bestie.",
    "",
    `${payload.shortId} · ${title}`,
    place,
    `Publicó: ${publisher}`,
    "",
    `Anuncio: ${payload.postUrl}`,
    payload.replayUrl ? `Replay PostHog: ${payload.replayUrl}` : "Replay PostHog: no disponible",
  ].join("\n");

  return {
    subject,
    previewText,
    html,
    text,
    replyTo: B.support,
    tags: [
      { name: "category", value: "new_post_alert" },
      { name: "product", value: "bestie" },
    ],
  };
}

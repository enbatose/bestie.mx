import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  primaryButtonHtml,
  renderEmailShell,
  textLinkHtml,
} from "./emailLayout.js";

export const POST_REPORT_OPS_EMAIL = "contacto@bestie.mx";

export type PostReportEmailPayload = {
  reportCount: number;
  targetType: string;
  shortId: string | null;
  postUrl: string | null;
  adminUrl: string;
  categories: readonly string[];
  detailText: string | null;
  reporterLabel: string;
};

export function buildPostReportEmail(payload: PostReportEmailPayload): BuiltTransactionalEmail {
  const typeLabel =
    payload.targetType === "chat"
      ? "Conversación"
      : payload.targetType === "property"
        ? "Propiedad"
        : "Recámara";
  const subject = `Reporte de ${typeLabel.toLowerCase()} · ${payload.shortId ?? "chat"} (#${payload.reportCount})`.slice(
    0,
    90,
  );
  const previewText = `${payload.reporterLabel} · ${payload.categories.join(", ") || "Sin categoría"}`;
  const B = EMAIL_BRAND;

  const postBlock = payload.postUrl
    ? `<p style="margin:0;text-align:center;">${primaryButtonHtml(payload.postUrl, "Ver anuncio")}</p>`
    : `<p style="margin:0;font-size:13px;color:${B.muted};">Reporte de conversación privada (sin URL pública).</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${B.body};">Se recibió un reporte en Bestie.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${B.border};border-radius:12px;background:${B.bgLight};">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${B.muted};">Motivos: ${escapeHtml(payload.categories.join(", ") || "—")}</p>
          ${payload.detailText?.trim() ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${B.muted};">Detalle: ${escapeHtml(payload.detailText.trim())}</p>` : ""}
          <hr style="border:none;border-top:1px solid ${B.border};margin:0 0 12px;" />
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${B.muted};">${escapeHtml(typeLabel)} · ${escapeHtml(payload.shortId ?? "—")} · #${payload.reportCount}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:${B.muted};">Reportador: ${escapeHtml(payload.reporterLabel)}</p>
        </td>
      </tr>
    </table>
    ${postBlock}
    <p style="margin:16px 0 0;text-align:center;">${primaryButtonHtml(payload.adminUrl, "Abrir en admin")}</p>
    <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${B.muted};word-break:break-all;">Admin: ${textLinkHtml(payload.adminUrl, payload.adminUrl)}</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Nuevo reporte",
    bodyHtml,
  });

  const text = [
    "Se recibió un reporte en Bestie.",
    `Motivos: ${payload.categories.join(", ") || "—"}`,
    payload.detailText?.trim() ? `Detalle: ${payload.detailText.trim()}` : null,
    "————————————",
    `${typeLabel} · ${payload.shortId ?? "chat"} · reporte #${payload.reportCount}`,
    `Reportador: ${payload.reporterLabel}`,
    payload.postUrl ? `Anuncio: ${payload.postUrl}` : null,
    `Admin: ${payload.adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text, previewText };
}

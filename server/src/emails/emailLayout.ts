/**
 * Shared Bestie transactional email chrome.
 * Tokens mirror `tailwind.config.ts` (primary / secondary / surface / body / muted / border).
 * Table layout + inline CSS only — email clients do not support flex/grid/Tailwind.
 */

export const EMAIL_BRAND = {
  primary: "#143D30",
  primaryFg: "#FFFFFF",
  secondary: "#84CC16",
  accent: "#6EE7B7",
  body: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  bgLight: "#F8FAFC",
  surfaceElevated: "#F1F5F9",
  support: "contacto@bestie.mx",
  productName: "Bestie",
  /** Absolute logo for clients that load remote images (optional). */
  logoUrl: "https://www.bestie.mx/brand/logo-lockup-on-dark.svg",
} as const;

export type BuiltTransactionalEmail = {
  subject: string;
  /** Inbox snippet shown next to/under the subject before open. */
  previewText: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function greetingHtml(displayName?: string): string {
  const name = displayName?.trim();
  return name ? `Hola, ${escapeHtml(name)}` : "Hola";
}

export function greetingText(displayName?: string): string {
  const name = displayName?.trim();
  return name ? `Hola, ${name}` : "Hola";
}

/** Hidden preheader — most clients use this as the inbox preview line. */
function preheaderHtml(previewText: string): string {
  const safe = escapeHtml(previewText);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${safe}</div>`;
}

export function primaryButtonHtml(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;background:${EMAIL_BRAND.primary};color:${EMAIL_BRAND.primaryFg};font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>`;
}

export function secondaryButtonHtml(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:${EMAIL_BRAND.surface};color:${EMAIL_BRAND.primary};font-size:13px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:999px;border:2px solid ${EMAIL_BRAND.primary};">${escapeHtml(label)}</a>`;
}

export function textLinkHtml(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${EMAIL_BRAND.primary};font-weight:600;text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/**
 * Full HTML shell: forest header, optional lime accent bar, body slot, support footer.
 */
export function renderEmailShell(opts: {
  previewText: string;
  headerEyebrow: string;
  bodyHtml: string;
  footerHtml?: string;
  maxWidthPx?: number;
}): string {
  const width = opts.maxWidthPx ?? 480;
  const B = EMAIL_BRAND;
  const footer =
    opts.footerHtml ??
    `<p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">¿Necesitas ayuda? <a href="mailto:${B.support}" style="color:${B.muted};">${B.support}</a></p>`;

  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(B.productName)}</title>
</head>
<body style="margin:0;padding:0;background:${B.bgLight};font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  ${preheaderHtml(opts.previewText)}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${B.bgLight};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${width}px;background:${B.surface};border-radius:16px;border:1px solid ${B.border};overflow:hidden;">
        <tr>
          <td style="padding:22px 24px 14px;background:${B.primary};">
            <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${B.primaryFg};">${B.productName}</p>
            <p style="margin:8px 0 0;font-size:14px;font-weight:500;line-height:1.35;color:${B.accent};">${escapeHtml(opts.headerEyebrow)}</p>
          </td>
        </tr>
        <tr>
          <td style="height:4px;line-height:4px;font-size:0;background:${B.secondary};">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px;border-top:1px solid ${B.border};background:${B.surfaceElevated};">
            ${footer}
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;line-height:1.45;color:#94A3B8;text-align:center;">bestie.mx · roomies en México</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function defaultSupportFooter(extraLineHtml?: string): string {
  const B = EMAIL_BRAND;
  const extra = extraLineHtml
    ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${B.muted};text-align:center;">${extraLineHtml}</p>`
    : "";
  return `${extra}<p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">¿Necesitas ayuda? <a href="mailto:${B.support}" style="color:${B.muted};">${B.support}</a></p>`;
}

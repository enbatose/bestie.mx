import { EMAIL_BRAND } from "./emails/emailLayout.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(opts: { title: string; bodyHtml: string }): string {
  const B = EMAIL_BRAND;
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>${escapeHtml(opts.title)} · bestie.mx</title>
</head>
<body style="margin:0;padding:24px 16px;background:${B.bgLight};font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${B.body};">
  <main style="max-width:440px;margin:0 auto;background:${B.surface};border:1px solid ${B.border};border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px 16px;background:${B.primary};">
      <p style="margin:0;font-size:18px;font-weight:700;color:${B.primaryFg};">bestie.mx</p>
      <p style="margin:8px 0 0;font-size:14px;color:${B.accent};">${escapeHtml(opts.title)}</p>
    </div>
    <div style="height:4px;background:${B.secondary};"></div>
    <div style="padding:24px;">
      ${opts.bodyHtml}
    </div>
  </main>
</body>
</html>`;
}

export function availabilityPromptPage(opts: {
  action: "confirm" | "pause";
  title: string;
  place: string;
  formAction: string;
}): string {
  const title = opts.title.trim() || "Anuncio sin título";
  const place = opts.place.trim();
  const heading = opts.action === "confirm" ? "Confirma tu anuncio" : "Pausar anuncio";
  const lead =
    opts.action === "confirm"
      ? "Confirma que este anuncio sigue disponible. Si no lo confirmas, lo pausamos a los 30 días. Puedes reanudarlo cuando quieras."
      : "Este anuncio dejará de aparecer en la búsqueda. Puedes reanudarlo cuando quieras desde Mis Anuncios.";
  const button = opts.action === "confirm" ? "Sigue disponible" : "Pausar anuncio";
  const buttonBg = opts.action === "confirm" ? EMAIL_BRAND.primary : EMAIL_BRAND.surface;
  const buttonColor = opts.action === "confirm" ? EMAIL_BRAND.primaryFg : EMAIL_BRAND.primary;
  const buttonBorder = opts.action === "confirm" ? EMAIL_BRAND.primary : EMAIL_BRAND.primary;
  return page({
    title: heading,
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.35;">${escapeHtml(title)}</p>
      ${place ? `<p style="margin:0 0 16px;font-size:13px;color:${EMAIL_BRAND.muted};">${escapeHtml(place)}</p>` : ""}
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">${escapeHtml(lead)}</p>
      <form method="post" action="${escapeHtml(opts.formAction)}">
        <button type="submit" style="display:block;width:100%;min-height:44px;border:2px solid ${buttonBorder};border-radius:999px;background:${buttonBg};color:${buttonColor};font-size:15px;font-weight:700;cursor:pointer;">${escapeHtml(button)}</button>
      </form>
    `,
  });
}

export function availabilityResultPage(opts: {
  outcome: "confirmed" | "paused" | "already_paused" | "already_confirmed" | "invalid";
  title?: string;
}): string {
  const post = opts.title?.trim() || "este anuncio";
  const copy: Record<typeof opts.outcome, { heading: string; body: string }> = {
    confirmed: {
      heading: "Sigue disponible",
      body: `Confirmamos que “${post}” sigue disponible. Volveremos a pedirte confirmación en 25 días.`,
    },
    paused: {
      heading: "Anuncio pausado",
      body: `Pausamos “${post}”. Ya no aparece en la búsqueda. Puedes reanudarlo cuando quieras desde Mis Anuncios.`,
    },
    already_paused: {
      heading: "Ya está pausado",
      body: `“${post}” ya está pausado. Entra a Mis Anuncios para reanudarlo cuando quieras.`,
    },
    already_confirmed: {
      heading: "Sigue disponible",
      body: `“${post}” ya está confirmado como disponible.`,
    },
    invalid: {
      heading: "Enlace no válido",
      body: "Este enlace ya no sirve. Entra a Mis Anuncios para confirmar o pausar el anuncio.",
    },
  };
  const item = copy[opts.outcome];
  return page({
    title: item.heading,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.55;">${escapeHtml(item.body)}</p>`,
  });
}

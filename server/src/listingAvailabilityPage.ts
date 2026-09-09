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

function button(opts: { label: string; intent: "confirm" | "rented"; roomId?: string; primary: boolean }): string {
  const bg = opts.primary ? EMAIL_BRAND.primary : EMAIL_BRAND.surface;
  const color = opts.primary ? EMAIL_BRAND.primaryFg : EMAIL_BRAND.primary;
  const room = opts.roomId
    ? `<input type="hidden" name="roomId" value="${escapeHtml(opts.roomId)}"/>`
    : "";
  return `<form method="post" action="" style="margin:0;">
    <input type="hidden" name="intent" value="${opts.intent}"/>
    ${room}
    <button type="submit" style="display:block;width:100%;min-height:44px;border:2px solid ${EMAIL_BRAND.primary};border-radius:999px;background:${bg};color:${color};font-size:15px;font-weight:700;cursor:pointer;">${escapeHtml(opts.label)}</button>
  </form>`;
}

export type AvailabilityRoomChoice = { id: string; label: string };

export function availabilityPromptPage(opts: {
  title: string;
  place: string;
  rooms: AvailabilityRoomChoice[];
  claimUrl: string | null;
}): string {
  const title = opts.title.trim() || "Anuncio sin título";
  const place = opts.place.trim();
  const rooms = opts.rooms.length > 0 ? opts.rooms : [{ id: "", label: title }];
  const multi = rooms.length > 1;
  const lead = multi
    ? "Responde por cada recámara que sigue publicada. Si no respondes, la ocultamos en 5 días."
    : "Si no respondes, este anuncio se oculta en 5 días. Puedes volver a publicarlo cuando quieras.";
  const roomBlocks = rooms
    .map((room) => {
      const label = multi ? `<p style="margin:0 0 8px;font-size:14px;font-weight:700;">${escapeHtml(room.label)}</p>` : "";
      return `<div style="margin:0 0 16px;">
        ${label}
        ${button({ label: "Sigue libre", intent: "confirm", roomId: room.id || undefined, primary: true })}
        <div style="height:8px;"></div>
        ${button({ label: "Ya se rentó", intent: "rented", roomId: room.id || undefined, primary: false })}
      </div>`;
    })
    .join("");
  return page({
    title: "¿Sigue libre?",
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.35;">${escapeHtml(title)}</p>
      ${place ? `<p style="margin:0 0 12px;font-size:13px;color:${EMAIL_BRAND.muted};">${escapeHtml(place)}</p>` : ""}
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">${escapeHtml(lead)}</p>
      ${roomBlocks}
    `,
  });
}

/**
 * Email already chose Sigue libre or Ya se rentó. This page records that choice
 * and does not ask again. GET does not change the listing; the form posts immediately.
 */
export function availabilityEmailApplyPage(opts: { intent: "confirm" | "rented" }): string {
  const heading = opts.intent === "confirm" ? "Sigue libre" : "Ya se rentó";
  const B = EMAIL_BRAND;
  return page({
    title: heading,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Anotando tu respuesta…</p>
      <form id="bestie-email-choice" method="post" action="">
        <input type="hidden" name="intent" value="${opts.intent}"/>
        <input type="hidden" name="source" value="email"/>
        <noscript>
          <button type="submit" style="display:block;width:100%;min-height:44px;border:2px solid ${B.primary};border-radius:999px;background:${B.primary};color:${B.primaryFg};font-size:15px;font-weight:700;cursor:pointer;">${escapeHtml(heading)}</button>
        </noscript>
      </form>
      <script>document.getElementById("bestie-email-choice").submit();</script>
    `,
  });
}

export function availabilityResultPage(opts: {
  outcome: "confirmed" | "rented" | "paused" | "already_paused" | "already_confirmed" | "invalid";
  title?: string;
  claimUrl?: string | null;
}): string {
  const post = opts.title?.trim() || "este anuncio";
  const copy: Record<typeof opts.outcome, { heading: string; body: string }> = {
    confirmed: {
      heading: "Sigue libre",
      body: `Anotamos que “${post}” sigue libre. Volveremos a preguntarte en 25 días.`,
    },
    rented: {
      heading: "Ya se rentó",
      body: `Marcamos “${post}” como rentado. No vuelve a la búsqueda hasta que lo publiques de nuevo como libre.`,
    },
    paused: {
      heading: "Anuncio oculto",
      body: `Ocultamos “${post}”. Puedes volver a publicarlo desde Mis Anuncios cuando quieras.`,
    },
    already_paused: {
      heading: "Ya está oculto",
      body: `“${post}” ya no está publicado. Entra a Mis Anuncios si quieres ofrecerlo de nuevo.`,
    },
    already_confirmed: {
      heading: "Sigue libre",
      body: `“${post}” ya está confirmado como libre.`,
    },
    invalid: {
      heading: "Enlace no válido",
      body: "Este enlace ya no sirve. Entra a Mis Anuncios para confirmar el anuncio.",
    },
  };
  const item = copy[opts.outcome];
  const claim =
    opts.claimUrl && (opts.outcome === "confirmed" || opts.outcome === "rented")
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.55;">Guárdalo en Mis Anuncios con este celular.</p>
         <p style="margin:12px 0 0;"><a href="${escapeHtml(opts.claimUrl)}" style="display:block;text-align:center;min-height:44px;line-height:44px;border-radius:999px;background:${EMAIL_BRAND.primary};color:${EMAIL_BRAND.primaryFg};font-size:15px;font-weight:700;text-decoration:none;">Guardar en Mis Anuncios</a></p>`
      : "";
  return page({
    title: item.heading,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.55;">${escapeHtml(item.body)}</p>${claim}`,
  });
}

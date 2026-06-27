import { roomReferenceCode } from "../listingReference.js";
import { publicBaseUrl } from "../publicBaseUrl.js";
import type { PropertyListing } from "../types.js";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** Icon legend for email (text labels — clients do not render Lucide). */
export const EMAIL_ATTRIBUTE_LEGEND: { label: string; tooltip: string }[] = [
  { label: "Casa", tooltip: "Propiedad tipo casa" },
  { label: "Depa", tooltip: "Propiedad tipo departamento" },
  { label: "Loft", tooltip: "Propiedad tipo loft" },
  { label: "Privado", tooltip: "Cuarto privado" },
  { label: "Compartido", tooltip: "Cuarto compartido" },
  { label: "Mujer", tooltip: "Prefieren roomie mujer" },
  { label: "Hombre", tooltip: "Prefieren roomie hombre" },
  { label: "Baño privado", tooltip: "Baño privado en la recámara" },
  { label: "Estacionamiento", tooltip: "Estacionamiento privado" },
  { label: "Amueblado", tooltip: "Recámara amueblada" },
  { label: "Mascotas", tooltip: "Se permiten mascotas" },
  { label: "Wi‑Fi", tooltip: "Wi‑Fi incluido" },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listingTitle(listing: PropertyListing): string {
  const t = listing.title?.trim();
  if (t) return t;
  return listing.propertyTitle?.trim() || "Anuncio";
}

function listingSubtitle(listing: PropertyListing): string {
  const parts = [listing.neighborhood, listing.city].filter(Boolean);
  return parts.join(" · ");
}

function listingCoverPath(listing: PropertyListing): string | null {
  const urls = [
    ...(listing.roomImageUrls ?? []),
    ...(listing.propertyImageUrls ?? []),
  ];
  for (const raw of urls) {
    const t = raw.trim();
    if (t.startsWith("/api/uploads/")) return t;
    if (t.startsWith("http")) {
      try {
        const p = new URL(t).pathname;
        if (p.startsWith("/api/uploads/")) return p;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function listingAttributeLabels(listing: PropertyListing): string[] {
  const labels: string[] = [];
  if (listing.propertyKind === "house") labels.push("Casa");
  else if (listing.propertyKind === "apartment") labels.push("Depa");
  else if (listing.propertyKind === "loft") labels.push("Loft");
  if (listing.lodgingType === "private_room") labels.push("Privado");
  else if (listing.lodgingType === "shared_room") labels.push("Compartido");
  if (listing.roommateGenderPref === "female") labels.push("Mujer");
  else if (listing.roommateGenderPref === "male") labels.push("Hombre");
  if (listing.tags.includes("baño-privado")) labels.push("Baño privado");
  if (listing.tags.includes("estacionamiento")) labels.push("Estacionamiento");
  if (listing.tags.includes("muebles")) labels.push("Amueblado");
  if (listing.tags.includes("mascotas")) labels.push("Mascotas");
  if (listing.tags.includes("wifi")) labels.push("Wi‑Fi");
  return labels.slice(0, 6);
}

function formatPublishedDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function listingCardHtml(
  base: string,
  listing: PropertyListing,
  opts?: { isNew?: boolean },
): string {
  const title = escapeHtml(listingTitle(listing));
  const subtitle = escapeHtml(listingSubtitle(listing));
  const rent = escapeHtml(money.format(listing.rentMxn));
  const summary = escapeHtml((listing.summary ?? "").slice(0, 160));
  const href = `${base}/anuncio/${encodeURIComponent(roomReferenceCode(listing.id))}`;
  const cover = listingCoverPath(listing);
  const thumb = cover
    ? `<img src="${escapeHtml(base + cover)}" alt="" width="72" height="72" style="border-radius:8px;object-fit:cover;display:block;" />`
    : `<div style="width:72px;height:72px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;"></div>`;
  const badges = listingAttributeLabels(listing)
    .map(
      (l) =>
        `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;font-size:11px;font-weight:600;border-radius:999px;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;">${escapeHtml(l)}</span>`,
    )
    .join("");
  const newBadge = opts?.isNew
    ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#059669;">Nuevo · publicado ${escapeHtml(formatPublishedDate(listing.createdAt ?? listing.updatedAt))}</p>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
  <tr>
    <td style="padding:12px;">
      ${newBadge}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="72" valign="top">${thumb}</td>
          <td style="padding-left:12px;" valign="top">
            <p style="margin:0;font-size:15px;font-weight:700;color:#1e3a5f;">${title}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${subtitle}</p>
            <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#111827;">${rent}<span style="font-size:11px;font-weight:400;color:#6b7280;"> / mes</span></p>
            <p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:#6b7280;">${summary}</p>
            ${badges ? `<div style="margin-top:8px;">${badges}</div>` : ""}
            <p style="margin:10px 0 0;"><a href="${href}" style="font-size:13px;font-weight:600;color:#2563eb;text-decoration:none;">Ver anuncio →</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function legendHtml(): string {
  const cells = EMAIL_ATTRIBUTE_LEGEND.map(
    (item) =>
      `<td style="padding:4px 8px;font-size:11px;color:#374151;vertical-align:top;"><strong>${escapeHtml(item.label)}</strong><br/><span style="color:#6b7280;">${escapeHtml(item.tooltip)}</span></td>`,
  );
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;"><tr>${cells.join("")}</tr></table>`;
}

export type SavedSearchEmailPayload = {
  label: string;
  searchUrl: string;
  unsubscribeToken: string;
  mode: "initial" | "follow_up";
  newListings: PropertyListing[];
  otherListings: PropertyListing[];
};

export function buildSavedSearchEmail(payload: SavedSearchEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const base = publicBaseUrl();
  const searchLink = payload.searchUrl.startsWith("http")
    ? payload.searchUrl
    : `${base}${payload.searchUrl.startsWith("/") ? "" : "/"}${payload.searchUrl}`;
  const unsubLink = `${base}/api/saved-searches/unsubscribe/${encodeURIComponent(payload.unsubscribeToken)}`;

  const title =
    payload.mode === "initial"
      ? `Resultados para tu búsqueda «${payload.label}»`
      : `Nuevos anuncios para «${payload.label}»`;

  let bodyListings = "";
  if (payload.mode === "initial") {
    const all = [...payload.newListings, ...payload.otherListings];
    bodyListings = all.map((l) => listingCardHtml(base, l)).join("");
  } else {
    if (payload.newListings.length) {
      bodyListings += `<h2 style="font-size:14px;font-weight:700;color:#111827;margin:20px 0 8px;">Nuevos</h2>`;
      bodyListings += payload.newListings.map((l) => listingCardHtml(base, l, { isNew: true })).join("");
    }
    if (payload.otherListings.length) {
      bodyListings += `<h2 style="font-size:14px;font-weight:700;color:#111827;margin:20px 0 8px;">También coinciden con tu búsqueda</h2>`;
      bodyListings += payload.otherListings.map((l) => listingCardHtml(base, l)).join("");
    }
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:24px 24px 12px;background:#1e3a5f;">
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Bestie.mx</p>
          <p style="margin:8px 0 0;font-size:14px;color:#dbeafe;">Alertas de búsqueda guardada</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563;">Estos anuncios coinciden con los filtros que guardaste. Las etiquetas e iconos en la app indican tipo de propiedad, cuarto y preferencias del anunciante.</p>
          ${legendHtml()}
          ${bodyListings || `<p style="font-size:14px;color:#6b7280;">No hay anuncios que coincidan en este momento.</p>`}
          <p style="margin:24px 0 0;text-align:center;"><a href="${escapeHtml(searchLink)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Ver más publicaciones</a></p>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-align:center;"><a href="${escapeHtml(unsubLink)}" style="color:#6b7280;">Dejar de recibir alertas de esta búsqueda</a></p>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">¿Necesitas ayuda? <a href="mailto:support@bestie.mx" style="color:#6b7280;">support@bestie.mx</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = [
    title,
    "",
    payload.mode === "follow_up" && payload.newListings.length
      ? "NUEVOS:"
      : "RESULTADOS:",
    ...payload.newListings.map(
      (l) => `- ${listingTitle(l)} · ${money.format(l.rentMxn)}/mes · ${base}/anuncio/${roomReferenceCode(l.id)}`,
    ),
    ...(payload.otherListings.length ? ["", "TAMBIÉN COINCIDEN:"] : []),
    ...payload.otherListings.map(
      (l) => `- ${listingTitle(l)} · ${money.format(l.rentMxn)}/mes · ${base}/anuncio/${roomReferenceCode(l.id)}`,
    ),
    "",
    `Ver más: ${searchLink}`,
    "",
    `Dejar de recibir alertas: ${unsubLink}`,
  ];

  return { subject: title, html, text: textLines.join("\n") };
}

export function renderUnsubscribeConfirmationHtml(label: string): string {
  const base = publicBaseUrl();
  const safe = escapeHtml(label);
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Alertas desactivadas</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f3f4f6;padding:40px 16px;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e3a5f;">Bestie.mx</p>
    <h1 style="margin:16px 0 8px;font-size:18px;color:#111827;">Alertas desactivadas</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">Ya no recibirás alertas por correo para «${safe}».</p>
    <p style="margin:0;"><a href="${base}/mis-busquedas" style="margin-right:12px;color:#2563eb;font-weight:600;">Mis Búsquedas</a>
    <a href="${base}/buscar" style="color:#2563eb;font-weight:600;">Buscar</a></p>
  </div>
</body></html>`;
}

export function renderUnsubscribeNotFoundHtml(): string {
  const base = publicBaseUrl();
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>Enlace no válido</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f3f4f6;padding:40px 16px;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
    <p style="font-size:14px;color:#4b5563;">Enlace no válido o expirado.</p>
    <p style="margin-top:16px;"><a href="${base}/buscar" style="color:#2563eb;font-weight:600;">Ir a buscar</a></p>
  </div>
</body></html>`;
}

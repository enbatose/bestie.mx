import { roomReferenceCode } from "../listingReference.js";
import { publicBaseUrl } from "../publicBaseUrl.js";
import type { PropertyListing } from "../types.js";
import {
  EMAIL_BRAND,
  type BuiltTransactionalEmail,
  escapeHtml,
  primaryButtonHtml,
  renderEmailShell,
  textLinkHtml,
  defaultSupportFooter,
} from "./emailLayout.js";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** Short attribute chips for email (text only — clients do not render Lucide). */
export const EMAIL_ATTRIBUTE_LEGEND: { label: string; tooltip: string }[] = [
  { label: "Casa", tooltip: "Propiedad tipo casa" },
  { label: "Depa", tooltip: "Propiedad tipo departamento" },
  { label: "Loft", tooltip: "Loft" },
  { label: "Privado", tooltip: "Cuarto Privado" },
  { label: "Compartido", tooltip: "Recámara Compartida" },
  { label: "Mujer", tooltip: "Solo Mujeres" },
  { label: "Hombre", tooltip: "Solo Hombres" },
  { label: "Mixto", tooltip: "Mujer o Hombre" },
  { label: "Baño privado", tooltip: "Baño Privado" },
  { label: "Cochera", tooltip: "Cochera Incluida" },
  { label: "Amueblado", tooltip: "Recámara Amueblada" },
  { label: "Mascotas", tooltip: "Aceptan Mascotas" },
  { label: "LGBT+", tooltip: "LGBT+ Friendly" },
  { label: "Wi‑Fi", tooltip: "Wi‑Fi incluido" },
];

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
  const mode = listing.propertyPostMode === "property" ? "property" : "room";
  const urls =
    mode === "room"
      ? [...(listing.roomImageUrls ?? []), ...(listing.propertyImageUrls ?? [])]
      : [...(listing.propertyImageUrls ?? []), ...(listing.roomImageUrls ?? [])];
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
  else if (listing.roommateGenderPref === "any") labels.push("Mixto");
  if (listing.tags.includes("baño-privado")) labels.push("Baño privado");
  if (listing.tags.includes("estacionamiento")) labels.push("Cochera");
  if (listing.tags.includes("muebles")) labels.push("Amueblado");
  if (listing.tags.includes("mascotas")) labels.push("Mascotas");
  if (listing.tags.includes("lgbt-friendly")) labels.push("LGBT+");
  if (listing.tags.includes("wifi")) labels.push("Wi‑Fi");
  return labels.slice(0, 5);
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
  const B = EMAIL_BRAND;
  const title = escapeHtml(listingTitle(listing));
  const subtitle = escapeHtml(listingSubtitle(listing));
  const rent = escapeHtml(money.format(listing.rentMxn));
  const summary = escapeHtml((listing.summary ?? "").slice(0, 140));
  const href = `${base}/anuncio/${encodeURIComponent(roomReferenceCode(listing.id))}`;
  const cover = listingCoverPath(listing);
  const thumb = cover
    ? `<img src="${escapeHtml(base + cover)}" alt="" width="72" height="72" border="0" style="border-radius:8px;object-fit:cover;display:block;width:72px;height:72px;" />`
    : `<div style="width:72px;height:72px;border-radius:8px;background:${B.surfaceElevated};border:1px solid ${B.border};"></div>`;
  const badges = listingAttributeLabels(listing)
    .map(
      (l) =>
        `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;font-size:11px;font-weight:600;border-radius:999px;background:${B.bgLight};border:1px solid ${B.border};color:${B.body};">${escapeHtml(l)}</span>`,
    )
    .join("");
  const newBadge = opts?.isNew
    ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${B.primary};">Nuevo · publicado ${escapeHtml(formatPublishedDate(listing.createdAt ?? listing.updatedAt))}</p>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;border:1px solid ${B.border};border-radius:12px;background:${B.surface};">
  <tr>
    <td style="padding:12px;">
      ${newBadge}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="72" valign="top">${thumb}</td>
          <td style="padding-left:12px;" valign="top">
            <p style="margin:0;font-size:15px;font-weight:700;color:${B.primary};">${title}</p>
            <p style="margin:4px 0 0;font-size:13px;color:${B.muted};">${subtitle}</p>
            <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:${B.body};">${rent}<span style="font-size:11px;font-weight:400;color:${B.muted};"> / mes</span></p>
            ${summary ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:${B.muted};">${summary}</p>` : ""}
            ${badges ? `<div style="margin-top:8px;">${badges}</div>` : ""}
            <p style="margin:10px 0 0;">${textLinkHtml(href, "Ver anuncio")}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export type SavedSearchEmailPayload = {
  label: string;
  searchUrl: string;
  unsubscribeToken: string;
  mode: "initial" | "follow_up";
  newListings: PropertyListing[];
  otherListings: PropertyListing[];
  similarListings?: PropertyListing[];
};

export function buildSavedSearchEmail(payload: SavedSearchEmailPayload): BuiltTransactionalEmail {
  const base = publicBaseUrl();
  const B = EMAIL_BRAND;
  const searchLink = payload.searchUrl.startsWith("http")
    ? payload.searchUrl
    : `${base}${payload.searchUrl.startsWith("/") ? "" : "/"}${payload.searchUrl}`;
  const unsubLink = `${base}/api/saved-searches/unsubscribe/${encodeURIComponent(payload.unsubscribeToken)}`;
  const label = payload.label.trim() || "tu búsqueda";
  const similarListings = payload.similarListings ?? [];
  const newCount = payload.newListings.length + similarListings.length;
  const totalShown =
    payload.mode === "initial"
      ? payload.newListings.length + payload.otherListings.length + similarListings.length
      : newCount + payload.otherListings.length;

  const subject =
    payload.mode === "initial"
      ? `Bestie · resultados para «${label}»`
      : newCount === 1
        ? `Bestie · 1 anuncio nuevo para «${label}»`
        : `Bestie · ${newCount} anuncios nuevos para «${label}»`;

  const previewText =
    payload.mode === "initial"
      ? `${totalShown || "Varios"} anuncios que coinciden con tus filtros.`
      : newCount === 1
        ? "Hay un anuncio nuevo que coincide con tu búsqueda guardada."
        : `Hay ${newCount} anuncios nuevos que coinciden con tu búsqueda.`;

  const headline =
    payload.mode === "initial"
      ? `Resultados para «${escapeHtml(label)}»`
      : `Nuevos anuncios para «${escapeHtml(label)}»`;

  let bodyListings = "";
  if (payload.mode === "initial") {
    if (similarListings.length) {
      if (payload.newListings.length) {
        bodyListings += `<p style="font-size:13px;font-weight:700;color:${B.primary};margin:4px 0 8px;">Coincidencias exactas</p>`;
        bodyListings += payload.newListings.map((l) => listingCardHtml(base, l)).join("");
      }
      bodyListings += `<p style="font-size:13px;font-weight:700;color:${B.primary};margin:16px 0 8px;">Similares</p>`;
      bodyListings += similarListings.map((l) => listingCardHtml(base, l)).join("");
    } else {
      const all = [...payload.newListings, ...payload.otherListings];
      bodyListings = all.map((l) => listingCardHtml(base, l)).join("");
    }
  } else {
    if (payload.newListings.length) {
      bodyListings += `<p style="font-size:13px;font-weight:700;color:${B.primary};margin:4px 0 8px;">Nuevos · exactos</p>`;
      bodyListings += payload.newListings.map((l) => listingCardHtml(base, l, { isNew: true })).join("");
    }
    if (similarListings.length) {
      bodyListings += `<p style="font-size:13px;font-weight:700;color:${B.primary};margin:16px 0 8px;">Nuevos · similares</p>`;
      bodyListings += similarListings.map((l) => listingCardHtml(base, l, { isNew: true })).join("");
    }
    if (payload.otherListings.length) {
      bodyListings += `<p style="font-size:13px;font-weight:700;color:${B.primary};margin:16px 0 8px;">También coinciden</p>`;
      bodyListings += payload.otherListings.map((l) => listingCardHtml(base, l)).join("");
    }
  }

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${B.body};">${headline}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${B.muted};">Estos cuartos coinciden con los filtros que guardaste. Abre un anuncio para ver fotos y detalles.</p>
    ${
      bodyListings ||
      `<p style="margin:0 0 16px;font-size:14px;color:${B.muted};">Aún no hay anuncios que coincidan en este momento.</p>`
    }
    <p style="margin:20px 0 0;text-align:center;">${primaryButtonHtml(searchLink, "Ver en el mapa")}</p>
  `;

  const html = renderEmailShell({
    previewText,
    headerEyebrow: "Alerta de búsqueda guardada",
    maxWidthPx: 560,
    bodyHtml,
    footerHtml: defaultSupportFooter(
      `<a href="${escapeHtml(unsubLink)}" style="color:${B.muted};">Dejar de recibir alertas de esta búsqueda</a>`,
    ),
  });

  const textLines = [
    subject.replace(/^Bestie · /, ""),
    "",
    payload.mode === "follow_up" && payload.newListings.length ? "NUEVOS:" : "COINCIDENCIAS EXACTAS:",
    ...payload.newListings.map(
      (l) =>
        `- ${listingTitle(l)} · ${money.format(l.rentMxn)}/mes · ${base}/anuncio/${roomReferenceCode(l.id)}`,
    ),
    ...(similarListings.length ? ["", "SIMILARES:"] : []),
    ...similarListings.map(
      (l) =>
        `- ${listingTitle(l)} · ${money.format(l.rentMxn)}/mes · ${base}/anuncio/${roomReferenceCode(l.id)}`,
    ),
    ...(payload.otherListings.length ? ["", "TAMBIÉN COINCIDEN:"] : []),
    ...payload.otherListings.map(
      (l) =>
        `- ${listingTitle(l)} · ${money.format(l.rentMxn)}/mes · ${base}/anuncio/${roomReferenceCode(l.id)}`,
    ),
    "",
    `Ver en el mapa: ${searchLink}`,
    "",
    `Dejar de recibir alertas: ${unsubLink}`,
    `Ayuda: ${B.support}`,
  ];

  return {
    subject,
    previewText,
    html,
    text: textLines.join("\n"),
    replyTo: B.support,
    tags: [
      { name: "category", value: "saved_search" },
      { name: "mode", value: payload.mode },
      { name: "product", value: "bestie" },
    ],
  };
}

export function renderUnsubscribeConfirmationHtml(label: string): string {
  const base = publicBaseUrl();
  const B = EMAIL_BRAND;
  const safe = escapeHtml(label);
  return `<!DOCTYPE html>
<html lang="es-MX">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Alertas desactivadas</title></head>
<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:${B.bgLight};padding:40px 16px;">
  <div style="max-width:420px;margin:0 auto;background:${B.surface};border-radius:16px;border:1px solid ${B.border};padding:32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:${B.primary};">Bestie</p>
    <h1 style="margin:16px 0 8px;font-size:18px;color:${B.body};">Alertas desactivadas</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${B.muted};">Ya no recibirás alertas por correo para «${safe}».</p>
    <p style="margin:0;"><a href="${base}/mis-busquedas" style="margin-right:12px;color:${B.primary};font-weight:600;">Mis búsquedas</a>
    <a href="${base}/buscar" style="color:${B.primary};font-weight:600;">Buscar</a></p>
  </div>
</body></html>`;
}

export function renderUnsubscribeNotFoundHtml(): string {
  const base = publicBaseUrl();
  const B = EMAIL_BRAND;
  return `<!DOCTYPE html>
<html lang="es-MX"><head><meta charset="utf-8"/><title>Enlace no válido</title></head>
<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:${B.bgLight};padding:40px 16px;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:${B.surface};border-radius:16px;padding:32px;border:1px solid ${B.border};">
    <p style="font-size:14px;color:${B.muted};">Enlace no válido o expirado.</p>
    <p style="margin-top:16px;"><a href="${base}/buscar" style="color:${B.primary};font-weight:600;">Ir a buscar</a></p>
  </div>
</body></html>`;
}

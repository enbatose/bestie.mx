/** Formats rent for publisher hub cards (es-MX, no cents). */
export function formatRentMxn(rentMxn: number | undefined | null): string | null {
  if (rentMxn == null || !Number.isFinite(rentMxn) || rentMxn <= 0) return null;
  const amount = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(rentMxn);
  return `${amount} /mes`;
}

/** Short availability hint when the start date is in the future. */
export function formatAvailableFrom(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d <= today) return null;
  const label = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `Disponible ${label}`;
}

export function listingThumbSrc(listing: {
  roomImageUrls?: string[];
  propertyImageUrls?: string[];
}): string | undefined {
  return listing.roomImageUrls?.[0] ?? listing.propertyImageUrls?.[0];
}

/** Owner metrics line: `12 vistas · 2 mensajes`. */
export function formatPublisherMetrics(
  viewsCount: number | undefined | null,
  inquiryCount: number | undefined | null,
): string | null {
  if (viewsCount == null && inquiryCount == null) return null;
  const v = Math.max(0, Math.floor(viewsCount ?? 0));
  const m = Math.max(0, Math.floor(inquiryCount ?? 0));
  const vistas = `${v} vista${v === 1 ? "" : "s"}`;
  const mensajes = `${m} mensaje${m === 1 ? "" : "s"}`;
  return `${vistas} · ${mensajes}`;
}

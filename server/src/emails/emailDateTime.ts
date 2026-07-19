/**
 * Friendly date/time formatting for transactional emails, with Mexico listing timezones.
 */

export const MEXICO_CITY_TZ = "America/Mexico_City";
export const MONTERREY_TZ = "America/Monterrey";
export const CANCUN_TZ = "America/Cancun";

export type ResolvedEmailTimeZone = {
  timeZone: string;
  /** Short place label for copy, e.g. "Guadalajara" or "Ciudad de México". */
  placeLabel: string;
  /**
   * When true, the email must say we used this timezone
   * (support threads / no listing city → Ciudad de México).
   */
  showTimeZoneNote: boolean;
};

export function mexicoCityTimeZone(): ResolvedEmailTimeZone {
  return {
    timeZone: MEXICO_CITY_TZ,
    placeLabel: "Ciudad de México",
    showTimeZoneNote: true,
  };
}

/** Timezone for a listing city name stored on `properties.city`. */
export function resolveTimeZoneForListingCity(city: string | null | undefined): ResolvedEmailTimeZone {
  const raw = (city ?? "").trim();
  if (!raw) return mexicoCityTimeZone();

  const key = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (key.includes("monterrey") || key === "mty" || key.includes("san pedro") || key.includes("guadalupe, n")) {
    return { timeZone: MONTERREY_TZ, placeLabel: raw, showTimeZoneNote: false };
  }
  if (key.includes("cancun") || key.includes("cancún") || key.includes("playa del carmen") || key.includes("tulum")) {
    return { timeZone: CANCUN_TZ, placeLabel: raw, showTimeZoneNote: false };
  }

  // Guadalajara, CDMX, most of central Mexico → America/Mexico_City
  return { timeZone: MEXICO_CITY_TZ, placeLabel: raw, showTimeZoneNote: false };
}

export function resolveTimeZoneForConversation(opts: {
  kind: string | null | undefined;
  city: string | null | undefined;
}): ResolvedEmailTimeZone {
  const kind = (opts.kind ?? "").trim().toLowerCase();
  if (kind === "support" || !opts.city?.trim()) {
    return mexicoCityTimeZone();
  }
  return resolveTimeZoneForListingCity(opts.city);
}

function ymdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDayMonth(date: Date, timeZone: string, withYear: boolean): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(date);
}

/**
 * e.g. "Hoy, 2:45 p. m." · "Ayer, 9:15 a. m." · "19 jul, 6:40 p. m."
 * Appends timezone note when required (Mexico City fallback) or a short city hint for listings.
 */
export function formatFriendlyEmailDateTime(
  iso: string,
  tz: ResolvedEmailTimeZone,
  now: Date = new Date(),
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const date = new Date(t);
  const day = ymdInTimeZone(date, tz.timeZone);
  const today = ymdInTimeZone(now, tz.timeZone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = ymdInTimeZone(yesterdayDate, tz.timeZone);
  const clock = formatClock(date, tz.timeZone);

  let core: string;
  if (day === today) {
    core = `Hoy, ${clock}`;
  } else if (day === yesterday) {
    core = `Ayer, ${clock}`;
  } else {
    const withYear = day.slice(0, 4) !== today.slice(0, 4);
    core = `${formatDayMonth(date, tz.timeZone, withYear)}, ${clock}`;
  }

  if (tz.showTimeZoneNote) {
    return `${core} (hora del centro de México · Ciudad de México)`;
  }
  return `${core} (hora de ${tz.placeLabel})`;
}

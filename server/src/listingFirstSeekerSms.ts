export type FirstSeekerSmsRow = {
  seekerName: string;
  listingTitle: string;
};

const TITLE_MAX = 42;
const NAME_MAX = 40;

function clip(raw: string, max: number): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function seekerLabel(name: string): string {
  return clip(name, NAME_MAX) || "un usuario de Bestie";
}

const FOOTER =
  "Revisa tu correo de Bestie cada 2-3 h (mira también spam) o entra en bestie.mx/mensajes";

/**
 * Transactional SMS so publishers open the Bestie email (and trust the sender).
 * Keep accents; SMS Masivos accepts unicode. No chat body.
 */
export function buildListingFirstSeekerSms(rows: FirstSeekerSmsRow[]): string | null {
  const seekers = rows
    .map((r) => ({
      seekerName: seekerLabel(r.seekerName),
      listingTitle: clip(r.listingTitle, TITLE_MAX),
    }))
    .filter((r) => r.seekerName);
  if (seekers.length === 0) return null;

  const first = seekers[0]!;
  if (seekers.length === 1) {
    const about = first.listingTitle ? ` por "${first.listingTitle}"` : "";
    return `Bestie.mx: ${first.seekerName} te escribió${about}. ${FOOTER}`;
  }

  const others = seekers.length - 1;
  const othersPhrase = others === 1 ? "y otro usuario" : `y otros ${others} usuarios`;
  return `Bestie.mx: ${first.seekerName} ${othersPhrase} te escribieron. ${FOOTER}`;
}

export function listingFirstSeekerSmsEnabled(): boolean {
  const raw = (process.env.LISTING_FIRST_SEEKER_SMS ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

import { METRO_CITIES } from "@/lib/metroCities";
import { propertyReferenceCode, roomReferenceCode } from "@/lib/listingReference";
import type { PropertyListing } from "@/types/listing";

/** Lowercased, accent-free text so "Mezquitán" and "mezquitan" are the same term. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * City spellings publishers actually type: abbreviations, metro names and
 * colloquial forms all resolve to one canonical key per city.
 */
const EXTRA_CITY_ALIASES: Record<string, readonly string[]> = {
  gdl: ["guadalajara jalisco", "guadalajara jal", "perla tapatia", "tapatia"],
  mty: ["monterrey nuevo leon", "monterrey nl"],
  cmx: [
    "cdmx",
    "df",
    "distrito federal",
    "mexico city",
    "ciudad mexico",
    "cd de mexico",
    "zmvm",
  ],
};

/** Cities and municipalities outside the metro list that still appear in listings. */
const STANDALONE_CITY_ALIASES: Record<string, readonly string[]> = {
  merida: ["merida", "merida yucatan"],
  "puerto-vallarta": ["puerto vallarta", "vallarta", "pvr"],
  sayulita: ["sayulita"],
  bucerias: ["bucerias"],
  zapopan: ["zapopan"],
  tlaquepaque: ["tlaquepaque", "san pedro tlaquepaque"],
  tonala: ["tonala"],
  tlajomulco: ["tlajomulco", "tlajomulco de zuniga"],
};

const CITY_ALIAS_TO_KEY: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const add = (alias: string, key: string) => {
    const normalized = normalizeSearchText(alias);
    if (normalized) map.set(normalized, key);
  };
  for (const city of METRO_CITIES) {
    add(city.code, city.code);
    add(city.label, city.code);
    add(city.abbr, city.code);
    add(city.metroName, city.code);
    for (const alias of EXTRA_CITY_ALIASES[city.code] ?? []) add(alias, city.code);
  }
  for (const [key, aliases] of Object.entries(STANDALONE_CITY_ALIASES)) {
    for (const alias of aliases) add(alias, key);
  }
  return map;
})();

/** Levenshtein distance capped at `max` — enough for single-typo tolerance. */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return false;
    prev = curr;
  }
  return prev[b.length]! <= max;
}

/** Canonical city key for any spelling, or null when the text is not a known city. */
export function cityAliasKey(value: string | null | undefined): string | null {
  const normalized = normalizeSearchText(value);
  if (!normalized) return null;

  const direct = CITY_ALIAS_TO_KEY.get(normalized);
  if (direct) return direct;

  if (normalized.length >= 4) {
    for (const [alias, key] of CITY_ALIAS_TO_KEY) {
      if (alias.length < 4) continue;
      if (alias.includes(normalized) || normalized.includes(alias)) return key;
    }
    for (const [alias, key] of CITY_ALIAS_TO_KEY) {
      if (alias.length >= 5 && withinEditDistance(alias, normalized, 1)) return key;
    }
  }
  return null;
}

/** Every spelling of a listing's city, so "GDL" and "Guadalajara" both hit. */
function cityAliasesForKey(key: string): string[] {
  const out: string[] = [];
  for (const [alias, aliasKey] of CITY_ALIAS_TO_KEY) {
    if (aliasKey === key) out.push(alias);
  }
  return out;
}

/** Typo tolerance grows with word length; short words must match exactly. */
function fuzzyTokenMatch(candidate: string, term: string): boolean {
  if (candidate === term) return true;
  if (candidate.startsWith(term) || term.startsWith(candidate)) return true;
  if (term.length < 4) return false;
  return withinEditDistance(candidate, term, term.length >= 7 ? 2 : 1);
}

const MULTIPLIER_WORDS = /^(k|mil)$/;
const LTE_WORDS = new Set(["menos", "hasta", "max", "maximo", "maxima", "debajo", "bajo"]);
const GTE_WORDS = new Set(["mas", "desde", "min", "minimo", "minima", "arriba", "encima", "sobre"]);
/** Words that only mark an amount as rent; they carry no meaning of their own. */
const RENT_CONTEXT_WORDS = new Set(["renta", "rentas", "mxn", "pesos", "peso", "mes", "mensual"]);
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "con", "un", "una", "por", "para", "que", "a"]);

export type RentTerm = { kind: "rent"; value: number; op: "eq" | "lte" | "gte" };
export type CityTerm = { kind: "city"; key: string };
export type TextTerm = { kind: "text"; token: string };
export type QueryTerm = RentTerm | CityTerm | TextTerm;

export type MyListingsQuery = {
  raw: string;
  phrase: string;
  terms: QueryTerm[];
};

/**
 * Reads a raw amount into pesos, accepting the formats publishers type:
 * `4800`, `4,800`, `4.800`, `$4,800`, `4.8k`, `4 mil`.
 */
function parseAmount(
  token: string,
  nextToken: string | undefined,
): { value: number; consumedNext: boolean } | null {
  const suffixMatch = /^([0-9]+(?:[.,][0-9]+)?)k$/.exec(token);
  if (suffixMatch) {
    const base = Number(suffixMatch[1]!.replace(",", "."));
    return Number.isFinite(base) ? { value: Math.round(base * 1000), consumedNext: false } : null;
  }

  if (!/^[0-9]+(\.[0-9]+)?$/.test(token)) return null;
  const value = Number(token);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (nextToken && MULTIPLIER_WORDS.test(nextToken)) {
    return { value: Math.round(value * 1000), consumedNext: true };
  }
  // Bare amounts below this are almost never rents (room counts, ages, ordinals).
  if (value < 500) return null;
  return { value, consumedNext: false };
}

/**
 * Separators disappear in normalization ("4,800" → "4 800", "4.8k" → "4 8k"),
 * so rebuild thousands groups and decimal shorthand before parsing amounts.
 */
function mergeAmountTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    if (!/^[0-9]{1,3}$/.test(token) || !next) {
      out.push(token);
      continue;
    }
    if (/^[0-9]{3}$/.test(next)) {
      out.push(`${token}${next}`);
      i += 1;
      continue;
    }
    // "4 8k" / "4 8 mil" came from "4.8k" / "4.8 mil".
    if (/^[0-9]+k$/.test(next)) {
      out.push(`${token}.${next}`);
      i += 1;
      continue;
    }
    if (/^[0-9]+$/.test(next) && tokens[i + 2] && MULTIPLIER_WORDS.test(tokens[i + 2]!)) {
      out.push(`${token}.${next}`);
      i += 1;
      continue;
    }
    out.push(token);
  }
  return out;
}

export function parseMyListingsQuery(raw: string): MyListingsQuery {
  const phrase = normalizeSearchText(raw);
  if (!phrase) return { raw, phrase, terms: [] };

  const wholeQueryCity = cityAliasKey(phrase);
  if (wholeQueryCity) {
    return { raw, phrase, terms: [{ kind: "city", key: wholeQueryCity }] };
  }

  const tokens = mergeAmountTokens(phrase.split(" "));
  const terms: QueryTerm[] = [];
  let pendingOp: "eq" | "lte" | "gte" = "eq";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (LTE_WORDS.has(token)) {
      pendingOp = "lte";
      continue;
    }
    if (GTE_WORDS.has(token)) {
      pendingOp = "gte";
      continue;
    }
    if (pendingOp !== "eq" && STOPWORDS.has(token)) continue;

    const amount = parseAmount(token, tokens[i + 1]);
    if (amount) {
      terms.push({ kind: "rent", value: amount.value, op: pendingOp });
      if (amount.consumedNext) i += 1;
      pendingOp = "eq";
      continue;
    }

    pendingOp = "eq";
    if (RENT_CONTEXT_WORDS.has(token) || STOPWORDS.has(token)) continue;
    terms.push({ kind: "text", token });
  }

  return { raw, phrase, terms };
}

export type ListingSearchIndex = {
  /** Unique normalized words from every searchable field. */
  tokens: string[];
  /** All searchable text joined, for substring/phrase hits. */
  phrase: string;
  cityKeys: string[];
  rents: number[];
};

/** Builds the searchable corpus for one property and all of its rooms. */
export function buildListingSearchIndex(rooms: readonly PropertyListing[]): ListingSearchIndex {
  const parts: string[] = [];
  const cityKeys = new Set<string>();
  const rents = new Set<number>();
  const push = (value: string | null | undefined) => {
    const normalized = normalizeSearchText(value);
    if (normalized) parts.push(normalized);
  };

  const head = rooms[0];
  if (head) {
    push(head.propertyTitle);
    push(propertyReferenceCode(head.propertyId));
  }

  for (const room of rooms) {
    push(room.title);
    push(room.roomCustomName);
    push(room.summary);
    push(room.neighborhood);
    push(room.city);
    push(roomReferenceCode(room.id));

    const key = cityAliasKey(room.city);
    if (key) {
      cityKeys.add(key);
      for (const alias of cityAliasesForKey(key)) parts.push(alias);
    }

    if (Number.isFinite(room.rentMxn) && room.rentMxn > 0) {
      const rent = Math.round(room.rentMxn);
      rents.add(rent);
      parts.push(String(rent));
    }
  }

  const phrase = parts.join(" ");
  return {
    tokens: [...new Set(phrase.split(" ").filter(Boolean))],
    phrase,
    cityKeys: [...cityKeys],
    rents: [...rents],
  };
}

/** Amounts within 5% (min ±100 pesos) count as the same rent, so "5 mil" finds 4,800. */
function rentIsNear(rent: number, value: number): boolean {
  return Math.abs(rent - value) <= Math.max(100, value * 0.05);
}

function rentTermMatches(index: ListingSearchIndex, term: RentTerm): boolean {
  const slack = Math.max(100, term.value * 0.05);
  return index.rents.some((rent) => {
    if (term.op === "lte") return rent <= term.value + slack;
    if (term.op === "gte") return rent >= term.value - slack;
    return rentIsNear(rent, term.value);
  });
}

function textTermMatches(index: ListingSearchIndex, term: TextTerm): boolean {
  if (index.phrase.includes(term.token)) return true;
  const cityKey = cityAliasKey(term.token);
  if (cityKey && index.cityKeys.includes(cityKey)) return true;
  return index.tokens.some((token) => fuzzyTokenMatch(token, term.token));
}

/** True when every term in the query is satisfied by the listing corpus. */
export function listingMatchesQuery(index: ListingSearchIndex, query: MyListingsQuery): boolean {
  if (!query.terms.length) return true;
  if (index.phrase.includes(query.phrase)) return true;
  return query.terms.every((term) => {
    if (term.kind === "rent") return rentTermMatches(index, term);
    if (term.kind === "city") return index.cityKeys.includes(term.key);
    return textTermMatches(index, term);
  });
}

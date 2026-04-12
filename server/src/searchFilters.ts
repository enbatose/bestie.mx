import type { ListingTag, PropertyListing, RoommateGenderPref } from "./types.js";

export type SearchFilters = {
  q: string;
  budgetMin: number | null;
  budgetMax: number | null;
  tags: ListingTag[];
  pref: RoommateGenderPref | null;
  ageMin: number | null;
  ageMax: number | null;
};

const TAG_SET = new Set<ListingTag>([
  "wifi",
  "mascotas",
  "estacionamiento",
  "muebles",
  "baño-privado",
]);

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFilters(params: URLSearchParams): SearchFilters {
  const tags = (params.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is ListingTag => TAG_SET.has(t as ListingTag));

  const raw = params.get("gender");
  const pref: RoommateGenderPref | null =
    raw === "female" || raw === "male" ? raw : null;

  return {
    q: params.get("q")?.trim() ?? "",
    budgetMin: num(params.get("min")),
    budgetMax: num(params.get("max")),
    tags,
    pref,
    ageMin: num(params.get("ageMin")),
    ageMax: num(params.get("ageMax")),
  };
}

function matchesPref(listing: PropertyListing, pref: RoommateGenderPref | null) {
  if (pref == null) return true;
  if (listing.roommateGenderPref === "any") return true;
  return listing.roommateGenderPref === pref;
}

function matchesAge(listing: PropertyListing, ageMin: number | null, ageMax: number | null) {
  const uMin = ageMin ?? 18;
  const uMax = ageMax ?? 99;
  return listing.ageMax >= uMin && listing.ageMin <= uMax;
}

export function filterListings(listings: PropertyListing[], f: SearchFilters): PropertyListing[] {
  const q = f.q.toLowerCase();
  return listings.filter((l) => {
    const haystack = `${l.city} ${l.neighborhood} ${l.title} ${l.summary}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (f.budgetMin != null && l.rentMxn < f.budgetMin) return false;
    if (f.budgetMax != null && l.rentMxn > f.budgetMax) return false;
    if (f.tags.length && !f.tags.every((t) => l.tags.includes(t))) return false;
    if (!matchesPref(l, f.pref)) return false;
    if (!matchesAge(l, f.ageMin, f.ageMax)) return false;
    return true;
  });
}

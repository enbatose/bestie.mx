import type { ListingTag, PropertyListing, RoommateGenderPref } from "@/types/listing";

export type SearchFilters = {
  q: string;
  budgetMin: number | null;
  budgetMax: number | null;
  tags: ListingTag[];
  /** When set, include listings that accept `any` or match this preference. */
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

export function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.budgetMin != null) p.set("min", String(f.budgetMin));
  if (f.budgetMax != null) p.set("max", String(f.budgetMax));
  if (f.tags.length) p.set("tags", f.tags.join(","));
  if (f.pref === "female" || f.pref === "male") p.set("gender", f.pref);
  if (f.ageMin != null) p.set("ageMin", String(f.ageMin));
  if (f.ageMax != null) p.set("ageMax", String(f.ageMax));
  return p;
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

export const TAG_LABELS: Record<ListingTag, string> = {
  wifi: "Wi‑Fi",
  mascotas: "Mascotas OK",
  estacionamiento: "Estacionamiento",
  muebles: "Amueblado",
  "baño-privado": "Baño privado",
};

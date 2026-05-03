import type {
  ListingTag,
  LodgingType,
  PropertyKind,
  PropertyListing,
  RoomDimension,
  RoommateGenderPref,
} from "@/types/listing";
import { LISTING_TAG_SLUGS } from "@/lib/listingTags";

export type Bbox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type SearchFilters = {
  q: string;
  budgetMin: number | null;
  budgetMax: number | null;
  tags: ListingTag[];
  pref: RoommateGenderPref | null;
  ageMin: number | null;
  ageMax: number | null;
  bbox: Bbox | null;
  lodgingType: LodgingType | null;
  wantHouse: boolean;
  wantApartment: boolean;
  availableFrom: string | null;
  minimalStayMonths: number | null;
  roomDimension: RoomDimension | null;
  avalRequired: boolean | null;
  subletAllowed: boolean | null;
};

const TAG_SET = new Set<ListingTag>(LISTING_TAG_SLUGS);

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseBboxParam(raw: string | null): Bbox | null {
  if (raw == null || raw.trim() === "") return null;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLat, minLng, maxLat, maxLng] = parts as [number, number, number, number];
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat > maxLat || minLng > maxLng) return null;
  return { minLat, minLng, maxLat, maxLng };
}

function parseLodging(raw: string | null): LodgingType | null {
  if (raw === "whole_home" || raw === "private_room" || raw === "shared_room") return raw;
  return null;
}

function parseDim(raw: string | null): RoomDimension | null {
  if (raw === "small" || raw === "medium" || raw === "large") return raw;
  if (raw === "S") return "small";
  if (raw === "M") return "medium";
  if (raw === "L") return "large";
  return null;
}

function flag(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

function parseBoolTri(raw: string | null): boolean | null {
  if (raw == null || raw === "") return null;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return null;
}

function isoDateOk(s: string | null): string | null {
  if (s == null || s.trim() === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null;
  return s.trim();
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
    bbox: parseBboxParam(params.get("bbox")),
    lodgingType: parseLodging(params.get("lodging")),
    wantHouse: flag(params.get("house")),
    wantApartment: flag(params.get("apartment")),
    availableFrom: isoDateOk(params.get("from")),
    minimalStayMonths: num(params.get("minStay")),
    roomDimension: parseDim(params.get("dim")),
    avalRequired: parseBoolTri(params.get("aval")),
    subletAllowed: parseBoolTri(params.get("sublet")),
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
  if (f.bbox != null) {
    const { minLat, minLng, maxLat, maxLng } = f.bbox;
    p.set("bbox", `${minLat},${minLng},${maxLat},${maxLng}`);
  }
  if (f.lodgingType != null) p.set("lodging", f.lodgingType);
  if (f.wantHouse) p.set("house", "1");
  if (f.wantApartment) p.set("apartment", "1");
  if (f.availableFrom) p.set("from", f.availableFrom);
  if (f.minimalStayMonths != null) p.set("minStay", String(f.minimalStayMonths));
  if (f.roomDimension != null) p.set("dim", f.roomDimension);
  if (f.avalRequired === true) p.set("aval", "1");
  if (f.avalRequired === false) p.set("aval", "0");
  if (f.subletAllowed === true) p.set("sublet", "1");
  if (f.subletAllowed === false) p.set("sublet", "0");
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

function inBbox(l: PropertyListing, b: Bbox): boolean {
  return l.lat >= b.minLat && l.lat <= b.maxLat && l.lng >= b.minLng && l.lng <= b.maxLng;
}

function matchesLodging(l: PropertyListing, f: LodgingType | null): boolean {
  if (f == null) return true;
  if (l.lodgingType == null) return true;
  return l.lodgingType === f;
}

function matchesPropertyKind(
  l: PropertyListing,
  wantHouse: boolean,
  wantApartment: boolean,
): boolean {
  if (!wantHouse && !wantApartment) return true;
  const k = l.propertyKind;
  if (k == null) return true;
  const loftOrApt = k === "apartment" || k === "loft";
  if (wantHouse && wantApartment) return k === "house" || loftOrApt;
  if (wantHouse) return k === "house";
  return loftOrApt;
}

function matchesAvailableFrom(l: PropertyListing, from: string | null): boolean {
  if (from == null) return true;
  const lf = l.availableFrom;
  if (lf == null || lf === "") return true;
  return lf <= from;
}

function matchesMinimalStay(l: PropertyListing, userMonths: number | null): boolean {
  if (userMonths == null) return true;
  const req = l.minimalStayMonths;
  if (req == null) return true;
  return userMonths >= req;
}

function matchesDimension(l: PropertyListing, d: RoomDimension | null): boolean {
  if (d == null) return true;
  if (l.roomDimension == null) return true;
  return l.roomDimension === d;
}

function matchesAval(l: PropertyListing, f: boolean | null): boolean {
  if (f == null) return true;
  if (l.avalRequired == null) return true;
  return l.avalRequired === f;
}

function matchesSublet(l: PropertyListing, f: boolean | null): boolean {
  if (f == null) return true;
  if (l.subletAllowed == null) return true;
  return l.subletAllowed === f;
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
    if (f.bbox != null && !inBbox(l, f.bbox)) return false;
    if (!matchesLodging(l, f.lodgingType)) return false;
    if (!matchesPropertyKind(l, f.wantHouse, f.wantApartment)) return false;
    if (!matchesAvailableFrom(l, f.availableFrom)) return false;
    if (!matchesMinimalStay(l, f.minimalStayMonths)) return false;
    if (!matchesDimension(l, f.roomDimension)) return false;
    if (!matchesAval(l, f.avalRequired)) return false;
    if (!matchesSublet(l, f.subletAllowed)) return false;
    return true;
  });
}

export const TAG_LABELS: Record<ListingTag, string> = {
  wifi: "Wi‑Fi",
  mascotas: "Mascotas OK",
  estacionamiento: "Estacionamiento",
  muebles: "Amueblado",
  "baño-privado": "Baño privado",
  fumar: "Se permite fumar",
  fiestas: "Fiestas OK",
  "aire-acondicionado": "Aire acondicionado",
  "seguridad-acceso": "Seguridad / acceso controlado",
  vigilancia: "Vigilancia o portería",
  lavanderia: "Lavandería",
  "cocina-equipada": "Cocina equipada",
  terraza: "Terraza o balcón",
  "lgbt-friendly": "LGBT+ friendly",
  "servicios-incluidos": "Servicios incluidos",
  "cerradura-cuarto": "Cerradura en la recámara",
  "agua-caliente": "Agua caliente",
  "cerca-transporte": "Cerca de transporte",
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  q: "",
  budgetMin: null,
  budgetMax: null,
  tags: [],
  pref: null,
  ageMin: null,
  ageMax: null,
  bbox: null,
  lodgingType: null,
  wantHouse: false,
  wantApartment: false,
  availableFrom: null,
  minimalStayMonths: null,
  roomDimension: null,
  avalRequired: null,
  subletAllowed: null,
};

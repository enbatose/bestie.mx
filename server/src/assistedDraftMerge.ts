import type { AssistedDraftExtraction } from "./assistedDraftGemini.js";

export const SELF_SERVE_CREATOR_ID = "self-serve";

export const HINT_TAG_SLUGS = [
  "mascotas",
  "lgbt-friendly",
  "baño-privado",
  "estacionamiento",
  "muebles",
] as const;

export type HintTagSlug = (typeof HINT_TAG_SLUGS)[number];

export type SelfServeHints = {
  lodgingType?: "private_room" | "shared_room" | null;
  loft?: boolean;
  tagsOn?: HintTagSlug[];
  gender?: "female" | "male" | null;
  roomsForRent?: number | null;
  roomsOccupied?: number | null;
};

/** Property AI chips: household-level only. Bath, parking, furnished, and gender are per recámara. */
const PROPERTY_HINT_TAGS: readonly HintTagSlug[] = ["mascotas", "lgbt-friendly"];

export function sanitizeHintsForPostMode(
  hints: SelfServeHints,
  postMode: "room" | "property",
): SelfServeHints {
  if (postMode !== "property") return hints;
  const allowed = new Set<string>(PROPERTY_HINT_TAGS);
  return {
    ...hints,
    lodgingType: null,
    tagsOn: (hints.tagsOn ?? []).filter((t) => allowed.has(t)),
    gender: null,
  };
}

export type FieldConflict = {
  field: string;
  message: string;
};

export type MergedAssistedDraft = {
  extraction: AssistedDraftExtraction;
  conflicts: FieldConflict[];
};

const TAG_LABEL: Record<HintTagSlug, string> = {
  mascotas: "mascotas",
  "lgbt-friendly": "espacio LGBT+",
  "baño-privado": "baño privado",
  estacionamiento: "cochera",
  muebles: "cuarto amueblado",
};

const DENIED_TAG_PATTERNS: Record<HintTagSlug, RegExp> = {
  mascotas: /no(?:\s+se)?\s+(?:aceptan?|permiten?)\s+mascotas|\bsin mascotas\b|no perros|no gatos/i,
  "lgbt-friendly": /no(?:\s+es)?\s+lgbt|no lgbt/i,
  "baño-privado": /baño compartido|sin baño privado/i,
  estacionamiento: /sin (?:estacionamiento|cochera|parking)|no (?:hay|incluye) (?:estacionamiento|cochera)/i,
  muebles: /sin amueblar|no amueblad|sin muebles/i,
};

const GENDER_FEMALE_TEXT = /solo(?:\s+para)?\s+(?:mujeres|chicas|damas)|no hombres/i;
const GENDER_MALE_TEXT = /solo(?:\s+para)?\s+(?:hombres|chicos|varones)|no mujeres/i;

function uniqueTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).filter(Boolean))];
}

function textDeniesTag(text: string, slug: HintTagSlug): boolean {
  return DENIED_TAG_PATTERNS[slug].test(text);
}

function genderFromText(text: string): "female" | "male" | null {
  const female = GENDER_FEMALE_TEXT.test(text);
  const male = GENDER_MALE_TEXT.test(text);
  if (female && !male) return "female";
  if (male && !female) return "male";
  return null;
}

/**
 * User-on chips are hard yes. Off chips stay unknown so the model may fill them.
 * Conflicts are recorded when the user asserted yes and the source says no / the opposite.
 */
export function mergeExtractionWithHints(
  extraction: AssistedDraftExtraction,
  hints: SelfServeHints,
  sourceText = "",
): MergedAssistedDraft {
  const next: AssistedDraftExtraction = {
    ...extraction,
    tags: uniqueTags(extraction.tags),
  };
  const conflicts: FieldConflict[] = [];
  const denied = new Set(uniqueTags(extraction.deniedTags));
  const text = sourceText.trim();

  const lodging = hints.lodgingType ?? null;
  if (lodging === "private_room" || lodging === "shared_room") {
    if (next.lodgingType && next.lodgingType !== lodging) {
      conflicts.push({
        field: "lodgingType",
        message:
          lodging === "private_room"
            ? "Tu publicación describe una recámara compartida."
            : "Tu publicación describe una recámara privada.",
      });
    }
    next.lodgingType = lodging;
  } else if (!next.lodgingType) {
    next.lodgingType = "private_room";
  }

  if (hints.loft) {
    if (next.propertyKind && next.propertyKind !== "loft") {
      conflicts.push({
        field: "propertyKind",
        message: "Tu publicación no describe un loft.",
      });
    }
    next.propertyKind = "loft";
  }

  const tags = new Set(next.tags ?? []);
  for (const slug of hints.tagsOn ?? []) {
    const deniedByModel = denied.has(slug);
    const deniedByText = text.length > 0 && textDeniesTag(text, slug);
    if (deniedByModel || deniedByText) {
      conflicts.push({
        field: slug,
        message: `Tu texto dice que no se ofrece ${TAG_LABEL[slug]}.`,
      });
    }
    tags.add(slug);
  }
  next.tags = [...tags];

  const gender = hints.gender ?? null;
  if (gender === "female" || gender === "male") {
    const inferred = next.roommateGenderPref;
    const textGender = text.length > 0 ? genderFromText(text) : null;
    const oppositeFromModel =
      inferred === "female" || inferred === "male" ? inferred !== gender : false;
    const oppositeFromText = textGender != null && textGender !== gender;
    if (oppositeFromModel || oppositeFromText) {
      conflicts.push({
        field: "roommateGenderPref",
        message:
          gender === "female"
            ? "Tu publicación indica otra preferencia de género (no solo mujeres)."
            : "Tu publicación indica otra preferencia de género (no solo hombres).",
      });
    }
    next.roommateGenderPref = gender;
  }

  return { extraction: next, conflicts };
}

export const COMPOSE_BEDROOMS_MAX = 20;

export function clampComposeRoomCount(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(COMPOSE_BEDROOMS_MAX, Math.floor(value)));
}

export type PlannedComposeRoom = {
  occupancyStatus: "available" | "occupied";
  rentMxn: number;
  depositMxn: number;
  summary: string;
  title: string;
  lodgingType: string;
  tags: string[];
  roommateGenderPref: string;
  ageMin: number;
  ageMax: number;
  roomDimension: string;
  availableFrom: string;
  minimalStayMonths: number;
};

function composeRoomDefaults(
  extraction: AssistedDraftExtraction,
  nowIso: string,
): Omit<PlannedComposeRoom, "occupancyStatus" | "rentMxn" | "summary" | "title"> {
  const ageMin = extraction.ageMin ?? 18;
  const ageMaxRaw = extraction.ageMax ?? 99;
  return {
    depositMxn: extraction.depositMxn ?? 0,
    lodgingType: extraction.lodgingType ?? "private_room",
    tags: uniqueTags(extraction.tags),
    roommateGenderPref: extraction.roommateGenderPref ?? "any",
    ageMin,
    ageMax: ageMaxRaw < ageMin ? ageMin : ageMaxRaw,
    roomDimension: extraction.roomDimension ?? "medium",
    availableFrom: extraction.availableFrom ?? nowIso.slice(0, 10),
    minimalStayMonths: extraction.minimalStayMonths ?? 1,
  };
}

/**
 * User chips decide how many available vs occupied slots to create.
 * Extraction fills the first available rooms; extra rentable rooms stay incomplete for Completar.
 */
export function planComposeRooms(opts: {
  postMode: "room" | "property";
  roomsForRent: number;
  roomsOccupied: number;
  extraction: AssistedDraftExtraction;
  nowIso: string;
}): PlannedComposeRoom[] {
  const base = composeRoomDefaults(opts.extraction, opts.nowIso);
  const extractedRooms = opts.extraction.rooms ?? [];
  const extractedAvailable = extractedRooms.filter((room) => room.occupancy !== "occupied");

  if (opts.postMode !== "property") {
    return [
      {
        ...base,
        occupancyStatus: "available",
        rentMxn: opts.extraction.rentMxn ?? 0,
        depositMxn: opts.extraction.depositMxn ?? 0,
        summary: opts.extraction.roomSummary ?? "",
        title: "",
      },
    ];
  }

  const forRent = Math.max(1, opts.roomsForRent);
  const occupied = Math.max(0, opts.roomsOccupied);
  const planned: PlannedComposeRoom[] = [];

  for (let i = 0; i < forRent; i++) {
    const extra = extractedAvailable[i];
    planned.push({
      ...base,
      occupancyStatus: "available",
      lodgingType: extra?.lodgingType ?? base.lodgingType,
      rentMxn: extra?.rentMxn ?? (i === 0 ? opts.extraction.rentMxn ?? 0 : 0),
      depositMxn: i === 0 ? base.depositMxn : extra?.rentMxn ? base.depositMxn : 0,
      summary: extra?.roomSummary ?? (i === 0 ? opts.extraction.roomSummary ?? "" : ""),
      title: extra?.title?.trim() ?? "",
    });
  }

  for (let i = 0; i < occupied; i++) {
    planned.push({
      ...base,
      occupancyStatus: "occupied",
      rentMxn: 0,
      depositMxn: 0,
      summary: "",
      title: "",
    });
  }

  return planned;
}

export function isSelfServeCreator(createdByAdminId: string | null | undefined): boolean {
  return createdByAdminId === SELF_SERVE_CREATOR_ID;
}

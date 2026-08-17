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
};

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

export function isSelfServeCreator(createdByAdminId: string | null | undefined): boolean {
  return createdByAdminId === SELF_SERVE_CREATOR_ID;
}

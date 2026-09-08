import type { AssistedDraftExtraction } from "./assistedDraftGemini.js";

/**
 * Binary listing tags the publish UI shows as Sí/No.
 * A missing slug is rendered as "No", so a model omission is a false negative.
 * These patterns recover an explicit yes/no from the pasted post when Gemini drops it.
 */
const TAG_SIGNALS: ReadonlyArray<{
  slug: string;
  affirm: RegExp;
  deny: RegExp;
}> = [
  {
    slug: "mascotas",
    affirm:
      /pet[\s-]*friendly|petfriendly|amigable con (?:las )?mascotas|(?:se\s+)?acept(?:a|an|amos|o)\s+mascotas|mascotas?\s+(?:bienvenid|permitid|ok\b|s[ií]\b)|(?:^|[^\p{L}])(?:hay|tengo|tenemos|viven?|conviven?)\s+(?:con\s+)?(?:\d+\s+)?(?:perrit[oa]s?|perr[oa]s?|gatit[oa]s?|gat[oa]s?|mascotas?)\b|(?:^|[^\p{L}])(?:dos|una|un|mi|mis|los|las)\s+(?:perrit[oa]s?|perr[oa]s?|gatit[oa]s?|mascotas?)\b/iu,
    deny: /no(?:\s+se)?\s+(?:aceptan?|permiten?|acepto|aceptamos)\s+(?:mascotas|perros|gatos)|\bsin mascotas\b|\bno (?:perros|gatos|mascotas)\b|mascotas\s+no\b|prohibid[oa]s?\s+mascotas|libre de (?:humo y )?mascotas/iu,
  },
  {
    slug: "fumar",
    affirm: /(?:se\s+)?permite(?:n)?\s+fumar|puedes fumar|fumar\s+(?:permitid[oa]|s[ií]|ok)\b/iu,
    deny: /\bno fumar\b|no se (?:permite|puede) fumar|prohibido fumar/iu,
  },
  {
    slug: "fiestas",
    affirm: /(?:se\s+)?permite(?:n)?\s+fiestas|fiestas\s+permitid|puedes (?:hacer|armar) fiesta/iu,
    deny: /\bno (?:se permiten )?fiestas\b|sin fiestas|prohibid[oa]s?\s+fiestas/iu,
  },
  {
    slug: "lgbt-friendly",
    affirm: /\blgbtq?\+?\b|\blgbtiq\b|lgbt[\s-]*friendly/iu,
    deny: /\bno lgbt|no es lgbt|no lgbtq/iu,
  },
  {
    slug: "muebles",
    affirm: /\bamueblad[oa]s?\b|con muebles|incluye muebles|muebles incluidos/iu,
    deny: /\bsin amueblar\b|no amueblad|sin muebles|no incluye muebles/iu,
  },
  {
    slug: "closet",
    affirm: /\bcl[oó]sets?\b|\barmarios?\b|\bvestidor(?:es)?\b|guardarropa/iu,
    deny: /\bsin cl[oó]set\b|no (?:tiene|cuenta con|hay) cl[oó]set/iu,
  },
  {
    slug: "baño-privado",
    affirm: /bañ[oa]s?\s+privad(?!\s+o\s+compartid)|baño propio|con baño en (?:el|la) (?:cuarto|rec[aá]mara)/iu,
    deny: /bañ[oa]s?\s+compartid|sin baño privado|comparte(?:n|s)? baño/iu,
  },
  {
    slug: "estacionamiento",
    affirm: /\bestacionamientos?\b|\bcocheras?\b|caj[oó]n(?:es)? de (?:estacionamiento|parking)|\bparking\b/iu,
    deny: /sin (?:estacionamiento|cochera|parking)|no (?:hay|incluye|tiene) (?:estacionamiento|cochera)/iu,
  },
  {
    slug: "cerca-transporte",
    affirm:
      /rutas de tra?n?sporte|rutas de transporte|transporte p[uú]blico|cerca del (?:cami[oó]n|metro|tren|transporte)|l[ií]nea\s*[123]|macrob[uú]s|estaciones?\s+(?:de\s+)?(?:la\s+)?(?:l[ií]nea|tren)/iu,
    deny: /lejos del transporte|sin transporte|mal conectad/iu,
  },
  {
    slug: "seguridad-acceso",
    affirm: /coto privado|privada cerrada|fraccionamiento cerrado|acceso controlado|caseta de acceso/iu,
    deny: /sin seguridad|sin acceso controlado/iu,
  },
  {
    slug: "vigilancia",
    affirm: /\bvigilancia\b|\bguardias?\b|\bporter[oa]\b|seguridad (?:las )?24|caseta de vigilancia/iu,
    deny: /sin vigilancia|sin guardia/iu,
  },
  {
    slug: "wifi",
    affirm: /\bw[\s-]?i[\s-]?fi\b|\binternet\b/iu,
    deny: /sin (?:wifi|wi-fi|internet)|no (?:hay|incluye) (?:wifi|internet)/iu,
  },
  {
    slug: "agua-caliente",
    affirm: /agua caliente|\bboiler\b|\bcalentador\b/iu,
    deny: /sin agua caliente|no hay agua caliente/iu,
  },
  {
    slug: "lavadora",
    affirm: /\blavadoras?\b|[aá]rea de lavado/iu,
    deny: /sin lavadora|no (?:hay|incluye) lavadora/iu,
  },
  {
    slug: "secadora",
    affirm: /\bsecadoras?\b/iu,
    deny: /sin secadora|no (?:hay|incluye) secadora/iu,
  },
  {
    slug: "cocina-equipada",
    affirm: /cocina (?:equipada|integral|completa)|cocina con (?:estufa|refrigerador|refri)/iu,
    deny: /sin cocina|cocina no equipada/iu,
  },
  {
    slug: "aire-acondicionado",
    affirm: /(?<!opci[oó]n a )(?<!incluyendo )aire acondicionado|(?<!opci[oó]n a )\bminisplit\b/iu,
    deny: /sin aire acondicionado|sin minisplit/iu,
  },
  {
    slug: "terraza",
    affirm: /\bterrazas?\b|\bbalc[oó]n\b|\bazotea\b/iu,
    deny: /sin terraza|sin balc[oó]n/iu,
  },
  {
    slug: "profesionistas",
    affirm: /\bprofesionistas?\b|\bgod[ií]n(?:ez)?\b/iu,
    deny: /\bno profesionistas\b|sin profesionistas/iu,
  },
  {
    slug: "estudiantes",
    affirm: /\bestudiantes?\b|\buniversitari[oa]s?\b/iu,
    deny: /\bno estudiantes\b|sin estudiantes|no universitari/iu,
  },
  {
    slug: "parejas",
    affirm: /(?:se\s+)?acept(?:a|an|amos)\s+parejas|parejas\s+(?:bienvenid|permitid|ok\b)/iu,
    deny: /\bno parejas\b|sin parejas|no se aceptan parejas/iu,
  },
  {
    slug: "individuos-solo",
    affirm: /personas?\s+solas?|solo individuales|individuos solos/iu,
    deny: /no personas solas/iu,
  },
  {
    slug: "familiar-ninos",
    affirm: /(?:se\s+)?acept(?:a|an|amos)\s+niñ[oa]s|con niñ[oa]s|familias con niñ/iu,
    deny: /\bno niñ[oa]s\b|sin niñ[oa]s|no se aceptan niñ/iu,
  },
  {
    slug: "servicios-incluidos",
    affirm: /servicios incluidos|renta con servicios|incluye servicios/iu,
    deny: /servicios\s+(?:aparte|aprox|extra)|\+\s*servicios|servicios no incluidos/iu,
  },
];

export type SourceTagSignals = {
  affirmed: string[];
  denied: string[];
};

export function inferBinaryTagsFromSourceText(text: string): SourceTagSignals {
  const source = text.trim();
  if (!source) return { affirmed: [], denied: [] };

  const affirmed: string[] = [];
  const denied: string[] = [];
  for (const signal of TAG_SIGNALS) {
    const isDenied = signal.deny.test(source);
    const isAffirmed =
      signal.affirm.test(source) &&
      !(signal.slug === "baño-privado" && /privad[oa]s?\s+o\s+compartid/iu.test(source));
    // Explicit "no" wins. Affirm patterns like "aceptan mascotas" also sit inside "no se aceptan mascotas".
    if (isDenied) denied.push(signal.slug);
    else if (isAffirmed) affirmed.push(signal.slug);
  }
  return { affirmed, denied };
}

/**
 * Fill omitted yes/no tags from the pasted post, and drop a model tag the post clearly denies.
 * Ambiguous posts (both yes and no) are left to the model.
 */
export function applySourceTextTagSignals(
  extraction: AssistedDraftExtraction,
  sourceText: string,
): AssistedDraftExtraction {
  const { affirmed, denied } = inferBinaryTagsFromSourceText(sourceText);
  if (affirmed.length === 0 && denied.length === 0) return extraction;

  const tags = new Set(extraction.tags ?? []);
  const deniedTags = new Set(extraction.deniedTags ?? []);

  for (const slug of affirmed) {
    tags.add(slug);
    deniedTags.delete(slug);
  }
  for (const slug of denied) {
    tags.delete(slug);
    deniedTags.add(slug);
  }

  return {
    ...extraction,
    tags: tags.size > 0 ? [...tags] : undefined,
    deniedTags: deniedTags.size > 0 ? [...deniedTags] : undefined,
  };
}

/** Add only tags the stored copy affirms and the listing omitted. Never removes a tag a person already set. */
export function omittedAffirmedTags(text: string, existingTags: readonly string[]): string[] {
  const { affirmed } = inferBinaryTagsFromSourceText(text);
  const have = new Set(existingTags);
  return affirmed.filter((slug) => !have.has(slug));
}

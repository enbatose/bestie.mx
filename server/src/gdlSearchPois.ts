/** Named GDL landmarks used to resolve seeker posts (“cerca del ITESO”, Andares, …). */
export type SearchPoi = {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
};

export const GDL_SEARCH_POIS: readonly SearchPoi[] = [
  {
    name: "ITESO",
    lat: 20.6066,
    lng: -103.4156,
    aliases: ["iteso", "iteso universidad", "universidad iteso"],
  },
  {
    name: "UVM",
    lat: 20.6102,
    lng: -103.4034,
    aliases: ["uvm", "uvm sur", "universidad del valle de mexico"],
  },
  {
    name: "Tec de Monterrey",
    lat: 20.7351,
    lng: -103.4542,
    aliases: ["tec", "itesm", "tec de monterrey", "tec guadalajara", "campus guadalajara"],
  },
  {
    name: "Universidad Panamericana",
    lat: 20.6974,
    lng: -103.4162,
    aliases: ["up", "panamericana", "universidad panamericana"],
  },
  {
    name: "CUCS",
    lat: 20.6862,
    lng: -103.3271,
    aliases: ["cucs", "centro universitario de ciencias de la salud"],
  },
  {
    name: "CUCEI",
    lat: 20.6564,
    lng: -103.3254,
    aliases: ["cucei"],
  },
  {
    name: "CUCEA",
    lat: 20.7391,
    lng: -103.3824,
    aliases: ["cucea"],
  },
  {
    name: "CUAAD",
    lat: 20.6874,
    lng: -103.3512,
    aliases: ["cuaad"],
  },
  {
    name: "UAG",
    lat: 20.6968,
    lng: -103.4189,
    aliases: ["uag", "autonoma de guadalajara"],
  },
  {
    name: "Andares",
    lat: 20.7104,
    lng: -103.4118,
    aliases: ["andares", "zona real", "puerta de hierro"],
  },
  {
    name: "Galerías",
    lat: 20.6773,
    lng: -103.4384,
    aliases: ["galerias", "galerías", "plaza galerias"],
  },
  {
    name: "Punto Sao Paulo",
    lat: 20.6704,
    lng: -103.4402,
    aliases: ["punto sao paulo", "sao paulo", "midtown", "midtown jalisco"],
  },
  {
    name: "Zona Chapultepec/Americana",
    lat: 20.6746,
    lng: -103.3665,
    aliases: [
      "zona chapultepec",
      "chapultepec",
      "americana",
      "colonia americana",
      "moderna",
      "lafayette",
      "zona chapultepec/americana",
    ],
  },
  {
    name: "Zona Minerva",
    lat: 20.67439,
    lng: -103.38739,
    aliases: ["minerva", "la minerva", "zona minerva", "justo sierra", "vallarta norte"],
  },
  {
    name: "Centro",
    lat: 20.675138,
    lng: -103.347345,
    aliases: ["centro", "centro historico", "centro histórico", "downtown"],
  },
  {
    name: "Glorieta del Charro",
    lat: 20.6482,
    lng: -103.3058,
    aliases: [
      "glorieta del charro",
      "glorieta charro",
      "la glorieta del charro",
      "monumento al charro",
    ],
  },
  {
    name: "Chapalita",
    lat: 20.6682,
    lng: -103.4008,
    aliases: ["chapalita"],
  },
  {
    name: "Providencia",
    lat: 20.6984,
    lng: -103.3786,
    aliases: ["providencia"],
  },
  // --- ZMG landmarks seekers name ("cerca de…"). Pins are the place itself, not the city center.
  // Plaza del Sol ≠ Tianguis del Sol. Coordinates from OSM / published GPS, Sep 2026.
  {
    name: "Tianguis del Sol",
    lat: 20.65209,
    lng: -103.43317,
    aliases: ["tianguis del sol", "el tianguis del sol", "tianguis del sol zapopan"],
  },
  {
    name: "Plaza del Sol",
    lat: 20.6587,
    lng: -103.39812,
    aliases: ["plaza del sol", "plaza del sol guadalajara"],
  },
  {
    name: "Plaza Patria",
    lat: 20.71238,
    lng: -103.37518,
    aliases: ["plaza patria"],
  },
  {
    name: "La Gran Plaza",
    lat: 20.67363,
    lng: -103.40485,
    aliases: ["la gran plaza", "gran plaza", "gran plaza fashion mall", "gran plaza vallarta"],
  },
  {
    name: "Centro Magno",
    lat: 20.67384,
    lng: -103.38065,
    aliases: ["centro magno"],
  },
  {
    name: "Forum Tlaquepaque",
    lat: 20.64737,
    lng: -103.31986,
    aliases: ["forum tlaquepaque", "foro tlaquepaque", "el forum"],
  },
  {
    name: "Landmark",
    lat: 20.70749,
    lng: -103.41354,
    aliases: ["landmark", "the landmark", "landmark guadalajara"],
  },
  {
    name: "Expo Guadalajara",
    lat: 20.65311,
    lng: -103.39146,
    aliases: ["expo guadalajara", "expo gdl", "la expo"],
  },
  {
    name: "Estadio Akron",
    lat: 20.68185,
    lng: -103.46267,
    aliases: ["estadio akron", "akron", "estadio chivas", "omnilife"],
  },
  {
    name: "Estadio Jalisco",
    lat: 20.70479,
    lng: -103.32767,
    aliases: ["estadio jalisco"],
  },
  {
    name: "Auditorio Telmex",
    lat: 20.73332,
    lng: -103.38135,
    aliases: ["auditorio telmex", "auditorio telmex zapopan"],
  },
  {
    name: "Mercado San Juan de Dios",
    lat: 20.67548,
    lng: -103.34002,
    aliases: ["san juan de dios", "mercado san juan de dios", "mercado libertad", "mercado libertad san juan de dios"],
  },
  {
    name: "Hospital Civil",
    lat: 20.68769,
    lng: -103.34354,
    aliases: ["hospital civil", "hospital civil fray antonio alcalde", "fray antonio alcalde", "hospital civil viejo"],
  },
  {
    name: "Hospital Ángeles del Carmen",
    lat: 20.68075,
    lng: -103.3984,
    aliases: ["hospital angeles", "hospital ángeles", "angeles del carmen", "ángeles del carmen"],
  },
  {
    name: "Hospital San Javier",
    lat: 20.68795,
    lng: -103.38946,
    aliases: ["hospital san javier", "san javier"],
  },
  {
    name: "Universidad Lamar",
    lat: 20.59026,
    lng: -103.43844,
    aliases: [
      "lamar",
      "lamar palomar",
      "universidad lamar",
      "campus palomar",
      "lamar campus palomar",
    ],
  },
  {
    name: "UNIVA",
    lat: 20.65965,
    lng: -103.41926,
    aliases: ["univa", "univa tepeyac", "universidad del valle de atemajac"],
  },
  {
    name: "Universidad Marista",
    lat: 20.63436,
    lng: -103.40717,
    aliases: ["marista", "universidad marista", "marista de guadalajara"],
  },
  {
    name: "La Salle",
    lat: 20.63538,
    lng: -103.4067,
    aliases: ["la salle", "universidad la salle", "ulsa", "ulsa guadalajara"],
  },
  {
    name: "CUCSH",
    lat: 20.6972,
    lng: -103.3476,
    aliases: ["cucsh", "la normal", "cucsh la normal", "ciencias sociales y humanidades"],
  },
  {
    name: "CETI Colomos",
    lat: 20.7034,
    lng: -103.3898,
    aliases: ["ceti", "ceti colomos"],
  },
  {
    name: "UTEG",
    lat: 20.68478,
    lng: -103.37421,
    aliases: ["uteg", "universidad tecnologica de guadalajara"],
  },
  {
    name: "Basílica de Zapopan",
    lat: 20.72133,
    lng: -103.39235,
    aliases: ["basilica de zapopan", "basílica de zapopan", "basilica zapopan", "zapopan centro"],
  },
  {
    name: "Hospicio Cabañas",
    lat: 20.67687,
    lng: -103.33771,
    aliases: ["hospicio cabanas", "hospicio cabañas", "cabanas", "cabañas", "instituto cultural cabanas"],
  },
  {
    name: "Glorieta Niños Héroes",
    lat: 20.66687,
    lng: -103.36847,
    aliases: ["ninos heroes", "niños héroes", "glorieta ninos heroes", "glorieta de los ninos heroes"],
  },
  {
    name: "Bosque Los Colomos",
    lat: 20.7081,
    lng: -103.3945,
    aliases: ["colomos", "los colomos", "bosque los colomos", "bosque colomos", "parque colomos"],
  },
  {
    name: "Zoológico Guadalajara",
    lat: 20.72887,
    lng: -103.30708,
    aliases: ["zoologico", "zoológico", "zoologico guadalajara", "zoo guadalajara"],
  },
  {
    name: "Central Nueva",
    lat: 20.6192,
    lng: -103.28552,
    aliases: ["central nueva", "central camionera", "nueva central", "nueva central camionera"],
  },
  {
    name: "Centro Médico",
    lat: 20.6945,
    lng: -103.352,
    aliases: ["centro medico", "centro médico", "imss centro medico", "centro medico nacional de occidente"],
  },
  {
    name: "Central de Abastos",
    lat: 20.642,
    lng: -103.356,
    aliases: ["mercado de abastos", "central de abastos", "abastos"],
  },
  {
    name: "Punto Sur",
    lat: 20.6118,
    lng: -103.4168,
    aliases: ["punto sur", "punto sur tlajomulco"],
  },
  {
    name: "Parque Metropolitano",
    lat: 20.7055,
    lng: -103.3065,
    aliases: ["parque metropolitano", "metropolitano"],
  },
];

export function normalizePlaceKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Campus / mall short names that are real tokens, not fragments like "sol". */
const SHORT_PLACE_TOKENS = new Set([
  "tec",
  "uvm",
  "up",
  "uag",
  "cucs",
  "cucei",
  "cucea",
  "cuaad",
  "cucsh",
  "iteso",
  "univa",
  "uteg",
  "ceti",
]);

const CITY_ONLY_PHRASES = new Set([
  "gdl",
  "guadalajara",
  "zona metropolitana",
  "area del mapa",
  "mapa",
  "zona",
]);

const LEADING_PLACE_NOISE =
  /^(cerca del|cerca de la|cerca de los|cerca de las|cerca de|por la zona de|en la zona de|zona del|zona de la|zona de|por el|por la|en el|en la|en)\s+/;

/** Drop "GDL ·" / "Cerca de" so "GDL · Tianguis del Sol" can hit a pin. */
export function cleanedPlaceKey(value: string): string {
  let key = normalizePlaceKey(value).replace(/^(gdl|guadalajara)\s+/, "").trim();
  let prev = "";
  while (key && key !== prev) {
    prev = key;
    key = key.replace(LEADING_PLACE_NOISE, "").trim();
  }
  return key;
}

/** Non-empty when the text names a place, not the whole metro. */
export function specificPlacePhrase(value: string): string {
  const cleaned = cleanedPlaceKey(value);
  if (!cleaned || cleaned.length < 3 || CITY_ONLY_PHRASES.has(cleaned)) return "";
  return cleaned;
}

function placeTokens(value: string): string[] {
  return cleanedPlaceKey(value).split(" ").filter(Boolean);
}

function containsContiguous(haystack: string[], needle: string[]): { start: number; end: number } | null {
  if (!needle.length || needle.length > haystack.length) return null;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return { start: i, end: i + needle.length };
  }
  return null;
}

type PoiSpan = { poi: SearchPoi; start: number; end: number; score: number };

/**
 * Longest landmark names inside a free-text phrase.
 * "Tianguis del Sol" must not match "Plaza del Sol", and a city-wide label
 * like "GDL · Tianguis del Sol" still resolves.
 */
export function matchGdlSearchPois(phrase: string): SearchPoi[] {
  const tokens = placeTokens(phrase);
  if (!tokens.length) return [];

  const spans: PoiSpan[] = [];
  for (const poi of GDL_SEARCH_POIS) {
    const names = [poi.name, ...poi.aliases];
    let best: PoiSpan | null = null;
    for (const name of names) {
      const aliasTokens = normalizePlaceKey(name).split(" ").filter(Boolean);
      if (!aliasTokens.length) continue;
      if (
        aliasTokens.length === 1 &&
        aliasTokens[0]!.length < 4 &&
        !SHORT_PLACE_TOKENS.has(aliasTokens[0]!)
      ) {
        continue;
      }
      const span = containsContiguous(tokens, aliasTokens);
      if (!span) continue;
      const score = aliasTokens.join(" ").length;
      if (!best || score > best.score) best = { poi, start: span.start, end: span.end, score };
    }
    if (best) spans.push(best);
  }

  spans.sort((a, b) => b.score - a.score || a.start - b.start);
  const kept: PoiSpan[] = [];
  for (const span of spans) {
    const overlaps = kept.some(
      (k) => !(span.end <= k.start || span.start >= k.end),
    );
    if (!overlaps) kept.push(span);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept.map((s) => s.poi);
}

import { normalizeSearchText } from "@/lib/myListingsSearch";

export type FaqItem = {
  id: string;
  question: string;
  /** Plain-text answer used for display when no rich override is needed, and for search. */
  answer: string;
  /**
   * Extra keywords / synonyms that should surface this entry
   * (e.g. "costo" → comisión, "denunciar" → reportar).
   */
  synonyms: readonly string[];
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "que-es",
    question: "¿Qué es Bestie MX?",
    answer:
      "Bestie MX (bestie.mx) es un marketplace para buscar roomie en Guadalajara (GDL) y publicar cuartos compartidos o un comparto depa, con mapa, filtros y mensajes en la app.",
    synonyms: [
      "que es",
      "bestie mx",
      "plataforma",
      "marketplace",
      "app",
      "aplicacion",
      "roomie",
      "roommate",
      "companero",
      "renta compartida",
      "cuarto compartido",
      "comparto depa",
      "como funciona",
      "servicio",
      "producto",
      "guadalajara",
      "gdl",
    ],
  },
  {
    id: "roomie-gdl",
    question: "¿Puedo buscar roomie en Guadalajara / GDL?",
    answer:
      "Sí. El lanzamiento está enfocado en Guadalajara y el área metropolitana. Entra a Buscar (roomie GDL), elige colonias en el mapa y filtra cuartos compartidos o rentas compartidas según lo que necesites.",
    synonyms: [
      "roomie guadalajara",
      "roomie gdl",
      "roomi gdl",
      "roomi",
      "guadalajara",
      "gdl",
      "zapopan",
      "tlaquepaque",
      "buscar roomie",
      "encontrar roomie",
      "cuartos guadalajara",
      "cuarto compartido guadalajara",
      "comparto depa guadalajara",
      "rentas compartidas",
    ],
  },
  {
    id: "como-buscar",
    question: "¿Cómo busco un cuarto o roomie?",
    answer:
      "Entra a Buscar, elige ciudad o colonia en el mapa de Guadalajara, aplica filtros (género, edad, baño, estacionamiento, etc.) y abre los anuncios que te interesen para contactar al anunciante.",
    synonyms: [
      "buscar",
      "busqueda",
      "mapa",
      "filtro",
      "filtros",
      "colonia",
      "zona",
      "ciudad",
      "guadalajara",
      "encontrar",
      "como funciona",
      "pasos",
      "cuartos",
      "cuarto",
    ],
  },
  {
    id: "como-publicar",
    question: "¿Cómo publico un anuncio de cuarto o comparto depa?",
    answer:
      "Ve a Publicar, completa los datos del cuarto o de la propiedad con varias recámaras, sube fotos y publica. Puedes pausar o editar tus anuncios desde Mis anuncios.",
    synonyms: [
      "publicar",
      "anunciar",
      "anuncio",
      "publicacion",
      "ofrecer",
      "rentar",
      "subir",
      "fotos",
      "mis anuncios",
      "propietario",
      "dueno",
      "como funciona",
      "comparto depa",
      "tengo un cuarto",
    ],
  },
  {
    id: "comision",
    question: "¿Cobra comisión Bestie MX?",
    answer:
      "En esta etapa el uso es gratuito para buscadores y anunciantes; cualquier cambio se publicará con anticipación en esta página y en avisos legales.",
    synonyms: [
      "comision",
      "precio",
      "costo",
      "cuanto cuesta",
      "gratis",
      "gratuito",
      "tarifa",
      "pago",
      "cobro",
      "fee",
      "monetizacion",
      "plan",
      "suscripcion",
    ],
  },
  {
    id: "reportar",
    question: "¿Cómo reporto un anuncio, foto o chat sospechoso?",
    answer:
      "Usa el botón Reportar en el anuncio, en una foto o en la conversación privada. Elige un motivo (por ejemplo estafa, fotos falsas, contenido inapropiado o acoso) y, si quieres, agrega un detalle. Revisaremos el reporte; también puedes escribir a contacto@bestie.mx con el enlace. Bestie puede pausar anuncios o restringir cuentas que incumplan las reglas.",
    synonyms: [
      "reportar",
      "denunciar",
      "sospechoso",
      "estafa",
      "fraude",
      "scam",
      "abuso",
      "spam",
      "falso",
      "seguridad",
      "ayuda",
      "soporte",
      "contacto",
      "foto",
      "chat",
      "conversacion",
      "inapropiado",
    ],
  },
  {
    id: "prevenir-estafas",
    question: "¿Cómo evito estafas al buscar o rentar un cuarto?",
    answer:
      "Antes de ver mensajes sobre un anuncio, Bestie muestra un aviso de seguridad que debes aceptar. No pagues depósito ni renta antes de visitar el inmueble y firmar un contrato. Desconfía de urgencia, precios muy bajos o “dueños” que no pueden mostrarte la propiedad. Verifica la identidad de tu contraparte. Si algo no cuadra, usa Reportar en el anuncio o en el chat. Bestie solo facilita el contacto: no es parte del arrendamiento ni garantiza pagos entre usuarios.",
    synonyms: [
      "estafa",
      "fraude",
      "scam",
      "deposito",
      "anticipo",
      "pago",
      "seguridad",
      "aviso",
      "prevenir",
      "cuidado",
      "contrato",
      "visitar",
      "clabe",
      "transferencia",
    ],
  },
  {
    id: "cookies",
    question: "¿Qué cookies usa Bestie y cómo las controlo?",
    answer:
      "Las cookies necesarias (sesión e inicio de sesión) siempre están activas. La analítica (PostHog) y la medición de anuncios (píxel de Meta) solo se activan si las aceptas en el banner de cookies. Puedes elegir “Solo necesarias”, “Aceptar todas” o personalizar, y cambiar tu decisión desde el enlace Cookies del pie de página. Más detalle en el Aviso de Privacidad (sección Cookies).",
    synonyms: [
      "cookies",
      "cookie",
      "rastreo",
      "tracking",
      "posthog",
      "pixel",
      "meta",
      "facebook",
      "analitica",
      "privacidad",
      "consentimiento",
      "banner",
    ],
  },
  {
    id: "datos",
    question: "¿Mis datos están seguros?",
    answer:
      "Consulta cómo tratamos y protegemos tus datos en nuestro Aviso de Privacidad. Puedes solicitar la eliminación de tu cuenta y datos escribiendo a contacto@bestie.mx.",
    synonyms: [
      "datos",
      "privacidad",
      "seguridad",
      "proteccion",
      "aviso",
      "gdpr",
      "lfpdppp",
      "cuenta",
      "correo",
      "password",
      "contrasena",
      "eliminar datos",
      "borrado",
    ],
  },
];

/**
 * Filter FAQ entries by free-text query.
 * Matches question/answer text and synonym keywords (accent/case-insensitive).
 * Multi-word queries require every token to match at least one field.
 */
export function filterFaqItems(items: readonly FaqItem[], query: string): FaqItem[] {
  const q = normalizeSearchText(query);
  if (!q) return [...items];

  const tokens = q.split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    const fields = [item.question, item.answer, ...item.synonyms].map(normalizeSearchText);
    // Prefer whole-phrase match when the query is a known multi-word synonym.
    if (fields.some((field) => field.includes(q))) return true;
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

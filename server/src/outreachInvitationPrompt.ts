/** Canonical invite URL — only URL allowed in the Facebook comment. */
export const OUTREACH_INVITATION_URL = "https://bestie.mx/gdl";

/** Exact sign-off so admins can @-link the Bestie Facebook presence. */
export const OUTREACH_INVITATION_SIGN_OFF = "Atte. Equipo Bestie MX.";

const MAX_OUTPUT_CHARS = 900;

export type OutreachInvitationInput = {
  /** Optional first name / how they signed the FB post. */
  publisherName?: string | null;
  /** Previous paste text — used to force a different paraphrase on regenerate. */
  previousText?: string | null;
};

export const OUTREACH_INVITATION_SYSTEM_PROMPT = `Eres copywriter de Bestie (marketplace de roomies y cuartos en Guadalajara, México).

Redactas un comentario corto para pegar en un post de Facebook (grupo de rentas/roomies) donde alguien ya publicó un cuarto o roomie. El objetivo: invitarles a publicar también en Bestie.

Voz de marca (Equipo Bestie):
- Español de México, tú, cercano y profesional — no corporativo frío, no infantil.
- Habla como el equipo de Bestie ("te invitamos", "en Bestie…"), no como un perfil personal anónimo.
- Cero hashtags. Sin pedir like/follow. Sin criticar Facebook ni el grupo. Sin pedir que quiten su post.
- No prometas leads, métricas ni resultados garantizados.
- 1–3 emojis máximo, solo si aportan (casa, check, ojo, chat). Sin spam de emojis ni signos de exclamación en cascada.

Must-include (puedes parafrasear, pero el sentido debe quedar):
1) Publicar, buscar cuarto y mensajear es gratis.
2) También impulsamos / promocionamos sus anuncios en grupos de Facebook.
3) Más visibilidad y alcance sin el rollo de republicar varias veces al día o en muchos grupos distintos.
4) Exactamente un URL, en su propia línea o al final del cuerpo: ${OUTREACH_INVITATION_URL}
5) Cierre EXACTO en la última línea: ${OUTREACH_INVITATION_SIGN_OFF}

Reglas del enlace (crítico para Facebook):
- En prosa escribe "Bestie" SIN ".mx" (nunca "Bestie.mx", "bestie.mx" ni "www.bestie.mx" fuera del URL).
- El único URL del comentario es ${OUTREACH_INVITATION_URL}.

Formato:
- 3–6 oraciones cortas + URL + firma.
- Saludo natural (Hola / Qué tal / Hola + nombre si te lo pasan).
- Variar estructura y vocabulario en cada generación para que no suene a plantilla spam.
- Responde SOLO con el comentario listo para pegar. Sin comillas, sin markdown, sin notas.`;

export function buildOutreachInvitationUserPrompt(input: OutreachInvitationInput): string {
  const name = (input.publisherName ?? "").trim();
  const previous = (input.previousText ?? "").trim();
  const parts: string[] = [
    "Genera un comentario de invitación distinto (parafraseado) para pegar bajo el post de Facebook del publicador.",
  ];
  if (name) {
    parts.push(`Nombre o cómo firman (opcional, úsalo solo en el saludo si suena natural): ${name}`);
  } else {
    parts.push("No hay nombre: saludo genérico amable.");
  }
  if (previous) {
    parts.push(
      "Versión anterior (NO la copies; cambia apertura, orden de beneficios y redacción):\n---\n" +
        previous +
        "\n---",
    );
  }
  parts.push(
    `Recuerda: gratis publicar + buscar cuarto + mensajear; promoción en grupos de FB; menos hassle de republicar; URL ${OUTREACH_INVITATION_URL}; firma exacta "${OUTREACH_INVITATION_SIGN_OFF}".`,
  );
  return parts.join("\n\n");
}

const TEMPLATE_VARIANTS: Array<(name: string | null) => string> = [
  (name) =>
    [
      `${name ? `Hola ${name},` : "Hola,"} vi tu anuncio y te invitamos a publicarlo también en Bestie, el marketplace de roomies en Guadalajara.`,
      "Ahí puedes publicar, buscar cuarto y mensajear sin costo.",
      "Además impulsamos tus anuncios en grupos de Facebook para que tengas más alcance sin estar republicando varias veces al día o en muchos grupos.",
      OUTREACH_INVITATION_URL,
      OUTREACH_INVITATION_SIGN_OFF,
    ].join("\n\n"),
  (name) =>
    [
      `${name ? `Qué tal ${name},` : "Qué tal,"} si quieres dar más visibilidad a tu cuarto, en Bestie puedes subir tu anuncio gratis (publicar, buscar y chatear sin pagar).`,
      "Nosotros también lo compartimos en grupos de Facebook para que no tengas que pegarlo una y otra vez en distintos lugares.",
      OUTREACH_INVITATION_URL,
      OUTREACH_INVITATION_SIGN_OFF,
    ].join("\n\n"),
  (name) =>
    [
      `${name ? `Hola ${name},` : "Hola,"} te escribimos desde Bestie: plataforma local de cuartos y roomies en GDL.`,
      "Publicar, buscar cuarto y mensajear es gratis, y ayudamos a difundir tu post en grupos de Facebook para llegar a más gente sin el rollo de publicar todo el día.",
      OUTREACH_INVITATION_URL,
      OUTREACH_INVITATION_SIGN_OFF,
    ].join("\n\n"),
  (name) =>
    [
      `${name ? `Hola ${name},` : "Hola,"} notamos tu post y pensamos que te puede servir Bestie.`,
      "Es gratis publicar, buscar cuarto y mensajear; además promocionamos anuncios en grupos de Facebook para sumar alcance sin estar en varios grupos a diario.",
      OUTREACH_INVITATION_URL,
      OUTREACH_INVITATION_SIGN_OFF,
    ].join("\n\n"),
];
function stripCodeFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t.replace(/^["“]|["”]$/g, "").trim();
}

/** Remove accidental second links / prose domain mentions that FB would auto-link. */
function scrubExtraBestieDomains(text: string): string {
  const placeholder = "\uE000BESTIE_INVITE_URL\uE000";
  const protectedUrl = text.includes(OUTREACH_INVITATION_URL)
    ? text.split(OUTREACH_INVITATION_URL).join(placeholder)
    : text;
  return protectedUrl
    .replace(/https?:\/\/(?:www\.)?bestie\.mx\/?\S*/gi, "")
    .replace(/\b(?:www\.)?bestie\.mx\b/gi, "Bestie")
    .replace(/\bBestie\.mx\b/g, "Bestie")
    .split(placeholder)
    .join(OUTREACH_INVITATION_URL);
}

function ensureUrl(text: string): string {
  if (text.includes(OUTREACH_INVITATION_URL)) return text;
  // Insert URL before sign-off if present, else append.
  const signIdx = text.lastIndexOf(OUTREACH_INVITATION_SIGN_OFF);
  if (signIdx >= 0) {
    return `${text.slice(0, signIdx).trimEnd()}\n\n${OUTREACH_INVITATION_URL}\n\n${OUTREACH_INVITATION_SIGN_OFF}`;
  }
  return `${text.trimEnd()}\n\n${OUTREACH_INVITATION_URL}`;
}

function ensureSignOff(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.endsWith(OUTREACH_INVITATION_SIGN_OFF)) return trimmed;
  // Drop a wrong/near sign-off line then append exact one.
  const lines = trimmed.split(/\n+/);
  const last = (lines[lines.length - 1] ?? "").trim();
  if (/^atte\.?\s+equipo\s+bestie/i.test(last) || /^equipo\s+bestie/i.test(last)) {
    lines.pop();
  }
  return `${lines.join("\n").trimEnd()}\n\n${OUTREACH_INVITATION_SIGN_OFF}`;
}

export function finalizeOutreachInvitationCopy(raw: string): string {
  let text = scrubExtraBestieDomains(stripCodeFences(raw));
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  text = ensureUrl(text);
  text = ensureSignOff(text);
  // Collapse 3+ blank lines.
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > MAX_OUTPUT_CHARS) {
    // Keep URL + sign-off; truncate body.
    const body = text
      .replace(OUTREACH_INVITATION_URL, "")
      .replace(OUTREACH_INVITATION_SIGN_OFF, "")
      .trim()
      .slice(0, MAX_OUTPUT_CHARS - OUTREACH_INVITATION_URL.length - OUTREACH_INVITATION_SIGN_OFF.length - 10);
    text = `${body}\n\n${OUTREACH_INVITATION_URL}\n\n${OUTREACH_INVITATION_SIGN_OFF}`;
  }
  return text;
}

export function buildTemplateOutreachInvitation(input: OutreachInvitationInput = {}): string {
  const nameRaw = (input.publisherName ?? "").trim();
  const name = nameRaw ? nameRaw.split(/\s+/)[0]! : null;
  const previous = (input.previousText ?? "").trim();
  let idx = Math.floor(Math.random() * TEMPLATE_VARIANTS.length);
  if (previous) {
    // Prefer a different variant than one that shares the previous opening word.
    const open = previous.slice(0, 24).toLowerCase();
    for (let i = 0; i < TEMPLATE_VARIANTS.length; i++) {
      const candidate = TEMPLATE_VARIANTS[i]!(name);
      if (!candidate.toLowerCase().startsWith(open.slice(0, 8))) {
        idx = i;
        break;
      }
    }
  }
  return finalizeOutreachInvitationCopy(TEMPLATE_VARIANTS[idx]!(name));
}

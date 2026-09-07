/**
 * Turn opaque API codes like `admin_usage_502` into Spanish copy with
 * troubleshooting tips so admins can self-serve without digging in Cursor.
 */

const ACTION_BY_PREFIX: Record<string, string> = {
  admin_usage: "cargar el uso de APIs (pestaña Métrica)",
  admin_street_view: "cargar métricas de Street View",
  admin_image_uploads: "cargar el reporte de subidas de imagen",
  admin_analytics: "cargar el resumen de analítica",
  admin_nav_counts: "cargar los contadores del menú admin",
  admin_users: "cargar la lista de usuarios",
  admin_posts: "cargar el reporte de posts",
  admin_fc_get: "cargar las ciudades destacadas",
  admin_fc_put: "guardar las ciudades destacadas",
  admin_arco_search: "buscar la cuenta ARCO",
  admin_arco_log: "registrar la acción ARCO",
  admin_support_list: "cargar Soporte al Cliente",
  admin_support_thread: "cargar la conversación de soporte",
  admin_report_context: "cargar el contexto del reporte",
  admin_blog_list: "cargar la lista de artículos del blog",
  admin_blog_get: "abrir el artículo del blog",
  admin_blog_create: "crear el artículo del blog",
  admin_blog_delete: "eliminar el artículo del blog",
  admin_blog_save: "guardar el artículo del blog",
  admin_blog_generate: "generar el artículo con IA",
  admin_blog_rescore: "recalcular el score del artículo",
  admin_blog_enhance: "mejorar el artículo con IA",
  admin_blog_chat: "enviar el mensaje al chat del blog",
  admin_blog_clear_chat: "limpiar el chat del blog",
  admin_blog_topics: "cargar temas del blog",
  auth_me: "verificar tu sesión",
  link_publisher: "vincular el publicador",
  groups_mine: "cargar tus grupos",
  groups_create: "crear el grupo",
  groups_join: "unirte al grupo",
  conversations: "cargar conversaciones",
  messages: "cargar mensajes",
  safety_status: "consultar el estado de seguridad",
  phone_reveal_status: "consultar el revelado de teléfono",
  join_report: "enviar el reporte",
  blog_index: "cargar el índice del blog",
  blog_article: "cargar el artículo",
  blog_comments: "cargar comentarios",
  blog_comment: "publicar el comentario",
  blog_comment_patch: "editar el comentario",
  blog_comment_delete: "eliminar el comentario",
  blog_report: "reportar el comentario",
  listings_http: "cargar anuncios",
  listing_http: "cargar el anuncio",
  location_search_http: "buscar ubicaciones",
  property_http: "cargar la propiedad",
  my_listings_http: "cargar Mis Anuncios",
};

const KNOWN_CODE_MESSAGES: Record<string, string> = {
  rate_limited: "Demasiadas solicitudes en poco tiempo. Espera un momento e intenta de nuevo.",
  unauthorized: "Necesitas iniciar sesión de administrador. Cierra sesión, entra de nuevo y recarga.",
  forbidden: "Tu cuenta no tiene permiso de administrador. Confirma que tu correo está en ADMIN_EMAILS.",
  empty_invitation: "La generación devolvió un comentario vacío. Intenta de nuevo en unos segundos.",
  empty_diffusion_comment: "La generación devolvió un comentario vacío. Intenta de nuevo en unos segundos.",
  invalid_month: "El mes seleccionado no es válido. Elige otro mes (formato AAAA-MM).",
};

type StatusHint = {
  label: string;
  meaning: string;
  tips: string[];
};

function statusHint(status: number): StatusHint {
  if (status === 400) {
    return {
      label: "400 Bad Request",
      meaning: "la petición no es válida (parámetros o cuerpo incorrectos)",
      tips: [
        "Recarga la página e intenta de nuevo.",
        "Si cambiaste un filtro o mes, vuelve al valor por defecto.",
      ],
    };
  }
  if (status === 401 || status === 403) {
    return {
      label: status === 401 ? "401 Unauthorized" : "403 Forbidden",
      meaning: "no hay sesión admin válida o tu correo no está autorizado",
      tips: [
        "Cierra sesión, entra otra vez y recarga Administración.",
        "Confirma en Railway que tu correo está en ADMIN_EMAILS del entorno correcto (Dev vs Prod).",
      ],
    };
  }
  if (status === 404) {
    return {
      label: "404 Not Found",
      meaning: "el recurso o la ruta no existe (o ya se eliminó)",
      tips: [
        "Recarga la página.",
        "Si acabas de desplegar, espera a que termine el deploy y prueba otra vez.",
      ],
    };
  }
  if (status === 408 || status === 504) {
    return {
      label: status === 408 ? "408 Timeout" : "504 Gateway Timeout",
      meaning: "la operación tardó demasiado (timeout en el proxy o backend)",
      tips: [
        "Espera 10–20 segundos y recarga.",
        "Si solo falla Métrica, PostHog u otra API externa puede estar lenta; el resto de admin suele seguir usable.",
        "En Railway revisa logs del servicio por timeouts o reinicios.",
      ],
    };
  }
  if (status === 429) {
    return {
      label: "429 Too Many Requests",
      meaning: "hay un límite de ritmo activo",
      tips: ["Espera un minuto e intenta de nuevo.", "Evita disparar la misma acción muchas veces seguidas."],
    };
  }
  if (status === 502) {
    return {
      label: "502 Bad Gateway",
      meaning:
        "el proxy no obtuvo una respuesta válida del backend (reinicio, deploy, caída breve o timeout)",
      tips: [
        "Recarga en 10–20 segundos: a menudo es un deploy o reinicio corto.",
        "En Railway confirma que el servicio está Healthy (sin deploy a medias).",
        "Si solo falla Métrica, Outreach y el resto de pestañas pueden seguir usándose; el endpoint afectado es /api/admin/analytics/usage.",
      ],
    };
  }
  if (status === 503) {
    return {
      label: "503 Service Unavailable",
      meaning: "el backend no está disponible en este momento",
      tips: [
        "Espera un momento y recarga.",
        "Revisa en Railway si el servicio está caído o reiniciando.",
      ],
    };
  }
  if (status >= 500) {
    return {
      label: `${status} Error del servidor`,
      meaning: "el backend falló al procesar la petición",
      tips: [
        "Recarga e intenta de nuevo.",
        "Si se repite, abre logs en Railway (errores alrededor de esa hora) y anota el código de abajo.",
      ],
    };
  }
  return {
    label: `HTTP ${status}`,
    meaning: "la API respondió con un error",
    tips: ["Recarga e intenta de nuevo.", "Si persiste, revisa logs en Railway con el código de abajo."],
  };
}

function looksLikeProse(value: string): boolean {
  if (/\s/.test(value)) return true;
  // Spanish UI copy often has accents and no snake_case codes.
  if (/[áéíóúñü¿¡]/i.test(value)) return true;
  return false;
}

function parsePrefixedStatus(raw: string): { prefix: string; status: number } | null {
  const m = raw.trim().match(/^([a-z][a-z0-9_]*)_(\d{3})$/i);
  if (!m) return null;
  const status = Number(m[2]);
  if (!Number.isFinite(status)) return null;
  return { prefix: m[1]!.toLowerCase(), status };
}

/** Format a thrown API code (or Error) for admin / operator-facing banners. */
export function httpStatusErrorMessage(err: unknown, fallback = "No se pudo completar la acción."): string {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).trim();
  if (!raw) return fallback;

  if (KNOWN_CODE_MESSAGES[raw]) {
    return `${KNOWN_CODE_MESSAGES[raw]}\n\n(código: ${raw})`;
  }

  // admin_report_ban_403 style: action embedded before status
  const reportAction = raw.match(/^admin_report_([a-z0-9_]+)_(\d{3})$/i);
  if (reportAction) {
    const status = Number(reportAction[2]);
    const action = reportAction[1]!;
    const hint = statusHint(status);
    const tips = hint.tips.map((t) => `• ${t}`).join("\n");
    return [
      `No se pudo aplicar la acción de reporte “${action}”. El servidor respondió ${hint.label}: ${hint.meaning}.`,
      "",
      "Qué probar:",
      tips,
      "",
      `(código: ${raw})`,
    ].join("\n");
  }

  const parsed = parsePrefixedStatus(raw);
  if (parsed) {
    const action = ACTION_BY_PREFIX[parsed.prefix] ?? "completar la acción";
    const hint = statusHint(parsed.status);
    const tips = hint.tips.map((t) => `• ${t}`).join("\n");
    return [
      `No se pudo ${action}. El servidor respondió ${hint.label}: ${hint.meaning}.`,
      "",
      "Qué probar:",
      tips,
      "",
      `(código: ${raw})`,
    ].join("\n");
  }

  // Already human copy — keep it; still pass through.
  if (looksLikeProse(raw)) return raw;

  // Unknown snake_case — don't leave a bare code alone.
  if (/^[a-z][a-z0-9_]*$/i.test(raw)) {
    return `${fallback}\n\nQué probar:\n• Recarga e intenta de nuevo.\n• Si se repite, revisa logs en Railway.\n\n(código: ${raw})`;
  }

  return raw;
}

import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

const cred: RequestCredentials = "include";

const API_NET_ERR =
  "No se pudo contactar la API. Comprueba tu conexión o que el servidor en Railway esté en línea.";

async function networkFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(API_NET_ERR);
  }
}

/** Always true on Railway (same-origin `/api`); set `VITE_API_URL` only for local dev against another port. */
export function isAuthApiConfigured(): boolean {
  return true;
}

/** Full-page redirect URL to start Google OAuth (server sets session cookie on callback). */
export function googleSignInUrl(returnTo?: string): string {
  const base = apiBase();
  const path = "/api/auth/google";
  if (!returnTo?.trim()) return `${base}${path}`;
  return `${base}${path}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Full-page redirect URL to start Facebook OAuth. */
export function facebookSignInUrl(returnTo?: string): string {
  const base = apiBase();
  const path = "/api/auth/facebook";
  if (!returnTo?.trim()) return `${base}${path}`;
  return `${base}${path}?returnTo=${encodeURIComponent(returnTo)}`;
}

const GOOGLE_OAUTH_ERRORS: Record<string, string> = {
  google_denied: "Cancelaste el inicio de sesión con Google.",
  google_not_configured: "Google no está configurado en el servidor.",
  google_state_mismatch: "La sesión de Google expiró. Inténtalo de nuevo.",
  google_token_failed: "No pudimos validar tu cuenta de Google. Inténtalo de nuevo.",
  google_profile_failed: "Google no compartió tu correo. Elige otra cuenta o usa correo y contraseña.",
  google_account_failed: "No pudimos crear tu cuenta con Google.",
  google_oauth_failed: "Error al iniciar sesión con Google. Inténtalo de nuevo.",
};

const FACEBOOK_OAUTH_ERRORS: Record<string, string> = {
  facebook_denied: "Cancelaste el inicio de sesión con Facebook.",
  facebook_not_configured: "Facebook no está configurado en el servidor.",
  facebook_state_mismatch: "La sesión de Facebook expiró. Inténtalo de nuevo.",
  facebook_token_failed: "No pudimos validar tu cuenta de Facebook. Inténtalo de nuevo.",
  facebook_profile_failed: "Facebook no compartió tu perfil. Inténtalo de nuevo.",
  facebook_email_required:
    "Facebook no compartió tu correo. Autoriza el permiso de email o usa correo y contraseña.",
  facebook_account_failed: "No pudimos crear tu cuenta con Facebook.",
  facebook_oauth_failed: "Error al iniciar sesión con Facebook. Inténtalo de nuevo.",
};

const OAUTH_ERRORS: Record<string, string> = { ...GOOGLE_OAUTH_ERRORS, ...FACEBOOK_OAUTH_ERRORS };

export function googleOAuthErrorMessage(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return OAUTH_ERRORS[code] ?? GOOGLE_OAUTH_ERRORS.google_oauth_failed!;
}

export type AuthMe = {
  id: string;
  email: string | null;
  phoneE164: string | null;
  phoneNotifyOptIn: boolean;
  phoneMarketingOptIn: boolean;
  phonePromptDismissedAt: string | null;
  displayName: string;
  profilePictureUrl?: string | null;
  createdAt: string;
  linkedPublisherIds: string[];
  isAdmin?: boolean;
  emailVerified?: boolean;
  accountStatus?: "active" | "pending_validation";
  /** How the user signs in — drives which profile fields are editable here. */
  signInMethod?: "email" | "google" | "facebook" | "phone";
};

export function needsEmailVerification(me: AuthMe): boolean {
  if (!me.email?.trim()) return false;
  if (me.accountStatus === "pending_validation") return true;
  return me.emailVerified === false;
}

export async function authMe(signal?: AbortSignal): Promise<AuthMe | null> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/me`, { credentials: cred, signal });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth_me_${res.status}`);
  return (await res.json()) as AuthMe;
}

export type RegisterResult = {
  me: AuthMe;
  devCode?: string;
};

export async function authRegister(
  body: { email: string; password: string; displayName?: string },
  signal?: AbortSignal,
): Promise<RegisterResult> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (res.status === 405) {
      throw new Error(
        "El servidor no acepta POST en /api (405). Sirve el front desde el mismo proceso que la API o configura un proxy /api hacia Node.",
      );
    }
    throw new Error(j.message || j.error || `register_${res.status}`);
  }
  const reg = (await res.json().catch(() => ({}))) as {
    devCode?: string;
  };
  const me = await authMe(signal);
  if (!me) throw new Error("register_session_missing");
  return { me, ...(reg.devCode ? { devCode: reg.devCode } : {}) };
}

export async function authLogin(
  body: { email: string; password: string },
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (j.error === "user_not_found") {
      throw new Error("No existe una cuenta con ese correo (o estás pegándole a otra API / otra base).");
    }
    if (j.error === "invalid_password" || j.error === "invalid_credentials") {
      throw new Error("Correo o contraseña incorrectos.");
    }
    if (j.error === "wa_only_account") {
      throw new Error(
        "Esta cuenta no tiene contraseña y el acceso por código WhatsApp está desactivado. Contacta soporte si necesitas recuperarla.",
      );
    }
    if (j.error === "google_only_account") {
      throw new Error("Esta cuenta usa Google para entrar. Usa «Continuar con Google».");
    }
    if (j.error === "facebook_only_account") {
      throw new Error(
        "Esta cuenta usa Facebook para entrar. El inicio con Facebook no está disponible por ahora; contacta a contacto@bestie.mx.",
      );
    }
    throw new Error(j.error || `login_${res.status}`);
  }
}

export async function authVerifyEmail(code: string, signal?: AbortSignal): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ code }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(j.error || `verify_email_${res.status}`);
  }
}

export async function authResendVerificationEmail(
  signal?: AbortSignal,
): Promise<{ devCode?: string }> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/email/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; devCode?: string };
  if (!res.ok) {
    if (j.error === "rate_limited") {
      throw new Error("Espera un momento antes de pedir otro código.");
    }
    throw new Error(j.error || `resend_verification_${res.status}`);
  }
  return j.devCode ? { devCode: j.devCode } : {};
}

export type UpdateMeBody = {
  displayName?: string;
  email?: string;
  currentPassword?: string;
  /** Celular en formato libre (+52… o 10 dígitos MX); usa `""` para borrar. */
  phone?: string;
  phoneNotifyOptIn?: boolean;
  phoneMarketingOptIn?: boolean;
  dismissPhonePrompt?: true;
  /** Server upload path (`/api/uploads/...`) or `null` to clear. */
  profilePictureUrl?: string | null;
};

export type UpdateMeResult = {
  ok: true;
  changed: boolean;
  emailChanged?: boolean;
  email?: string | null;
};

export async function authUpdateMe(body: UpdateMeBody, signal?: AbortSignal): Promise<UpdateMeResult> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof j.error === "string" ? j.error : `update_${res.status}`;
    if (err === "email_taken") {
      throw new Error("Ese correo ya está en uso en otra cuenta.");
    }
    if (err === "invalid_email") {
      throw new Error("Correo inválido.");
    }
    if (err === "invalid_display_name") {
      throw new Error("Nombre inválido.");
    }
    if (err === "invalid_phone") {
      throw new Error(
        typeof j.message === "string" ? j.message : "Número inválido (usa 10 dígitos o +52…).",
      );
    }
    if (err === "phone_taken") {
      throw new Error(typeof j.message === "string" ? j.message : "Ese número ya está en otra cuenta.");
    }
    if (err === "invalid_password") {
      throw new Error("Contraseña actual incorrecta.");
    }
    if (err === "unauthorized") {
      throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
    }
    throw new Error(typeof j.message === "string" ? j.message : err);
  }
  return {
    ok: true,
    changed: Boolean(j.changed),
    emailChanged: Boolean(j.emailChanged),
    email: typeof j.email === "string" ? j.email : null,
  };
}

export async function authChangePassword(
  body: { currentPassword: string; newPassword: string },
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (j.error === "invalid_password") {
      throw new Error("Contraseña actual incorrecta.");
    }
    if (j.error === "password_too_short") {
      throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    if (j.error === "wa_only_account") {
      throw new Error(
        "Esta cuenta solo usa WhatsApp OTP; no tiene contraseña. Agrega un correo para poder usar contraseña.",
      );
    }
    throw new Error(j.message || j.error || `change_password_${res.status}`);
  }
}

export async function authForgotPassword(
  email: string,
  signal?: AbortSignal,
): Promise<{ devResetUrl?: string }> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; devResetUrl?: string; message?: string };
  if (!res.ok) {
    if (j.error === "rate_limited") {
      throw new Error("Espera un momento antes de volver a intentarlo.");
    }
    if (j.error === "invalid_email") {
      throw new Error("Correo inválido.");
    }
    throw new Error(j.error || `forgot_password_${res.status}`);
  }
  return j.devResetUrl ? { devResetUrl: j.devResetUrl } : {};
}

export async function authConsumePasswordReset(token: string, signal?: AbortSignal): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/password-reset/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ token }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (j.error === "token_invalid_or_expired") {
      throw new Error("El enlace expiró o ya se usó. Solicita uno nuevo.");
    }
    throw new Error(j.error || `password_reset_consume_${res.status}`);
  }
}

export async function authCompletePasswordReset(
  body: { token: string; newPassword: string },
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/password-reset/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    if (j.error === "token_invalid_or_expired") {
      throw new Error("El enlace expiró o ya se usó. Solicita uno nuevo.");
    }
    if (j.error === "password_too_short") {
      throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    throw new Error(j.message || j.error || `password_reset_complete_${res.status}`);
  }
}

export async function authLogout(signal?: AbortSignal): Promise<void> {
  const base = apiBase();
  await networkFetch(`${base}/api/auth/logout`, { method: "POST", credentials: cred, signal });
}

export async function authLinkPublisher(signal?: AbortSignal): Promise<boolean> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/link-publisher`, {
    method: "POST",
    credentials: cred,
    signal,
  });
  if (res.status === 401) return false;
  if (res.status === 409) return true;
  if (!res.ok) throw new Error(`link_publisher_${res.status}`);
  return true;
}

export type HandoffConsumeResult = {
  publisherId: string;
  draftPropertyId: string | null;
};

export async function consumeHandoffToken(
  token: string,
  signal?: AbortSignal,
): Promise<HandoffConsumeResult> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/handoff/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ token }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as {
    publisherId?: string;
    draftPropertyId?: string | null;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(j.error || `handoff_${res.status}`);
  }
  if (!j.publisherId) throw new Error("handoff_bad_response");
  return { publisherId: j.publisherId, draftPropertyId: j.draftPropertyId ?? null };
}

export async function analyticsHeartbeat(signal?: AbortSignal): Promise<void> {
  const base = apiBase();
  try {
    await networkFetch(`${base}/api/analytics/heartbeat`, {
      method: "POST",
      credentials: cred,
      signal,
    });
  } catch {
    /* offline / misconfigured API — ignore */
  }
}

export async function analyticsEvent(
  name: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  await fetch(`${base}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ name, payload }),
    signal,
  }).catch(() => null);
}

export async function fetchFeaturedCities(signal?: AbortSignal): Promise<string[]> {
  const base = apiBase();
  try {
    const res = await networkFetch(`${base}/api/analytics/featured-cities`, { signal });
    if (!res.ok) return [];
    const j = (await res.json()) as { cities?: unknown };
    return Array.isArray(j.cities) ? j.cities.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const ADMIN_USER_SEGMENTS = ["real", "pending", "staff", "all"] as const;
export type AdminUserSegment = (typeof ADMIN_USER_SEGMENTS)[number];
export type AdminUserRole = "user" | "admin" | "system";

export type AdminUserRow = {
  id: string;
  email: string | null;
  phoneLast4: string | null;
  displayName: string;
  createdAt: string;
  /** True when `email_verified_at` is set (OTP or trusted OAuth). */
  emailVerified: boolean;
  accountStatus: "active" | "pending_validation";
  role: AdminUserRole;
};

export type AdminUserCounts = {
  real: number;
  pending: number;
  staff: number;
  all: number;
};

export type AdminNavCounts = {
  verifiedUsers: number;
  publishedPosts: number;
  unreadSupportMessages: number;
  unreviewedReportedPosts: number;
};

export async function adminNavCounts(signal?: AbortSignal): Promise<AdminNavCounts> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/nav-counts`, { credentials: cred, signal });
  if (!res.ok) throw new Error(`admin_nav_counts_${res.status}`);
  return (await res.json()) as AdminNavCounts;
}

export async function adminListUsers(
  opts: { limit?: number; offset?: number; segment?: AdminUserSegment } = {},
  signal?: AbortSignal,
): Promise<{ users: AdminUserRow[]; total: number; counts: AdminUserCounts; segment: AdminUserSegment }> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  if (opts.segment) q.set("segment", opts.segment);
  const res = await networkFetch(`${base}/api/admin/users?${q}`, { credentials: cred, signal });
  if (!res.ok) throw new Error(`admin_users_${res.status}`);
  return (await res.json()) as {
    users: AdminUserRow[];
    total: number;
    counts: AdminUserCounts;
    segment: AdminUserSegment;
  };
}

export async function adminPatchPropertyStatus(
  propertyId: string,
  status: "draft" | "published" | "paused" | "archived",
  signal?: AbortSignal,
): Promise<{ propertyId: string; status: string }> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/properties/${encodeURIComponent(propertyId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ status }),
    signal,
  });
  if (!res.ok) throw new Error(`admin_status_${res.status}`);
  return (await res.json()) as { propertyId: string; status: string };
}

export type AdminPostStatus = "draft" | "published" | "paused" | "archived";

/** How the listing entered Bestie — admin Posts badges. */
export type AdminPostCreateOrigin = "manual" | "ai_admin" | "ai_user";

export type AdminPostRow = {
  propertyId: string;
  shortId: string;
  postMode: "room" | "property";
  title: string;
  city: string;
  neighborhood: string;
  status: AdminPostStatus;
  createdAt: string | null;
  publishedAt: string | null;
  wizardStep: number | null;
  wizardStepLabel: string | null;
  creatorLoggedIn: boolean;
  creatorUserId: string | null;
  creatorDisplayName: string | null;
  creatorEmail: string | null;
  feedbackCompleted: boolean;
  feedbackRating: number | null;
  feedbackComment: string | null;
  feedbackAt: string | null;
  posthogSessionId: string | null;
  posthogReplayUrl: string | null;
  viewPath: string;
  editPath: string;
  primaryRoomId: string | null;
  /**
   * Unique listing conversation threads under this property (one per seeker × room).
   * Shown as "Mensajes" in admin Posts — not raw message count.
   */
  messageThreadCount?: number;
  assistedDraft: boolean;
  /** Prefer this for badges; falls back to assistedDraft on older API responses. */
  createOrigin?: AdminPostCreateOrigin;
  hasReport?: boolean;
  reportReviewed?: boolean;
  reportConversationId?: string | null;
  reportCount?: number;
};

export const ADMIN_POSTS_PAGE_SIZES = [10, 25, 50, 100] as const;

export async function adminListPosts(
  opts: {
    q?: string;
    status?: AdminPostStatus | "all" | "reported";
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<{ posts: AdminPostRow[]; total: number; limit: number; offset: number }> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (opts.q?.trim()) q.set("q", opts.q.trim());
  if (opts.status && opts.status !== "all") q.set("status", opts.status);
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  const res = await networkFetch(`${base}/api/admin/posts${qs ? `?${qs}` : ""}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_posts_${res.status}`);
  return (await res.json()) as {
    posts: AdminPostRow[];
    total: number;
    limit: number;
    offset: number;
  };
}

export async function adminGetFeaturedCities(signal?: AbortSignal): Promise<string[]> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/settings/featured-cities`, { credentials: cred, signal });
  if (!res.ok) throw new Error(`admin_fc_get_${res.status}`);
  const j = (await res.json()) as { cities: string[] };
  return j.cities ?? [];
}

export async function adminPutFeaturedCities(
  cities: string[],
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/settings/featured-cities`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ cities }),
    signal,
  });
  if (!res.ok) throw new Error(`admin_fc_put_${res.status}`);
}

export async function adminAnalyticsSummary(signal?: AbortSignal): Promise<{
  publishedPropertyCount: number;
  dauPublishersApprox: number;
  day: string;
}> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/analytics/summary`, { credentials: cred, signal });
  if (!res.ok) throw new Error(`admin_analytics_${res.status}`);
  return (await res.json()) as {
    publishedPropertyCount: number;
    dauPublishersApprox: number;
    day: string;
  };
}

export type AdminStreetViewAnalytics = {
  month: string;
  monthStart: string;
  monthEnd: string;
  dynamicStreetView: {
    total: number;
    freeTierLimit: number;
    billableOverage: number;
    estimatedOverageUsd: number;
    byInterface: Record<string, number>;
    daily: { day: string; total: number }[];
  };
  lockedEmbedViews: {
    total: number;
    byInterface: Record<string, number>;
  };
  pricing: {
    sourceUrl: string;
    lastVerified: string;
    dynamicStreetViewUsdPer1000: number;
    note: string;
  };
};

export async function adminStreetViewAnalytics(
  month?: string,
  signal?: AbortSignal,
): Promise<AdminStreetViewAnalytics> {
  const base = apiBase();
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  const res = await networkFetch(`${base}/api/admin/analytics/street-view${q}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_street_view_${res.status}`);
  return (await res.json()) as AdminStreetViewAnalytics;
}

export type AdminUsageAnalytics = {
  month: string;
  monthStart: string;
  monthEnd: string;
  resend: {
    sent: number;
    received: number;
    quotaUnits: number;
    dailyLimit: number;
    monthlyLimit: number;
    today: { sent: number; received: number; quotaUnits: number };
    byCategory: Record<string, number>;
    byChannel: Record<string, number>;
    receivedByKind: Record<string, number>;
    pricing: { sourceUrl: string; lastVerified: string; note: string };
  };
  gemini: {
    calls: number;
    templateFallback: number;
    storedCacheHits: number;
    promptTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    byModel: { promptTokens: Record<string, number>; outputTokens: Record<string, number> };
    pricing: {
      sourceUrl: string;
      lastVerified: string;
      inputUsdPer1M: number;
      outputUsdPer1M: number;
      note: string;
    };
  };
  posthog: {
    configured: boolean;
    available: boolean;
    error: string | null;
    month: string;
    monthStart: string;
    monthEnd: string;
    recordings: {
      total: number;
      freeTierLimit: number;
      billableOverage: number;
      estimatedOverageUsd: number;
    };
    events: {
      total: number;
      freeTierLimit: number;
      billableOverage: number;
      estimatedOverageUsd: number;
      uniquePersons: number;
    };
    exceptions: { total: number };
    pricing: {
      sourceUrl: string;
      billingUrl: string;
      lastVerified: string;
      recordingsUsdEach: number;
      eventsUsdEach: number;
      note: string;
    };
    links: { replayHome: string; billing: string };
  };
  whatsappOtp: {
    trackedSends: number;
    byResult: Record<string, number>;
    challengesCreated: number;
    note: string;
  };
  storage: { blobCount: number; totalBytes: number; totalBytesLabel: string };
  notes: string[];
  assistedDraft: {
    calls: number;
    promptTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    avgUsdPerCall: number;
    byModel: Record<string, number>;
    dailyCalls: { day: string; value: number }[];
    pricing: {
      sourceUrl: string;
      lastVerified: string;
      inputUsdPer1M: number;
      outputUsdPer1M: number;
      note: string;
    };
  };
};

export async function adminUsageAnalytics(
  month?: string,
  signal?: AbortSignal,
): Promise<AdminUsageAnalytics> {
  const base = apiBase();
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  const res = await networkFetch(`${base}/api/admin/analytics/usage${q}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_usage_${res.status}`);
  return (await res.json()) as AdminUsageAnalytics;
}

export type AdminImageUploadAnalytics = {
  windowHours: number;
  summary: {
    total: number;
    ok: number;
    fail: number;
    byStep: Record<string, { ok: number; fail: number }>;
    byErrorCode: Record<string, number>;
    bySource: Record<string, { ok: number; fail: number }>;
    mobileFailRate: number | null;
  };
  today: { ok: number; fail: number; topErrors: { code: string; count: number }[] };
  events: {
    id: string;
    createdAt: string;
    publisherId: string;
    userId: string | null;
    step: string | null;
    ok: boolean | null;
    errorCode: string | null;
    error: string | null;
    source: string | null;
    surface: string | null;
    declaredMime: string | null;
    sniffedMime: string | null;
    decodePath: string | null;
    nameExt: string | null;
    nameKind: string | null;
    inputBytes: number | null;
    ms: number | null;
    mobileLike: boolean | null;
    httpStatus: number | null;
  }[];
};

export async function adminImageUploadAnalytics(
  opts: { hours?: number; limit?: number; failuresOnly?: boolean } = {},
  signal?: AbortSignal,
): Promise<AdminImageUploadAnalytics> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (opts.hours != null) q.set("hours", String(opts.hours));
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.failuresOnly) q.set("failuresOnly", "1");
  const qs = q.toString();
  const res = await networkFetch(`${base}/api/admin/analytics/image-uploads${qs ? `?${qs}` : ""}`, {
    credentials: cred,
    signal,
  });
  if (!res.ok) throw new Error(`admin_image_uploads_${res.status}`);
  return (await res.json()) as AdminImageUploadAnalytics;
}

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  min_age: number | null;
  max_age: number | null;
  min_income_mxn: number | null;
  member_count: number;
};

export type AdminSupportConversationRow = {
  id: string;
  subject: string;
  kind?: "support" | "feedback" | "blog" | "report";
  reportCount?: number;
  updatedAt: string;
  customerUserId: string;
  customerDisplayName: string;
  customerEmail: string | null;
  lastPreview: string;
  unreadCount: number;
};

export async function adminListSupportConversations(
  opts?: { q?: string; kind?: "all" | "support" | "feedback" | "blog" | "report"; signal?: AbortSignal },
): Promise<AdminSupportConversationRow[]> {
  const base = apiBase();
  const params = new URLSearchParams();
  const q = opts?.q?.trim();
  if (q) params.set("q", q);
  if (opts?.kind && opts.kind !== "all") params.set("kind", opts.kind);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  const res = await networkFetch(`${base}/api/admin/support/conversations${qs}`, {
    credentials: cred,
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`admin_support_list_${res.status}`);
  const j = (await res.json()) as { conversations?: AdminSupportConversationRow[] };
  return j.conversations ?? [];
}

export type AdminSupportMessage = {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  senderIsCustomer: boolean;
  body: string;
  createdAt: string;
  attachments: { url: string; mimeType: string; size: number; filename: string }[];
};

export type AdminSupportThread = {
  subject: string;
  kind?: "support" | "feedback" | "blog" | "report";
  reportCount?: number;
  customer: { id: string; displayName: string; email: string | null } | null;
  messages: AdminSupportMessage[];
};

export async function adminFetchSupportThread(
  conversationId: string,
  signal?: AbortSignal,
): Promise<AdminSupportThread> {
  const base = apiBase();
  const res = await networkFetch(
    `${base}/api/admin/support/conversations/${encodeURIComponent(conversationId)}/messages`,
    { credentials: cred, signal },
  );
  if (!res.ok) throw new Error(`admin_support_thread_${res.status}`);
  return (await res.json()) as AdminSupportThread;
}

export async function adminStartSupportConversation(
  input: { userId: string; subject?: string },
  signal?: AbortSignal,
): Promise<{ conversationId: string; created: boolean }> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/support/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ userId: input.userId, subject: input.subject }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as {
    conversationId?: string;
    created?: boolean;
    error?: string;
  };
  if (!res.ok) {
    if (j.error === "invalid_user") {
      throw new Error("Esta cuenta de sistema no admite chat de soporte.");
    }
    if (j.error === "not_found") {
      throw new Error("No encontramos a esa persona.");
    }
    throw new Error(j.error || `admin_support_start_${res.status}`);
  }
  if (!j.conversationId) throw new Error("missing_conversation");
  return { conversationId: j.conversationId, created: Boolean(j.created) };
}

export async function adminReplySupportThread(
  conversationId: string,
  body: string,
  attachments: { url: string; mimeType: string; size: number; filename: string }[] = [],
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(
    `${base}/api/admin/support/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders() },
      credentials: cred,
      body: JSON.stringify({ body, attachments }),
      signal,
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `admin_support_reply_${res.status}`);
  }
}

export async function groupsMine(signal?: AbortSignal): Promise<GroupRow[]> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/groups/mine`, { credentials: cred, signal });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`groups_mine_${res.status}`);
  return (await res.json()) as GroupRow[];
}

export async function groupsCreate(
  body: { name: string; minAge?: number; maxAge?: number; minIncomeMxn?: number },
  signal?: AbortSignal,
): Promise<{ id: string; name: string; inviteCode: string }> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/groups/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`groups_create_${res.status}`);
  return (await res.json()) as { id: string; name: string; inviteCode: string };
}

export async function groupsJoin(inviteCode: string, signal?: AbortSignal): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/groups/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ inviteCode }),
    signal,
  });
  if (!res.ok) throw new Error(`groups_join_${res.status}`);
}

export type AdminReportContext = {
  report: {
    id: string;
    conversationId: string;
    targetType: string;
    targetRoomId: string | null;
    targetPropertyId: string | null;
    targetChatConversationId: string | null;
    publisherUserId: string | null;
    reportCount: number;
    reviewedAt: string | null;
  };
  stats: {
    reportsAgainstPost: number;
    reportsAgainstPublisherPosts: number;
    postsReportedForPublisher: number;
    reportsFiledByUser: number;
    abuseFlagsForReporter: number;
  };
  postUrl: string | null;
  editPath: string | null;
  propertyStatus: string | null;
  pausedBy: string | null;
  latestReporterId: string | null;
  reporters: {
    eventId: string;
    reporterUserId: string | null;
    categories: string[];
    detailText: string | null;
    photoUrl: string | null;
    photoIndex: number | null;
    createdAt: string;
  }[];
  chatHistory: { id: string; senderUserId: string; body: string; createdAt: string }[];
};

export async function adminFetchReportContext(
  conversationId: string,
  opts?: { historyDays?: number; signal?: AbortSignal },
): Promise<AdminReportContext> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (opts?.historyDays != null) q.set("historyDays", String(opts.historyDays));
  const qs = q.size ? `?${q}` : "";
  const res = await networkFetch(
    `${base}/api/admin/reports/conversations/${encodeURIComponent(conversationId)}/context${qs}`,
    { credentials: cred, signal: opts?.signal },
  );
  if (!res.ok) throw new Error(`admin_report_context_${res.status}`);
  return (await res.json()) as AdminReportContext;
}

export async function adminReportAction(
  conversationId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<{ conversationId?: string }> {
  const base = apiBase();
  const res = await networkFetch(
    `${base}/api/admin/reports/conversations/${encodeURIComponent(conversationId)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders() },
      credentials: cred,
      body: JSON.stringify(body ?? {}),
    },
  );
  if (!res.ok) throw new Error(`admin_report_${action}_${res.status}`);
  return (await res.json().catch(() => ({}))) as { conversationId?: string };
}

export async function adminMarkReportReviewed(conversationId: string): Promise<void> {
  await adminReportAction(conversationId, "mark-reviewed");
}

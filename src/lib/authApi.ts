import { apiBase } from "@/lib/apiBase";
import { deviceHeaders } from "@/lib/deviceFingerprint";

const cred: RequestCredentials = "include";

const API_NET_ERR =
  "No se pudo contactar la API. Si el sitio está en GitHub Pages, añade el secreto del repositorio VITE_API_URL con la URL pública del servidor (sin / al final; p. ej. https://tu-app.up.railway.app).";

async function networkFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(API_NET_ERR);
  }
}

/** Always true: same-origin `/api` is valid; set `VITE_API_URL` only for a separate API host. */
export function isAuthApiConfigured(): boolean {
  return true;
}

export type AuthMe = {
  id: string;
  email: string | null;
  phoneE164: string | null;
  displayName: string;
  createdAt: string;
  linkedPublisherIds: string[];
  isAdmin?: boolean;
  emailVerified?: boolean;
};

export async function authMe(signal?: AbortSignal): Promise<AuthMe | null> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/me`, { credentials: cred, signal });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth_me_${res.status}`);
  return (await res.json()) as AuthMe;
}

export type RegisterResult = {
  me: AuthMe;
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
  await res.json().catch(() => ({}));
  const me = await authMe(signal);
  if (!me) throw new Error("register_session_missing");
  return { me };
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
      throw new Error("Esta cuenta fue creada con WhatsApp OTP. Entra con WhatsApp desde la página completa.");
    }
    throw new Error(j.error || `login_${res.status}`);
  }
}

export type UpdateMeBody = {
  displayName?: string;
  email?: string;
  currentPassword?: string;
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

export type WaRequestResult =
  | { ok: true; devCode?: string; message?: string }
  | { ok: false; error: string; retryAfterMs?: number };

export async function authWhatsAppRequest(
  phone: string,
  signal?: AbortSignal,
): Promise<WaRequestResult> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/whatsapp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ phone }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: String(j.error ?? "request_failed"),
      retryAfterMs: typeof j.retryAfterMs === "number" ? j.retryAfterMs : undefined,
    };
  }
  return {
    ok: true,
    devCode: typeof j.devCode === "string" ? j.devCode : undefined,
    message: typeof j.message === "string" ? j.message : undefined,
  };
}

export async function authWhatsAppVerify(
  body: { phone: string; code: string },
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/auth/whatsapp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `verify_${res.status}`);
  }
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

export type AdminUserRow = {
  id: string;
  email: string | null;
  phoneLast4: string | null;
  displayName: string;
  createdAt: string;
};

export async function adminListUsers(
  opts: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<{ users: AdminUserRow[]; total: number }> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const res = await networkFetch(`${base}/api/admin/users?${q}`, { credentials: cred, signal });
  if (!res.ok) throw new Error(`admin_users_${res.status}`);
  return (await res.json()) as { users: AdminUserRow[]; total: number };
}

export async function adminPatchPropertyStatus(
  propertyId: string,
  status: "draft" | "published" | "paused" | "archived",
  signal?: AbortSignal,
): Promise<void> {
  const base = apiBase();
  const res = await networkFetch(`${base}/api/admin/properties/${encodeURIComponent(propertyId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...deviceHeaders() },
    credentials: cred,
    body: JSON.stringify({ status }),
    signal,
  });
  if (!res.ok) throw new Error(`admin_status_${res.status}`);
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

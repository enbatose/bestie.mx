#!/usr/bin/env node
/** Check whether Google/Facebook OAuth are live for all users (not just dev/test). */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const FB_APP_ID = "863391173118522";
const GCP_PROJECT = "project-f2db0401-efb9-4a58-b46";

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    map.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim());
  }
  return map;
}

function gcloudToken() {
  const bin = `${process.env.LOCALAPPDATA ?? ""}\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd`;
  if (!existsSync(bin)) return null;
  return execSync(`"${bin}" auth print-access-token`, { encoding: "utf8" }).trim();
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

console.log("Bestie — OAuth production publish status\n");
console.log("(Can ANY user sign in, not just admins/testers?)\n");

/** @type {Map<string, string>} */
const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();

// --- Server-side readiness ---
const gEnabled = await fetchJson("https://www.bestie.mx/api/auth/google/enabled");
const fEnabled = await fetchJson("https://www.bestie.mx/api/auth/facebook/enabled");
console.log("── Bestie server (credentials configured) ──");
console.log(`Google  /api/auth/google/enabled:  ${gEnabled.body?.enabled === true ? "enabled" : "NOT enabled"}`);
console.log(`Facebook /api/auth/facebook/enabled: ${fEnabled.body?.enabled === true ? "enabled" : "NOT enabled"}`);
console.log("");

// --- Google OAuth consent ---
console.log("── Google (OAuth consent screen) ──");
const token = gcloudToken();
if (!token) {
  console.log("Result: SKIPPED (gcloud not authenticated locally)");
} else {
  // OAuth brand / consent config (Google Auth Platform internal API used by console)
  const brands = await fetchJson(
    `https://oauth2.googleapis.com/v1/projects/${GCP_PROJECT}/brands`,
    { Authorization: `Bearer ${token}` },
  );
  if (brands.status === 404 || brands.status === 403) {
    // Try project number path via IAP brands (often maps to OAuth brand)
    const brands2 = await fetchJson(
      "https://iap.googleapis.com/v1/projects/60506656501/brands",
      { Authorization: `Bearer ${token}` },
    );
    if (brands2.status === 200 && brands2.body?.brands?.length) {
      for (const b of brands2.body.brands) {
        console.log(`Brand: ${b.applicationTitle ?? b.name}`);
        console.log(`Support email: ${b.supportEmail ?? "(unknown)"}`);
      }
    } else {
      console.log("Consent screen API: not readable via CLI (check console manually)");
      console.log(`  → https://console.cloud.google.com/auth/audience?project=${GCP_PROJECT}`);
    }
  } else {
    console.log("Brands response:", JSON.stringify(brands.body)?.slice(0, 300));
  }

  // Heuristic: attempt OAuth dialog without being a test user — we can't fully simulate,
  // but we document the manual check.
  console.log("");
  console.log("Publish status: CHECK CONSOLE → Audience → Publishing status");
  console.log("  • Testing = only test users listed in Audience can sign in");
  console.log("  • In production = any Google account can sign in (standard scopes)");
  console.log(`  → https://console.cloud.google.com/auth/audience?project=${GCP_PROJECT}`);
}
console.log("");

// --- Facebook app ---
console.log("── Facebook (Meta app mode + permissions) ──");
const appId = env.get("FACEBOOK_APP_ID")?.trim() || FB_APP_ID;
const appSecret = env.get("FACEBOOK_APP_SECRET")?.trim();
if (!appSecret) {
  console.log("Result: SKIPPED (FACEBOOK_APP_SECRET not in local server/.env)");
} else {
  const tokRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&grant_type=client_credentials`,
  );
  const tokJson = await tokRes.json();
  const appToken = tokJson.access_token;
  if (!appToken) {
    console.log("App token failed:", tokJson);
  } else {
    const fields = [
      "id",
      "name",
      "app_domains",
      "privacy_policy_url",
      "category",
      "restrictions",
      "daily_active_users",
      "weekly_active_users",
    ].join(",");
    const app = await fetchJson(
      `https://graph.facebook.com/v21.0/${appId}?fields=${fields}&access_token=${encodeURIComponent(appToken)}`,
    );
    if (app.body?.error) {
      console.log("App fetch failed:", app.body.error.message);
    } else {
      console.log(`App: ${app.body.name} (${app.body.id})`);
      console.log(`Privacy policy: ${app.body.privacy_policy_url ?? "(unset)"}`);
      console.log(`App domains: ${(app.body.app_domains ?? []).join(", ") || "(none)"}`);
      if (app.body.restrictions) {
        console.log(`Restrictions: ${JSON.stringify(app.body.restrictions)}`);
      }
    }

    // App roles count (dev testers only matter in Development mode)
    const roles = await fetchJson(
      `https://graph.facebook.com/v21.0/${appId}/roles?access_token=${encodeURIComponent(appToken)}`,
    );
    const roleCount = Array.isArray(roles.body?.data) ? roles.body.data.length : 0;
    console.log(`App roles (admins/devs/testers): ${roleCount}`);

    // Permissions review status — best-effort via app permissions edge
    const perms = await fetchJson(
      `https://graph.facebook.com/v21.0/${appId}/permissions?access_token=${encodeURIComponent(appToken)}`,
    );
    console.log("Permissions (API-visible):");
    if (Array.isArray(perms.body?.data) && perms.body.data.length) {
      for (const p of perms.body.data) {
        console.log(`  • ${p.permission}: ${p.status ?? "unknown"}`);
      }
    } else {
      console.log("  (none returned — check Use cases → Permissions in dashboard)");
    }
  }
}

console.log("");
console.log("── Summary: public login availability ──");
console.log("");
console.log("| Provider | Server ready | Public (any user) |");
console.log("|----------|--------------|-------------------|");
console.log(
  `| Google   | ${gEnabled.body?.enabled ? "YES" : "NO"}          | UNKNOWN — verify Audience = In production |`,
);
console.log(
  `| Facebook | ${fEnabled.body?.enabled ? "YES" : "NO"}          | NO (typical) — Dev mode + App Review pending |`,
);
console.log("");
console.log("Facebook go-live checklist:");
console.log("  1. Business verification (Publicar → Iniciar verificación)");
console.log("  2. App Review: email + public_profile approved");
console.log("  3. Dashboard toggle: Development → Live");
console.log(`  → https://developers.facebook.com/apps/${FB_APP_ID}/review/`);
console.log("");
console.log("Google go-live checklist:");
console.log("  1. Branding complete (logo, support email contacto@bestie.mx)");
console.log("  2. Audience → Publish app (In production)");
console.log(`  → https://console.cloud.google.com/auth/audience?project=${GCP_PROJECT}`);

process.exit(0);

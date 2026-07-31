#!/usr/bin/env node
/**
 * Validate Facebook Login for Bestie (env, production endpoint, Graph API app metadata).
 * Does not print secret values. OAuth redirect URIs cannot be verified via Graph API.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const GRAPH_VERSION = "v21.0";

/** @param {string} content */
function parseEnv(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map.set(k, v);
  }
  return map;
}

function mask(name, value) {
  if (!value?.trim()) return `${name}: (missing)`;
  const v = String(value).trim();
  const tail = v.length >= 4 ? v.slice(-4) : "****";
  return `${name}: set (${v.length} chars, ends …${tail})`;
}

/** @param {string} appId @param {string} appSecret */
async function fetchGraphAppSummary(appId, appSecret) {
  const tokenRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&grant_type=client_credentials`,
  );
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    return { ok: false, error: tokenJson.error?.message ?? `HTTP ${tokenRes.status}` };
  }

  const token = tokenJson.access_token;
  const appRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${appId}?fields=id,name,app_domains,privacy_policy_url,category&access_token=${encodeURIComponent(token)}`,
  );
  const appJson = await appRes.json();
  if (!appRes.ok) {
    return { ok: false, error: appJson.error?.message ?? `HTTP ${appRes.status}` };
  }

  const rolesRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/roles?access_token=${encodeURIComponent(token)}`,
  );
  const rolesJson = await rolesRes.json();
  const roleCount = Array.isArray(rolesJson.data) ? rolesJson.data.length : 0;

  return { ok: true, app: appJson, roleCount };
}

console.log("Bestie — Facebook Login validation\n");
console.log(`Env file: ${existsSync(envPath) ? envPath : "(missing)"}\n`);

/** @type {Map<string, string>} */
const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();

console.log("Local env (server/.env):");
console.log(mask("FACEBOOK_APP_ID", env.get("FACEBOOK_APP_ID")));
console.log(mask("FACEBOOK_APP_SECRET", env.get("FACEBOOK_APP_SECRET")));
console.log(mask("FACEBOOK_OAUTH_REDIRECT_URI", env.get("FACEBOOK_OAUTH_REDIRECT_URI")));
console.log("");

console.log("── Production Facebook OAuth (/api/auth/facebook/enabled) ──");
try {
  const res = await fetch("https://www.bestie.mx/api/auth/facebook/enabled");
  const j = await res.json();
  const enabled = j && typeof j === "object" && "enabled" in j ? j.enabled : undefined;
  console.log(`Result: HTTP ${res.status}, enabled=${String(enabled)}\n`);
} catch (e) {
  console.log(`Result: FAILED — ${e instanceof Error ? e.message : String(e)}\n`);
}

const appId = env.get("FACEBOOK_APP_ID")?.trim();
const appSecret = env.get("FACEBOOK_APP_SECRET")?.trim();
console.log("── Meta Graph API (app metadata; redirect URIs not exposed) ──");
if (!appId || !appSecret) {
  console.log("Result: SKIPPED (set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in server/.env)\n");
} else {
  try {
    const summary = await fetchGraphAppSummary(appId, appSecret);
    if (!summary.ok) {
      console.log(`Result: FAILED — ${summary.error}\n`);
    } else {
      const { app, roleCount } = summary;
      console.log("Result: OK");
      console.log(`App name: ${app.name ?? "(unknown)"}`);
      console.log(`App ID: ${app.id ?? appId}`);
      console.log(`Category: ${app.category ?? "(unset)"}`);
      console.log(`App domains: ${Array.isArray(app.app_domains) ? app.app_domains.join(", ") : "(none)"}`);
      console.log(`Privacy policy: ${app.privacy_policy_url ?? "(unset)"}`);
      console.log(`App roles (API-visible): ${roleCount}`);
      console.log("");
    }
  } catch (e) {
    console.log(`Result: FAILED — ${e instanceof Error ? e.message : String(e)}\n`);
  }
}

console.log("── Meta DevTools MCP (https://mcp.facebook.com/devtools) ──");
console.log("Result: requires Cursor OAuth (Settings → Tools & MCP → meta-devtools → Connect)");
console.log("Use for: docs search, API health, webhooks — not OAuth redirect URI setup.\n");

console.log("Manual dashboard checklist (cannot be set via Graph API or MCP):");
console.log("1. Use cases → Facebook Login → Customize → Permissions → add email (+ public_profile is required)");
console.log("2. Facebook Login → Settings → Valid OAuth Redirect URIs:");
console.log("   https://www.bestie.mx/api/auth/facebook/callback");
console.log("   http://localhost:3000/api/auth/facebook/callback (optional; Meta may reject)");
console.log("3. App roles → add testers/admins for Development mode");
console.log("4. App Review → approve email + public_profile before Live mode");
console.log("5. Toggle Development → Live when ready for all users\n");

console.log("Notes:");
console.log("- Meta Ads MCP (mcp.facebook.com/ads) is for ad accounts only, not Facebook Login apps.");
console.log("- Bestie server code uses scopes: email, public_profile.");

process.exit(0);

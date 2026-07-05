#!/usr/bin/env node
/**
 * OAuth go-live checklist for Bestie (Google + Facebook).
 * Server/Railway config is automated; provider "Publish/Live" requires console clicks.
 *
 * Usage: npm run oauth:golive
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const LOGO = resolve(root, "public", "brand", "meta-app-icon-1024.png");
const SUPPORT = "contacto@bestie.mx";
const GCP_PROJECT = "project-f2db0401-efb9-4a58-b46";
const FB_APP_ID = "863391173118522";

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

async function check(url) {
  try {
    const r = await fetch(url);
    const j = await r.json();
    return { ok: r.ok, body: j };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

console.log("Bestie — OAuth go-live checklist\n");
console.log("Support / contact email:", SUPPORT);
console.log("App logo (1024×1024):", existsSync(LOGO) ? LOGO : "(missing)");
console.log("");

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();
const googleOk = !!(env.get("GOOGLE_OAUTH_CLIENT_ID") && env.get("GOOGLE_OAUTH_CLIENT_SECRET"));
const fbOk = !!(env.get("FACEBOOK_APP_ID") && env.get("FACEBOOK_APP_SECRET"));
console.log("Server env (local): Google", googleOk ? "OK" : "MISSING", "| Facebook", fbOk ? "OK" : "MISSING");

const g = await check("https://www.bestie.mx/api/auth/google/enabled");
const f = await check("https://www.bestie.mx/api/auth/facebook/enabled");
console.log(
  "Production endpoints:",
  `Google enabled=${g.body?.enabled ?? "?"}`,
  "|",
  `Facebook enabled=${f.body?.enabled ?? "?"}`,
);
console.log("");

console.log("── Automated (already done) ──");
console.log("✓ Bestie server routes + UI buttons");
console.log("✓ Railway env vars (GOOGLE_OAUTH_*, FACEBOOK_*)");
console.log("✓ Facebook redirect URI: https://www.bestie.mx/api/auth/facebook/callback");
console.log("✓ Facebook Basic: privacy policy, category, app domain bestie.mx");
console.log("");

console.log("── Cannot automate (API/MCP limits) ──");
console.log("• Google: Publish OAuth consent screen (Google Auth Platform → Audience → Publish app)");
console.log("• Facebook: App Review for email + public_profile, then Development → Live toggle");
console.log("• Facebook Graph API returns error #10 for app setting changes unless enabled in Advanced");
console.log("• Meta DevTools MCP: docs/webhooks only — not Facebook Login app config");
console.log("• Meta Ads MCP: ad accounts only");
console.log("");

console.log("── Google: publish for all users ──");
console.log(`1. Branding: https://console.cloud.google.com/auth/branding?project=${GCP_PROJECT}`);
console.log("   App name: Bestie");
console.log(`   User support email: ${SUPPORT}`);
console.log("   App logo: upload meta-app-icon-1024.png");
console.log("   App home page: https://www.bestie.mx");
console.log("   Privacy policy: https://www.bestie.mx/legal/privacidad");
console.log("   Terms of service: https://www.bestie.mx/legal/terminos");
console.log("   Authorized domains: bestie.mx");
console.log(`2. Audience: https://console.cloud.google.com/auth/audience?project=${GCP_PROJECT}`);
console.log("   User type: External → Publish app (Testing → In production)");
console.log("   Scopes: openid, email, profile only — no extra verification for sign-in");
console.log(`3. Clients: https://console.cloud.google.com/auth/clients?project=${GCP_PROJECT}`);
console.log("   Redirect URI: https://www.bestie.mx/api/auth/google/callback");
console.log("");

console.log("── Facebook: live for all users ──");
console.log(`1. Basic: https://developers.facebook.com/apps/${FB_APP_ID}/settings/basic/`);
console.log(`   Contact email: ${SUPPORT} | Icon: meta-app-icon-1024.png`);
console.log(`2. Permissions: https://developers.facebook.com/apps/${FB_APP_ID}/use_cases/customize/?use_case=fb_login&selected_tab=permissions`);
console.log("   email + public_profile added");
console.log(`3. App Review: https://developers.facebook.com/apps/${FB_APP_ID}/app-review/permissions/`);
console.log("   Request Advanced/Standard access for email + public_profile");
console.log("   Demo: sign in on bestie.mx → Facebook button → return logged in");
console.log(`4. Toggle Live on app dashboard (top) after review`);
console.log("");

console.log("Validate anytime: npm run google:validate && npm run facebook:validate");

process.exit(0);

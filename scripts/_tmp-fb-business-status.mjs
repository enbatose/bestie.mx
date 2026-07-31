#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const APP_ID = "863391173118522";
const V = "v21.0";

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

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();
const appId = env.get("FACEBOOK_APP_ID")?.trim() || APP_ID;
const appSecret = env.get("FACEBOOK_APP_SECRET")?.trim();
if (!appSecret) {
  console.error("Missing FACEBOOK_APP_SECRET in server/.env");
  process.exit(1);
}

async function appToken() {
  const res = await fetch(
    `https://graph.facebook.com/${V}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&grant_type=client_credentials`,
  );
  const json = await res.json();
  if (!json.access_token) throw new Error(JSON.stringify(json));
  return json.access_token;
}

async function graph(path, params = {}) {
  const token = await appToken();
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${V}/${path}?${qs}`);
  return res.json();
}

async function graphBusiness(businessId, fields) {
  const token = await appToken();
  const qs = new URLSearchParams({ fields, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${V}/${businessId}?${qs}`);
  return res.json();
}

console.log("Meta business verification status check\n");

const app = await graph(appId, {
  fields: "id,name,app_domains,privacy_policy_url,category,restrictions,contact_email,user_support_email,company,created_time",
});
console.log("── App ──");
if (app.error) {
  console.log("Error:", app.error.message);
} else {
  console.log(`Name: ${app.name} (${app.id})`);
  console.log(`Category: ${app.category ?? "(unset)"}`);
  console.log(`Domains: ${(app.app_domains ?? []).join(", ") || "(none)"}`);
  console.log(`Privacy: ${app.privacy_policy_url ?? "(unset)"}`);
  console.log(`Contact email: ${app.contact_email ?? app.user_support_email ?? "(unset)"}`);
  console.log(`Company field: ${app.company ?? "(unset)"}`);
  if (app.restrictions) console.log(`Restrictions: ${JSON.stringify(app.restrictions)}`);
}

const roles = await graph(`${appId}/roles`);
console.log("\n── App roles ──");
if (roles.error) console.log("Error:", roles.error.message);
else console.log(`Count: ${roles.data?.length ?? 0}`);

// Business verification requires business portfolio ID + user/system token in many cases.
// Try app-linked business hints and any business IDs passed as CLI args.
const cliBusinessIds = process.argv.slice(2);
const candidateIds = [...new Set([...cliBusinessIds])];

console.log("\n── Business verification_status (needs portfolio ID) ──");
if (!candidateIds.length) {
  console.log("No business portfolio ID provided — app token cannot list your businesses.");
  console.log("Find it: Meta Business Suite → Settings → Business info → Business portfolio ID");
  console.log("Or: business.facebook.com/settings → Business portfolio ID");
} else {
  for (const id of candidateIds) {
    const biz = await graphBusiness(id, "id,name,verification_status,created_time,updated_time,timezone_id,primary_page");
    console.log(`\nBusiness ${id}:`);
    if (biz.error) {
      console.log(`  Error: ${biz.error.message} (code ${biz.error.code})`);
    } else {
      console.log(`  Name: ${biz.name}`);
      console.log(`  verification_status: ${biz.verification_status ?? "(unknown)"}`);
      if (biz.primary_page) console.log(`  primary_page: ${JSON.stringify(biz.primary_page)}`);
    }
  }
}

console.log("\n── Manual dashboard links ──");
console.log(`App review: https://developers.facebook.com/apps/${appId}/review/`);
console.log(`App settings: https://developers.facebook.com/apps/${appId}/settings/basic/`);
console.log("Business verification: https://business.facebook.com/settings/security");
console.log("\nRe-run with portfolio ID: node scripts/_tmp-fb-business-status.mjs <BUSINESS_PORTFOLIO_ID>");

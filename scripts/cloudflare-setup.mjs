#!/usr/bin/env node
/**
 * Cloudflare setup for bestie.mx: ensure zone, mirror app DNS, apex→www redirect.
 *
 * Env (server/.env):
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ZONE_NAME=bestie.mx
 *   CLOUDFLARE_ACCOUNT_ID (required to create zone via API)
 *
 * Account API token permissions needed:
 *   Account → Zone → Edit (create/list zones)
 *   Zone → DNS → Edit
 *   Optional: Zone → Dynamic Redirect → Edit (Cloudflare redirect rule; Account tokens often lack this)
 *
 * Apex strategy: CNAME flattening @ → Railway + app 301 to www (works with DNS Edit only).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map.set(k, v);
  }
  return map;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const token = env.get("CLOUDFLARE_API_TOKEN")?.trim();
const zoneName = env.get("CLOUDFLARE_ZONE_NAME")?.trim() || "bestie.mx";
const accountId = env.get("CLOUDFLARE_ACCOUNT_ID")?.trim();

if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN in server/.env");
  process.exit(1);
}

const API = "https://api.cloudflare.com/client/v4";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || res.statusText;
    const err = new Error(`${method} ${path}: ${msg}`);
    err.errors = json.errors;
    throw err;
  }
  return json.result;
}

/** DNS we need on Cloudflare (from GoDaddy / Railway / Resend). */
const DNS_RECORDS = [
  {
    type: "CNAME",
    name: "www",
    content: "iahsi6f0.up.railway.app",
    proxied: false,
    comment: "Railway app (DNS only — Railway terminates SSL)",
  },
  {
    type: "CNAME",
    name: "links",
    content: "links1.resend-dns.com",
    proxied: false,
    comment: "Resend click tracking",
  },
  {
    type: "MX",
    name: "send",
    content: "feedback-smtp.us-east-1.amazonses.com",
    priority: 10,
    proxied: false,
    comment: "Resend/SES mail",
  },
  {
    type: "TXT",
    name: "send",
    content: "v=spf1",
    proxied: false,
  },
  {
    type: "TXT",
    name: "resend._domainkey",
    content:
      "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCnHEqaewCJBY51X8gh254WXSGo4cqDY9gHRh5jFNEzVC+aP5SF84V2Smy1MRjVVyJtKxJEcmZZoo1sI3l4K2fo5Fdh9GjNYdYNoK8BSJTdBAKfR+mykBxr/skgk+fjieNqyyzUQC4wICltsGcKceMvxkGlvPuj1eia+boaRe2cnwIDAQAB",
    proxied: false,
  },
  {
    type: "TXT",
    name: "_dmarc",
    content: "v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;",
    proxied: false,
  },
  {
    type: "TXT",
    name: "_railway-verify.www",
    content: "railway-verify=bbce1f35afcdeb8d1c7b892bd283328b64b3d8a6785ccb01ace98e28ee5bc5ec",
    proxied: false,
    comment: "Railway www domain verification",
  },
  {
    type: "TXT",
    name: "_railway-verify",
    content: "railway-verify=7a0872139c6f76fb90fad38c521793305db89b615d16c7a0c61f32ffdf8f4663",
    proxied: false,
    comment: "Railway apex domain verification",
  },
  /** Cloudflare CNAME flattening at apex → Railway; Express 301s bestie.mx → www.bestie.mx. */
  {
    type: "CNAME",
    name: "@",
    content: "jh1qewnb.up.railway.app",
    proxied: false,
    comment: "Railway apex (DNS only — app redirects to www with path)",
  },
];

async function getOrCreateZone() {
  const existing = await cf("GET", `/zones?name=${encodeURIComponent(zoneName)}`);
  if (existing?.[0]) return existing[0];

  if (!accountId) {
    throw new Error(
      "Zone not found. Add bestie.mx in the Cloudflare dashboard, or set CLOUDFLARE_ACCOUNT_ID and grant the token Zone Create permission.",
    );
  }

  try {
    return await cf("POST", "/zones", {
      name: zoneName,
      account: { id: accountId },
      type: "full",
      jump_start: false,
    });
  } catch (e) {
    const perm = e.errors?.some((x) => String(x.message).includes("zone.create"));
    if (perm) {
      throw new Error(
        "Token cannot create zones. Either add bestie.mx manually in Cloudflare (Websites → Add), or edit the Account API Token to include Account → Zone → Create.",
      );
    }
    throw e;
  }
}

function recordKey(r) {
  return `${r.type}:${r.name}:${r.content}:${r.priority ?? ""}`;
}

async function removeStaleApexRecords(zoneId) {
  const existing = await cf("GET", `/zones/${zoneId}/dns_records?per_page=100`);
  for (const r of existing) {
    if (isRootName(r.name) && r.type === "A" && r.content === "192.0.2.1") {
      await cf("DELETE", `/zones/${zoneId}/dns_records/${r.id}`);
      console.log("DNS remove stale A @ (redirect placeholder)");
    }
  }
}

function isRootName(name) {
  return name === "@" || name === zoneName;
}

/** Cloudflare API returns FQDN labels (e.g. www.bestie.mx); specs use short names (www). */
function normalizeName(name) {
  if (isRootName(name)) return "@";
  const suffix = `.${zoneName}`;
  if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
  return name;
}

function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

async function upsertDns(zoneId) {
  await removeStaleApexRecords(zoneId);
  const existing = await cf("GET", `/zones/${zoneId}/dns_records?per_page=100`);
  const byKey = new Map(existing.map((r) => [`${r.type}:${r.name}:${r.content}:${r.priority ?? ""}`, r]));

  for (const spec of DNS_RECORDS) {
    const payload = {
      type: spec.type,
      name: spec.name,
      content: spec.content,
      ttl: 1,
      proxied: spec.proxied ?? false,
      ...(spec.priority != null ? { priority: spec.priority } : {}),
      ...(spec.comment ? { comment: spec.comment } : {}),
    };
    const match = existing.find(
      (r) => r.type === spec.type && namesMatch(r.name, spec.name) && r.content === spec.content,
    );
    if (match) {
      console.log(`DNS keep ${spec.type} ${spec.name}`);
      continue;
    }
    const sameName = existing.filter((r) => r.type === spec.type && namesMatch(r.name, spec.name));
    if (sameName.length === 1 && spec.type !== "TXT") {
      await cf("PATCH", `/zones/${zoneId}/dns_records/${sameName[0].id}`, payload);
      console.log(`DNS update ${spec.type} ${spec.name}`);
      continue;
    }
    if (existing.some((r) => namesMatch(r.name, spec.name) && ["A", "AAAA", "CNAME"].includes(r.type) && r.type !== spec.type)) {
      const blockers = existing.filter(
        (r) => namesMatch(r.name, spec.name) && ["A", "AAAA", "CNAME"].includes(r.type) && r.type !== spec.type,
      );
      for (const b of blockers) {
        await cf("DELETE", `/zones/${zoneId}/dns_records/${b.id}`);
        console.log(`DNS remove conflicting ${b.type} ${b.name}`);
      }
    }
    await cf("POST", `/zones/${zoneId}/dns_records`, payload);
    console.log(`DNS add ${spec.type} ${spec.name}`);
    byKey.set(recordKey(spec), spec);
  }
}

async function ensureApexRedirect(zoneId) {
  try {
    await ensureCloudflareRedirectRule(zoneId);
  } catch (e) {
    console.log(
      "Redirect rule skipped (optional):",
      e.message,
    );
    console.log(
      "Apex uses Railway CNAME + app 301 to www.bestie.mx — no Cloudflare redirect rule required.",
    );
  }
}

async function ensureCloudflareRedirectRule(zoneId) {
  const phase = "http_request_dynamic_redirect";
  const expression = '(http.host eq "bestie.mx")';
  const rule = {
    action: "redirect",
    expression,
    description: "Apex bestie.mx → www with path and query",
    enabled: true,
    action_parameters: {
      from_value: {
        target_url: {
          expression: 'concat("https://www.bestie.mx", http.request.uri.path)',
        },
        status_code: 301,
        preserve_query_string: true,
      },
    },
  };

  let entry;
  try {
    entry = await cf("GET", `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
  } catch {
    entry = null;
  }

  if (entry?.rules?.some((r) => r.description === rule.description)) {
    console.log("Redirect rule already present");
    return;
  }

  if (entry?.id) {
    const rules = [...(entry.rules ?? []).filter((r) => r.description !== rule.description), rule];
    await cf("PUT", `/zones/${zoneId}/rulesets/${entry.id}`, {
      rules,
    });
    console.log("Redirect rule updated on existing ruleset");
    return;
  }

  await cf("POST", `/zones/${zoneId}/rulesets`, {
    name: "Apex to www redirect",
    kind: "zone",
    phase,
    rules: [rule],
  });
  console.log("Redirect rule created");
}

async function main() {
  console.log(`Cloudflare setup for ${zoneName}\n`);
  const zone = await getOrCreateZone();
  console.log(`Zone: ${zone.name} (${zone.id}) — status: ${zone.status}`);
  console.log(`Nameservers:\n  ${(zone.name_servers ?? []).join("\n  ")}\n`);

  await upsertDns(zone.id);
  await ensureApexRedirect(zone.id);

  console.log("\nDone.");
  if (zone.status === "pending") {
    console.log(
      "\nNext: at GoDaddy, set nameservers to the Cloudflare pair above. Propagation can take up to 24–48h (often <1h).",
    );
    console.log("Until then, DNS still resolves via GoDaddy.");
  }
}

main().catch((e) => {
  console.error("\nSetup failed:", e.message);
  process.exit(1);
});

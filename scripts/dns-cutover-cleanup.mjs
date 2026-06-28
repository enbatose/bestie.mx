#!/usr/bin/env node
/**
 * Post–DNS-cutover cleanup for bestie.mx.
 *
 * Waits until public DNS points at Cloudflare + Railway apex redirect works,
 * then prints/reminds manual GoDaddy forwarding removal (no write API).
 *
 * Env: server/.env (GoDaddy + Cloudflare creds)
 *
 * Usage:
 *   node --env-file=server/.env scripts/dns-cutover-cleanup.mjs
 *   node --env-file=server/.env scripts/dns-cutover-cleanup.mjs --watch
 *   node --env-file=server/.env scripts/dns-cutover-cleanup.mjs --watch --interval 15m
 */
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const DOMAIN = "bestie.mx";
const WWW = `www.${DOMAIN}`;
const CF_NS_SUFFIX = ".ns.cloudflare.com";
const PUBLIC_DNS = ["8.8.8.8", "1.1.1.1"];
const GODADDY_FORWARDING_URL =
  "https://dcc.godaddy.com/control/portfolio/bestie.mx/settings?tab=dns&action=forwarding";
const SHARE_TEST_PATH = "/anuncio/A00000000";
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const followUp = args.includes("--follow-up");
const intervalArg = args.find((a) => a.startsWith("--interval"));
const intervalMs = parseInterval(intervalArg?.split("=")[1] ?? args[args.indexOf("--interval") + 1] ?? "15m");

function parseInterval(raw) {
  const m = String(raw).trim().match(/^(\d+)(s|m|h)$/i);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  return n * ({ s: 1000, m: 60_000, h: 3_600_000 }[m[2].toLowerCase()] ?? 60_000);
}

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, ""));
  }
  return map;
}

function resolver() {
  const r = new dns.Resolver();
  r.setServers(PUBLIC_DNS);
  return r;
}

async function resolveNs() {
  return resolver().resolveNs(DOMAIN);
}

async function resolveApexA() {
  return resolver().resolve4(DOMAIN);
}

function nsOnCloudflare(nameServers) {
  return (
    nameServers.length >= 2 &&
    nameServers.every((ns) => ns.toLowerCase().endsWith(CF_NS_SUFFIX))
  );
}

async function cloudflareZoneStatus(token) {
  const zoneName = DOMAIN;
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.result?.[0]?.status ?? "unknown";
}

async function probeApexRedirect() {
  /** fetch() cannot set Host; curl exercises Railway apex + app 301. */
  const target = `https://jh1qewnb.up.railway.app${SHARE_TEST_PATH}`;
  const { stdout } = await execFileAsync("curl.exe", ["-sI", "-H", `Host: ${DOMAIN}`, target], {
    timeout: 20_000,
  });
  const status = Number(stdout.match(/^HTTP\/[\d.]+ (\d+)/im)?.[1] ?? 0);
  const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() ?? "";
  const ok = status === 301 && location.startsWith(`https://${WWW}${SHARE_TEST_PATH}`);
  return { ok, status, location };
}

async function probePublicApexHttps() {
  try {
    const { stdout } = await execFileAsync("curl.exe", ["-sI", `https://${DOMAIN}${SHARE_TEST_PATH}`], {
      timeout: 20_000,
    });
    const status = Number(stdout.match(/^HTTP\/[\d.]+ (\d+)/im)?.[1] ?? 0);
    const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() ?? "";
    const lander = stdout.includes("/lander") || stdout.toLowerCase().includes("godaddy");
    const ok = status === 301 && location.startsWith(`https://${WWW}${SHARE_TEST_PATH}`) && !lander;
    return { ok, status, location, note: lander ? "Still hitting GoDaddy lander/forwarding (DNS cache or forwarding rule)" : null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function probePublicApexViaDoH() {
  /** Google DoH — reflects what the world sees once caches expire. */
  const q = new URL("https://dns.google/resolve");
  q.searchParams.set("name", DOMAIN);
  q.searchParams.set("type", "A");
  const json = await fetch(q).then((r) => r.json());
  return (json.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data);
}

async function tryGoDaddyForwardingApi(key, secret) {
  const base = (process.env.GODADDY_API_BASE_URL ?? "https://api.godaddy.com").replace(/\/$/, "");
  const headers = {
    Authorization: `sso-key ${key}:${secret}`,
    Accept: "application/json",
  };
  for (const path of [`/v1/domains/${DOMAIN}/forwarding`, `/v1/domains/${DOMAIN}/forwarding/0`]) {
    const res = await fetch(`${base}${path}`, { method: "DELETE", headers });
    if (res.status === 204 || res.status === 200) return { removed: true, path };
  }
  return { removed: false, reason: "GoDaddy forwarding API unavailable (404) — remove in dashboard" };
}

async function runOnce(env) {
  const report = { ready: false, checks: {}, actions: [] };
  const cfToken = env.get("CLOUDFLARE_API_TOKEN")?.trim();
  const gdKey = env.get("GODADDY_PRODUCTION_API_KEY") ?? env.get("GODADDY_API_KEY");
  const gdSecret = env.get("GODADDY_PRODUCTION_API_SECRET") ?? env.get("GODADDY_API_SECRET");

  let nameServers = [];
  try {
    nameServers = await resolveNs();
    report.checks.nameservers = { ok: nsOnCloudflare(nameServers), value: nameServers };
  } catch (e) {
    report.checks.nameservers = { ok: false, error: e.message };
  }

  if (cfToken) {
    const status = await cloudflareZoneStatus(cfToken);
    report.checks.cloudflareZone = { ok: status === "active", value: status };
  }

  try {
    const apexA = await resolveApexA();
    report.checks.apexA = { ok: true, value: apexA };
  } catch (e) {
    report.checks.apexA = { ok: false, error: e.message };
  }

  const dohA = await probePublicApexViaDoH();
  const stillGoDaddyForward =
    dohA.includes("15.197.148.33") || dohA.includes("3.33.130.190");
  report.checks.publicA = { ok: !stillGoDaddyForward, value: dohA, note: stillGoDaddyForward ? "Old GoDaddy forward IPs still visible" : null };

  const redirect = await probeApexRedirect();
  report.checks.railwayApexRedirect = redirect;

  const publicHttps = await probePublicApexHttps();
  report.checks.publicApexHttps = publicHttps;

  const nsOk = report.checks.nameservers?.ok;
  const zoneOk = report.checks.cloudflareZone?.ok !== false;
  const redirectOk = redirect.ok;
  report.ready = Boolean(nsOk && zoneOk && redirectOk);
  report.followUpReady = report.ready && publicHttps.ok;

  if (report.ready) {
    if (gdKey && gdSecret) {
      const fwd = await tryGoDaddyForwardingApi(gdKey, gdSecret);
      report.actions.push(fwd);
    }
    report.actions.push({
      manual: true,
      title: "Disable GoDaddy domain forwarding",
      url: GODADDY_FORWARDING_URL,
      why: "Old forwarding only redirects the homepage and 404s share paths. Cloudflare + Railway handle apex now.",
    });
    report.actions.push({
      manual: true,
      title: "Optional: clear stale GoDaddy DNS records",
      url: `https://dcc.godaddy.com/control/dnsmanagement?domainName=${DOMAIN}`,
      why: "DNS is served by Cloudflare; GoDaddy DNS entries are inactive but confusing.",
    });
  }

  return report;
}

function printReport(report) {
  const ts = new Date().toISOString();
  console.log(`\n=== DNS cutover cleanup (${ts}) ===\n`);
  for (const [k, v] of Object.entries(report.checks)) {
    const mark = v.ok ? "OK" : "WAIT";
    console.log(`[${mark}] ${k}:`, JSON.stringify(v));
  }
  if (report.ready) {
    console.log("\n✓ Cutover checks passed.\n");
    for (const action of report.actions) {
      if (action.removed) console.log(`API removed forwarding via ${action.path}`);
      if (action.manual) {
        console.log(`→ MANUAL: ${action.title}`);
        console.log(`  ${action.url}`);
        console.log(`  ${action.why}\n`);
      }
      if (action.reason) console.log(`  ${action.reason}`);
    }
    console.log("Share URL smoke test (after local DNS cache expires):");
    console.log(`  curl -sI "https://${DOMAIN}${SHARE_TEST_PATH}"`);
    console.log(`  Expect: 301 → https://${WWW}${SHARE_TEST_PATH}\n`);
    if (report.checks.publicApexHttps?.ok) {
      console.log("Public apex HTTPS check: OK");
    } else {
      console.log("Public apex HTTPS check: still waiting (DNS cache / Railway apex cert / disable GoDaddy forwarding)\n");
    }
  } else {
    console.log("\nNot ready yet — waiting on DNS/propagation.\n");
  }
  return report.ready ? 0 : 1;
}

async function main() {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}`);
    process.exit(1);
  }
  const env = parseEnv(readFileSync(envPath, "utf8"));

  if (!watch && !followUp) {
    process.exitCode = printReport(await runOnce(env)) === 0 ? 0 : 1;
    return;
  }

  const label = followUp ? "follow-up (public apex HTTPS)" : "cutover";
  console.log(`Watching ${label} every ${Math.round(intervalMs / 60000)}m (public resolvers ${PUBLIC_DNS.join(", ")})…`);
  for (;;) {
    const report = await runOnce(env);
    const done = followUp ? report.followUpReady : report.ready;
    printReport(report);
    if (done) {
      const msg = followUp
        ? "Public apex share URLs work — GoDaddy forwarding cleanup can be confirmed"
        : "DNS cutover ready — remind user to disable GoDaddy forwarding and confirm share URLs";
      console.log(`AGENT_LOOP_WAKE_DNS_CUTOVER {"prompt":"${msg}"}`);
      process.exit(0);
    }
    console.log(`Sleeping ${Math.round(intervalMs / 60000)}m…`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

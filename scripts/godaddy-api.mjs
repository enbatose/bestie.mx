#!/usr/bin/env node
/**
 * Minimal GoDaddy Domains API helper (production or OTE).
 *
 * Env (e.g. server/.env):
 *   GODADDY_API_KEY=...
 *   GODADDY_API_SECRET=...
 *   GODADDY_API_BASE_URL=https://api.godaddy.com   # OTE: https://api.ote-godaddy.com
 *
 * Usage:
 *   node --env-file=server/.env scripts/godaddy-api.mjs domains
 *   node --env-file=server/.env scripts/godaddy-api.mjs dns list bestie.mx
 *   node --env-file=server/.env scripts/godaddy-api.mjs dns list bestie.mx --type TXT
 *   node --env-file=server/.env scripts/godaddy-api.mjs dns add bestie.mx --type TXT --name resend._domainkey --data "p=..." --ttl 600
 */

const BASE = (process.env.GODADDY_API_BASE_URL ?? "https://api.godaddy.com").replace(/\/$/, "");
const KEY = process.env.GODADDY_API_KEY?.trim();
const SECRET = process.env.GODADDY_API_SECRET?.trim();

function usage() {
  console.error(`Usage:
  node --env-file=server/.env scripts/godaddy-api.mjs domains
  node --env-file=server/.env scripts/godaddy-api.mjs dns list <domain> [--type TXT]
  node --env-file=server/.env scripts/godaddy-api.mjs dns add <domain> --type <TYPE> --name <NAME> --data <VALUE> [--ttl 600] [--priority 10]

Examples:
  dns add bestie.mx --type TXT --name send --data "v=spf1 include:amazonses.com ~all"
  dns add bestie.mx --type CNAME --name resend._domainkey --data "xxx.dkim.resend.dev"
`);
  process.exit(1);
}

function authHeaders() {
  if (!KEY || !SECRET) {
    console.error("Missing GODADDY_API_KEY or GODADDY_API_SECRET (use --env-file=server/.env).");
    process.exit(1);
  }
  return { Authorization: `sso-key ${KEY}:${SECRET}`, Accept: "application/json" };
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${path}`);
    console.error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    process.exit(1);
  }
  return body;
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type" || a === "--name" || a === "--data" || a === "--ttl" || a === "--priority") {
      flags[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function listDomains() {
  const data = await api("/v1/domains");
  console.log(JSON.stringify(data, null, 2));
}

async function listDns(domain, type) {
  const q = type ? `?type=${encodeURIComponent(type)}` : "";
  const data = await api(`/v1/domains/${encodeURIComponent(domain)}/records${q}`);
  console.log(JSON.stringify(data, null, 2));
}

async function addDns(domain, flags) {
  const type = flags.type?.toUpperCase();
  const name = flags.name;
  const dataValue = flags.data;
  if (!type || !name || dataValue === undefined) {
    console.error("dns add requires --type, --name, and --data");
    usage();
  }
  const record = {
    type,
    name,
    data: dataValue,
    ttl: Number(flags.ttl) || 600,
  };
  if (flags.priority !== undefined) record.priority = Number(flags.priority);

  await api(`/v1/domains/${encodeURIComponent(domain)}/records`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([record]),
  });
  console.log(`Added ${type} ${name} on ${domain}`);
  console.log("Note: GoDaddy may take 30–120s before changes appear. Re-check with dns list.");
}

const [cmd, sub, domain, ...rest] = process.argv.slice(2);
const { flags } = parseFlags(rest);

if (cmd === "domains") {
  await listDomains();
} else if (cmd === "dns" && sub === "list" && domain) {
  await listDns(domain, flags.type?.toUpperCase());
} else if (cmd === "dns" && sub === "add" && domain) {
  await addDns(domain, flags);
} else {
  usage();
}

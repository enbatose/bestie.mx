#!/usr/bin/env node
/**
 * Push Resend env from server/.env to Railway (Node/API service bestie-prod).
 *
 * Required: RESEND_API_KEY + EMAIL_FROM
 * Required for inbound contacto@ forward: RESEND_RECEIVING_API_KEY (full_access)
 *   — falls back to RESEND_ADMIN_API_KEY value when RECEIVING is unset (same full_access key),
 *     still stored on Railway as RESEND_RECEIVING_API_KEY (never as RESEND_ADMIN_API_KEY).
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

/** @param {string} key */
function getEnv(key) {
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  let v = line.slice(key.length + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v || undefined;
}

const service = process.env.RAILWAY_SERVICE || "bestie-prod";
const apiKey = getEnv("RESEND_API_KEY");
const emailFrom = getEnv("EMAIL_FROM");
const receivingKey =
  getEnv("RESEND_RECEIVING_API_KEY") || getEnv("RESEND_ADMIN_API_KEY");

if (!apiKey || !emailFrom) {
  console.error("Need RESEND_API_KEY and EMAIL_FROM in server/.env");
  process.exit(1);
}
if (!receivingKey) {
  console.error(
    "Need RESEND_RECEIVING_API_KEY (full_access) in server/.env for inbound contacto@ forward.",
  );
  console.error(
    "Tip: create a full_access key in Resend, or reuse RESEND_ADMIN_API_KEY as RESEND_RECEIVING_API_KEY on Railway only.",
  );
  process.exit(1);
}
if (receivingKey === apiKey) {
  console.error(
    "RESEND_RECEIVING_API_KEY must not be the same as sending-only RESEND_API_KEY.",
  );
  process.exit(1);
}

const optional = [
  ["RESEND_CONTACT_FORWARD_TO", getEnv("RESEND_CONTACT_FORWARD_TO")],
  ["RESEND_CONTACT_FORWARD_FROM", getEnv("RESEND_CONTACT_FORWARD_FROM")],
  ["RESEND_WEBHOOK_SECRET", getEnv("RESEND_WEBHOOK_SECRET")],
].filter(([, v]) => Boolean(v));

/**
 * @param {string} k
 * @param {string} v
 */
function setVar(k, v) {
  const useStdin = /[\s<>"]/.test(v);
  const args = useStdin
    ? ["variable", "set", k, "--stdin", "-s", service]
    : ["variable", "set", `${k}=${v}`, "-s", service];
  const r = spawnSync("railway", args, {
    // Windows resolves railway.cmd only with shell
    shell: true,
    stdio: useStdin ? ["pipe", "inherit", "inherit"] : "inherit",
    input: useStdin ? v : undefined,
    cwd: root,
  });
  if ((r.status ?? 1) !== 0) {
    console.error(`Failed to set ${k} on Railway service ${service}`);
    process.exit(r.status ?? 1);
  }
  console.log(`Set ${k} on Railway (${service})`);
}

for (const [k, v] of [
  ["RESEND_API_KEY", apiKey],
  ["EMAIL_FROM", emailFrom],
  ["RESEND_RECEIVING_API_KEY", receivingKey],
  ...optional,
]) {
  setVar(k, v);
}

console.log(
  "\nDone. After deploy: GET /api/health → resendInbound.receivingProbeOk=true and spfOk=true.",
);

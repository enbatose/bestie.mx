#!/usr/bin/env node
/** Add Resend DNS records for bestie.mx on GoDaddy (idempotent-ish: PATCH add). */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const api = resolve(root, "scripts", "godaddy-api.mjs");
const envFile = resolve(root, "server", ".env");
const domain = "bestie.mx";

const dkim =
  "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCnHEqaewCJBY51X8gh254WXSGo4cqDY9gHRh5jFNEzVC+aP5SF84V2Smy1MRjVVyJtKxJEcmZZoo1sI3l4K2fo5Fdh9GjNYdYNoK8BSJTdBAKfR+mykBxr/skgk+fjieNqyyzUQC4wICltsGcKceMvxkGlvPuj1eia+boaRe2cnwIDAQAB";

const steps = [
  ["TXT", "resend._domainkey", dkim],
  ["TXT", "send", "v=spf1 include:amazonses.com ~all"],
  ["MX", "send", "feedback-smtp.us-east-1.amazonses.com", "10"],
];

for (const step of steps) {
  const [type, name, data, priority] = step;
  const args = [
    `--env-file=${envFile}`,
    api,
    "dns",
    "add",
    domain,
    "--type",
    type,
    "--name",
    name,
    "--data",
    data,
    "--ttl",
    "600",
  ];
  if (priority) args.push("--priority", priority);
  const r = spawnSync("node", args, { encoding: "utf8", shell: true });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) {
    console.error(`Failed: ${type} ${name}`);
    process.exit(r.status ?? 1);
  }
}

console.log("Resend DNS records added on GoDaddy for bestie.mx");

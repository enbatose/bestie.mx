#!/usr/bin/env node
/**
 * Post-deploy smoke checks against a live Bestie origin (Dev or Prod).
 *
 * Rules:
 * - Read-only against user-visible surfaces (search/listings/home).
 * - May POST only when the request is guaranteed not to create user-visible inventory
 *   (e.g. rejected SVG upload, auth/me without session).
 * - Never publishes listings, never leaves draft titles in public search, never
 *   registers accounts on shared environments.
 *
 * Usage:
 *   node scripts/smoke-deploy.mjs
 *   SMOKE_BASE_URL=https://dev.bestie.mx node scripts/smoke-deploy.mjs
 */
import { setTimeout as delay } from "node:timers/promises";

const argUrl = process.argv[2]?.trim();
const BASE = (argUrl || process.env.SMOKE_BASE_URL || process.env.BASE_URL || "https://dev.bestie.mx").replace(
  /\/+$/,
  "",
);
const RETRIES = Math.max(1, Number(process.env.SMOKE_RETRIES || 12));
const RETRY_MS = Math.max(1000, Number(process.env.SMOKE_RETRY_MS || 10_000));

/** @type {{ name: string; ok: boolean; detail?: string }[]} */
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    redirect: "follow",
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function waitForHealthy() {
  let lastErr = "";
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(`${BASE}/health`, { redirect: "follow" });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text === "ok" || text.toLowerCase().includes("ok")) return true;
        lastErr = `unexpected body: ${text.slice(0, 80)}`;
      } else {
        lastErr = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    if (i + 1 < RETRIES) {
      console.log(`Waiting for ${BASE}/health (${i + 1}/${RETRIES}): ${lastErr}`);
      await delay(RETRY_MS);
    }
  }
  record("health ready", false, lastErr);
  return false;
}

async function main() {
  console.log(`Smoke against ${BASE}`);
  const healthy = await waitForHealthy();
  if (!healthy) {
    process.exitCode = 1;
    return;
  }
  record("GET /health", true);

  {
    const { res, body } = await fetchJson("/api/health");
    const ok =
      res.ok &&
      body &&
      typeof body === "object" &&
      body.ok === true &&
      body.service === "bestie-mx-api" &&
      !("databasePath" in body) &&
      !("smtp" in body) &&
      !("resendInbound" in body);
    record("GET /api/health (no diagnostics leak)", ok, ok ? undefined : JSON.stringify(body).slice(0, 200));
  }

  {
    const res = await fetch(`${BASE}/`, { redirect: "follow" });
    const html = await res.text();
    const ok = res.ok && /bestie|root|id="root"/i.test(html);
    record("GET / (SPA shell)", ok, ok ? undefined : `status=${res.status}`);
  }

  {
    const { res, body } = await fetchJson("/api/listings");
    const ok = res.ok && Array.isArray(body);
    record("GET /api/listings", ok, ok ? `count=${body.length}` : `status=${res.status}`);

    if (ok && body.length > 0) {
      const first = body[0];
      const propertyId = first?.propertyId || first?.id;
      if (typeof propertyId === "string" && propertyId.startsWith("prp__")) {
        const prop = await fetchJson(`/api/properties/${encodeURIComponent(propertyId)}`);
        const leaked = prop.body?.property && "publisherId" in prop.body.property;
        record(
          "public property omits publisherId",
          prop.res.ok && !leaked,
          leaked ? "publisherId present" : undefined,
        );
      } else if (typeof first?.id === "string") {
        const listing = await fetchJson(`/api/listings/${encodeURIComponent(first.id)}`);
        const leaked = listing.body && "publisherId" in listing.body;
        record(
          "public listing omits publisherId",
          listing.res.ok && !leaked,
          leaked ? "publisherId present" : undefined,
        );
      }
    }
  }

  {
    const { res, body } = await fetchJson("/api/auth/me");
    const ok = res.status === 401 || (res.ok && body && typeof body === "object");
    record("GET /api/auth/me (anonymous)", ok, `status=${res.status}`);
  }

  {
    // Rejected upload must not create a public listing. SVG is rejected before write.
    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>`],
        { type: "image/svg+xml" },
      ),
      "probe.svg",
    );
    const res = await fetch(`${BASE}/api/uploads`, { method: "POST", body: form, redirect: "follow" });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const ok = res.status === 400 && body?.error === "invalid_mimetype";
    record("POST /api/uploads rejects SVG", ok, ok ? undefined : `status=${res.status}`);
  }

  {
    const { res, body } = await fetchJson("/api/location-search?q=Guadalajara");
    const ok = res.ok && (Array.isArray(body) || (body && typeof body === "object"));
    record("GET /api/location-search", ok, `status=${res.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`Smoke summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail || "failed"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

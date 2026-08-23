#!/usr/bin/env node
/**
 * Post-deploy messaging probes against a live Bestie origin (Dev or Prod).
 *
 * Always (no writes, no accounts):
 *   - /mensajes SPA shell
 *   - unauthenticated message APIs return 401 (not 502/5xx)
 *   - from-listing without a session is 401 even with a public A-ref
 *   - public listing GET works for UUID and A-ref when catalog is non-empty
 *
 * Optional authenticated two-user flow (does not create listings or accounts):
 *   SMOKE_MSG_SEEKER_EMAIL / SMOKE_MSG_SEEKER_PASSWORD
 *   SMOKE_MSG_PUBLISHER_EMAIL / SMOKE_MSG_PUBLISHER_PASSWORD
 *   SMOKE_MSG_LISTING_ID  — UUID or A… slug owned by the publisher account
 */
import { setTimeout as delay } from "node:timers/promises";

const argUrl = process.argv[2]?.trim();
const BASE = (argUrl || process.env.SMOKE_BASE_URL || process.env.BASE_URL || "https://dev.bestie.mx").replace(
  /\/+$/,
  "",
);

/** @type {{ name: string; ok: boolean; detail?: string }[]} */
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function cookiesFrom(res) {
  const getSet = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (getSet.length) {
    return getSet
      .map((line) => String(line).split(";")[0])
      .map((part) => (part ? part.trim() : ""))
      .filter(Boolean)
      .join("; ");
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=[^ ;]+=)/)
    .map((line) => line.split(";")[0])
    .map((part) => (part ? part.trim() : ""))
    .filter(Boolean)
    .join("; ");
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "follow",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
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

function roomPublicSlug(roomId) {
  const t = String(roomId || "").trim();
  const parsed = t.match(/^A([A-F0-9]{8})$/i);
  if (parsed) return `A${parsed[1].toUpperCase()}`;
  const hex = t.replace(/^prp__/, "").replace(/-/g, "").toUpperCase();
  const runs = hex.match(/[A-F0-9]{8,}/g);
  const slice = (runs?.[runs.length - 1] ?? hex).slice(0, 8);
  return `A${slice}`;
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "follow",
  });
  const cookie = cookiesFrom(res);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, cookie, body };
}

async function authedJson(cookie, path, init = {}) {
  return fetchJson(path, {
    ...init,
    headers: {
      Cookie: cookie,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
}

async function main() {
  console.log(`Messaging smoke against ${BASE}`);

  {
    const res = await fetch(`${BASE}/mensajes`, { redirect: "follow" });
    const html = await res.text();
    const ok = res.ok && /id="root"|bestie/i.test(html);
    record("GET /mensajes (SPA shell)", ok, ok ? undefined : `status=${res.status}`);
  }

  for (const path of [
    "/api/messages/conversations",
    "/api/messages/unread-count",
    "/api/messages/safety-acknowledgment",
  ]) {
    const { res } = await fetchJson(path);
    record(`GET ${path} anonymous → 401`, res.status === 401, `status=${res.status}`);
  }

  {
    const { res, body } = await fetchJson("/api/listings");
    const ok = res.ok && Array.isArray(body);
    record("GET /api/listings (messaging catalog)", ok, ok ? `count=${body.length}` : `status=${res.status}`);

    if (ok && body.length > 0 && typeof body[0]?.id === "string") {
      const roomId = body[0].id;
      const slug = roomPublicSlug(roomId);
      const byId = await fetchJson(`/api/listings/${encodeURIComponent(roomId)}`);
      const bySlug = await fetchJson(`/api/listings/${encodeURIComponent(slug)}`);
      record(
        "GET listing by UUID and A-ref",
        byId.res.ok && bySlug.res.ok,
        `uuid=${byId.res.status} aref=${bySlug.res.status} slug=${slug}`,
      );

      const start = await fetchJson("/api/messages/conversations/from-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingRoomId: slug }),
      });
      record(
        "POST from-listing anonymous A-ref → 401",
        start.res.status === 401,
        `status=${start.res.status} error=${start.body?.error || ""}`,
      );
    }
  }

  {
    const start = await fetchJson("/api/messages/conversations/from-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingRoomId: "not-a-valid-listing-id!!!" }),
    });
    record(
      "POST from-listing anonymous invalid id → 401",
      start.res.status === 401,
      `status=${start.res.status}`,
    );
  }

  {
    const thread = await fetchJson("/api/messages/conversations/not-a-real-thread/messages");
    record(
      "GET thread messages anonymous → 401",
      thread.res.status === 401,
      `status=${thread.res.status}`,
    );
  }

  const seekEmail = process.env.SMOKE_MSG_SEEKER_EMAIL?.trim();
  const seekPass = process.env.SMOKE_MSG_SEEKER_PASSWORD?.trim();
  const pubEmail = process.env.SMOKE_MSG_PUBLISHER_EMAIL?.trim();
  const pubPass = process.env.SMOKE_MSG_PUBLISHER_PASSWORD?.trim();
  const listingId = process.env.SMOKE_MSG_LISTING_ID?.trim();

  if (!seekEmail || !seekPass || !pubEmail || !pubPass || !listingId) {
    record(
      "authenticated messaging flow",
      true,
      "skipped (set SMOKE_MSG_* fixture secrets to enable live write probe)",
    );
  } else {
    const slug = roomPublicSlug(listingId);
    const token = `smoke-msg-${Date.now()}`;
    const seek = await login(seekEmail, seekPass);
    const pub = await login(pubEmail, pubPass);
    const loggedIn = seek.res.ok && pub.res.ok && seek.cookie && pub.cookie;
    record(
      "fixture accounts login",
      loggedIn,
      loggedIn ? undefined : `seeker=${seek.res.status} publisher=${pub.res.status}`,
    );

    if (loggedIn) {
      const started = await authedJson(seek.cookie, "/api/messages/conversations/from-listing", {
        method: "POST",
        body: JSON.stringify({ listingRoomId: slug }),
      });
      const conversationId = started.body?.conversationId;
      record(
        "seeker from-listing via A-ref",
        started.res.ok && Boolean(conversationId),
        `status=${started.res.status} error=${started.body?.error || ""}`,
      );

      if (conversationId) {
        const sent = await authedJson(
          seek.cookie,
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
          { method: "POST", body: JSON.stringify({ body: token }) },
        );
        record("seeker send", sent.res.ok, `status=${sent.res.status}`);

        const empty = await authedJson(
          seek.cookie,
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
          { method: "POST", body: JSON.stringify({ body: "   " }) },
        );
        record("empty message rejected", empty.res.status === 400, `status=${empty.res.status}`);

        const unread = await authedJson(pub.cookie, "/api/messages/unread-count");
        record(
          "publisher unread after inbound",
          unread.res.ok && Number(unread.body?.count || 0) >= 1,
          `count=${unread.body?.count}`,
        );

        const pubInbox = await authedJson(pub.cookie, "/api/messages/conversations");
        const pubRow = (pubInbox.body?.conversations || []).find((row) => row.id === conversationId);
        record(
          "publisher inbox redacted until safety ack",
          pubRow?.lastPreview === "Nuevo mensaje",
          `preview=${pubRow?.lastPreview || ""}`,
        );

        await authedJson(pub.cookie, "/api/messages/safety-acknowledgment", {
          method: "POST",
          body: JSON.stringify({ conversationId, role: "publisher" }),
        });

        let seen = false;
        for (let i = 0; i < 8 && !seen; i++) {
          const thread = await authedJson(
            pub.cookie,
            `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
          );
          const bodies = (thread.body?.messages || []).map((m) => String(m.body || ""));
          seen = bodies.some((b) => b.includes(token));
          if (!seen) await delay(750);
        }
        record("publisher receives seeker message", seen);

        const reply = `ack-${token}`;
        const replied = await authedJson(
          pub.cookie,
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
          { method: "POST", body: JSON.stringify({ body: reply }) },
        );
        record("publisher reply", replied.res.ok, `status=${replied.res.status}`);

        await authedJson(seek.cookie, "/api/messages/safety-acknowledgment", {
          method: "POST",
          body: JSON.stringify({ conversationId, role: "seeker" }),
        });
        const seekThread = await authedJson(
          seek.cookie,
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        );
        const seekBodies = (seekThread.body?.messages || []).map((m) => String(m.body || ""));
        record("seeker sees publisher reply", seekBodies.some((b) => b.includes(reply)));
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`Messaging smoke: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail || "failed"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

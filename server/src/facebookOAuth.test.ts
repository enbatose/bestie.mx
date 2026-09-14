import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  facebookOAuthPasswordPlaceholder,
  googleOAuthPasswordPlaceholder,
} from "./adminAuth.js";
import { createApp } from "./appFactory.js";
import { canonicalLookupEmail } from "./authEmail.js";
import { openDb } from "./db.js";
import { parseFacebookSignedRequest } from "./facebookOAuth.js";

function facebookSignedRequest(secret: string, userId: string): string {
  const payloadPart = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: userId }), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sig = createHmac("sha256", secret).update(payloadPart).digest();
  const encodedSig = sig
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${encodedSig}.${payloadPart}`;
}

describe("Facebook OAuth", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;
  const prevAppId = process.env.FACEBOOK_APP_ID;
  const prevAppSecret = process.env.FACEBOOK_APP_SECRET;
  const prevRedirect = process.env.FACEBOOK_OAUTH_REDIRECT_URI;
  const prevWebOrigin = process.env.PUBLIC_WEB_ORIGIN;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.PUBLIC_WEB_ORIGIN = "http://localhost";
    dir = mkdtempSync(join(tmpdir(), "bestie-facebook-oauth-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", corsOrigins: ["http://localhost"] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.FACEBOOK_APP_ID = prevAppId;
    process.env.FACEBOOK_APP_SECRET = prevAppSecret;
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = prevRedirect;
  });

  afterAll(() => {
    db.close();
    process.env.PUBLIC_WEB_ORIGIN = prevWebOrigin;
    process.env.NODE_ENV = prevNodeEnv;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("GET /api/auth/facebook/enabled reflects configuration", async () => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    let res = await request(app).get("/api/auth/facebook/enabled").expect(200);
    expect(res.body.enabled).toBe(false);

    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";
    res = await request(app).get("/api/auth/facebook/enabled").expect(200);
    expect(res.body.enabled).toBe(true);
  });

  it("GET /api/auth/facebook redirects to Facebook when configured", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const res = await request(app).get("/api/auth/facebook?returnTo=/mis-anuncios").expect(302);
    expect(res.headers.location).toContain("facebook.com/");
    expect(res.headers.location).toContain("client_id=test-app-id");
    expect(res.headers.location).toContain("scope=email%2Cpublic_profile");
    expect(res.headers.location).not.toContain("auth_type=rerequest");
    expect(res.headers.location).not.toContain("user_friends");
    expect(res.headers.location).not.toContain("pages_");
    expect(res.headers["set-cookie"]?.join(";")).toContain("bestie_facebook_oauth=");
  });

  it("GET /api/auth/facebook?reask=1 asks Facebook again for declined email", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const res = await request(app).get("/api/auth/facebook?reask=1").expect(302);
    expect(res.headers.location).toContain("auth_type=rerequest");
    expect(res.headers.location).toContain("scope=email%2Cpublic_profile");
  });

  it("GET /api/auth/facebook/callback creates a verified user and session", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "fb-at-test" }), { status: 200 });
      }
      if (url.includes("/me?")) {
        return new Response(
          JSON.stringify({
            id: "facebook-id-456",
            email: `fb-user-${randomUUID().slice(0, 8)}@example.com`,
            name: "Facebook Tester",
            picture: { data: { url: "https://example.com/avatar.jpg" } },
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const agent = request.agent(app);
    const start = await agent.get("/api/auth/facebook?returnTo=/mis-anuncios").expect(302);
    const loc = new URL(start.headers.location as string);
    const state = loc.searchParams.get("state");
    expect(state).toBeTruthy();

    const callback = await agent
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(state!)}`)
      .expect(302);
    expect(callback.headers.location).toBe("http://localhost/mis-anuncios");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.emailVerified).toBe(true);
    expect(me.body.accountStatus).toBe("active");
    expect(me.body.displayName).toBe("Facebook Tester");
  });

  it("GET /api/auth/facebook/callback reasks Facebook once when /me has no email", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "fb-at-test" }), { status: 200 });
        }
        if (url.includes("/me?")) {
          return new Response(JSON.stringify({ id: "facebook-id-no-email", name: "Sin Correo" }), {
            status: 200,
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const agent = request.agent(app);
    const start = await agent.get("/api/auth/facebook?returnTo=/mis-anuncios").expect(302);
    const loc = new URL(start.headers.location as string);
    const state = loc.searchParams.get("state");
    expect(loc.searchParams.get("auth_type")).toBeNull();

    const callback = await agent
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(state!)}`)
      .expect(302);
    const again = new URL(callback.headers.location as string);
    expect(again.searchParams.get("auth_type")).toBe("rerequest");
    expect(again.searchParams.get("scope")).toBe("email,public_profile");

    const reaskState = again.searchParams.get("state");
    expect(reaskState).toBeTruthy();
    const created = await agent
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(reaskState!)}`)
      .expect(302);
    expect(created.headers.location).toBe("http://localhost/mis-anuncios");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.email).toBeNull();
    expect(me.body.displayName).toBe("Sin Correo");
    expect(me.body.signInMethod).toBe("facebook");
    expect(me.body.emailVerified).toBe(false);
  });

  it("links a Facebook-without-email stub onto an existing email account after inbox verification", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const existingEmail = `google-first-${randomUUID().slice(0, 8)}@example.com`;
    const owner = request.agent(app);
    await owner
      .post("/api/auth/register")
      .send({ email: existingEmail, password: "longenough1", displayName: "Cuenta Google" })
      .expect(201);
    const ownerMe = await owner.get("/api/auth/me").expect(200);
    await owner.post("/api/auth/logout").expect(200);

    const facebookId = `facebook-id-link-${randomUUID().slice(0, 8)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "fb-at-test" }), { status: 200 });
        }
        if (url.includes("/me?")) {
          return new Response(JSON.stringify({ id: facebookId, name: "Stub Facebook" }), { status: 200 });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const fb = request.agent(app);
    const start = await fb.get("/api/auth/facebook?returnTo=/mis-anuncios").expect(302);
    const state = new URL(start.headers.location as string).searchParams.get("state");
    const first = await fb
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(state!)}`)
      .expect(302);
    const reaskState = new URL(first.headers.location as string).searchParams.get("state");
    await fb
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(reaskState!)}`)
      .expect(302);
    const stubMe = await fb.get("/api/auth/me").expect(200);
    expect(stubMe.body.email).toBeNull();
    expect(stubMe.body.id).not.toBe(ownerMe.body.id);

    const patch = await fb.patch("/api/auth/me").send({ email: existingEmail }).expect(409);
    expect(patch.body.error).toBe("email_link_required");
    expect(patch.body.devCode).toMatch(/^\d{6}$/);

    const linked = await fb
      .post("/api/auth/me/link-existing-email")
      .send({ email: existingEmail, code: patch.body.devCode })
      .expect(200);
    expect(linked.body.linked).toBe(true);

    const me = await fb.get("/api/auth/me").expect(200);
    expect(me.body.id).toBe(ownerMe.body.id);
    expect(me.body.email).toBe(existingEmail);
    expect(me.body.displayName).toBe("Cuenta Google");

    const oauth = db
      .prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
      .get("facebook", facebookId) as { user_id: string } | undefined;
    expect(oauth?.user_id).toBe(ownerMe.body.id);
    const stubGone = db.prepare("SELECT id FROM users WHERE id = ?").get(stubMe.body.id);
    expect(stubGone).toBeUndefined();
  });

  it("GET /api/auth/facebook/callback signs in a linked Facebook user even without email", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const userId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    ).run(
      userId,
      "already@example.com",
      canonicalLookupEmail("already@example.com"),
      facebookOAuthPasswordPlaceholder(),
      "Ya ligado",
      now,
      now,
    );
    db.prepare(
      `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run("facebook", "facebook-already-linked", userId, now);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "fb-at-test" }), { status: 200 });
        }
        if (url.includes("/me?")) {
          return new Response(JSON.stringify({ id: "facebook-already-linked", name: "Ya ligado" }), {
            status: 200,
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const agent = request.agent(app);
    const start = await agent.get("/api/auth/facebook").expect(302);
    const state = new URL(start.headers.location as string).searchParams.get("state");
    const callback = await agent
      .get(`/api/auth/facebook/callback?code=fake-code&state=${encodeURIComponent(state!)}`)
      .expect(302);
    expect(callback.headers.location).toBe("http://localhost/mis-anuncios");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.displayName).toBe("Ya ligado");
  });

  it("parses a valid Facebook signed_request and rejects a bad signature", () => {
    const signed = facebookSignedRequest("test-app-secret", "fb-user-1");
    expect(parseFacebookSignedRequest(signed, "test-app-secret")?.user_id).toBe("fb-user-1");
    expect(parseFacebookSignedRequest(signed, "wrong-secret")).toBeNull();
  });

  it("POST /api/auth/facebook/data-deletion unlinks Facebook and erases facebook-only accounts", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const fbOnlyId = randomUUID();
    const linkedId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, profile_picture_url)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    ).run(
      fbOnlyId,
      "fb-only@example.com",
      canonicalLookupEmail("fb-only@example.com"),
      facebookOAuthPasswordPlaceholder(),
      "Solo Facebook",
      now,
      now,
      "https://scontent.xx.fbcdn.net/v/t1/photo.jpg",
    );
    db.prepare(
      `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run("facebook", "fb-only-uid", fbOnlyId, now);

    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, profile_picture_url)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    ).run(
      linkedId,
      "google-plus-fb@example.com",
      canonicalLookupEmail("google-plus-fb@example.com"),
      googleOAuthPasswordPlaceholder(),
      "Google y Facebook",
      now,
      now,
      "https://graph.facebook.com/v21.0/me/picture",
    );
    db.prepare(
      `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run("facebook", "fb-linked-uid", linkedId, now);
    db.prepare(
      `INSERT INTO oauth_identities (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run("google", "google-linked-uid", linkedId, now);

    const erased = await request(app)
      .post("/api/auth/facebook/data-deletion")
      .type("form")
      .send({ signed_request: facebookSignedRequest("test-app-secret", "fb-only-uid") })
      .expect(200);
    expect(erased.body.confirmation_code).toMatch(/^[a-f0-9]{32}$/);
    expect(erased.body.url).toContain("/eliminar-facebook?code=");

    expect(
      db.prepare("SELECT id FROM users WHERE id = ?").get(fbOnlyId),
    ).toBeUndefined();
    expect(
      db
        .prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
        .get("facebook", "fb-only-uid"),
    ).toBeUndefined();

    const statusErased = await request(app)
      .get(`/api/auth/facebook/deletion-status?code=${erased.body.confirmation_code}`)
      .expect(200);
    expect(statusErased.body).toMatchObject({ ok: true, found: true, status: "erased" });

    const unlinked = await request(app)
      .post("/api/auth/facebook/data-deletion")
      .type("form")
      .send({ signed_request: facebookSignedRequest("test-app-secret", "fb-linked-uid") })
      .expect(200);

    const stillThere = db.prepare("SELECT id, profile_picture_url FROM users WHERE id = ?").get(linkedId) as {
      id: string;
      profile_picture_url: string | null;
    };
    expect(stillThere.id).toBe(linkedId);
    expect(stillThere.profile_picture_url).toBeNull();
    expect(
      db
        .prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
        .get("facebook", "fb-linked-uid"),
    ).toBeUndefined();
    expect(
      db
        .prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?")
        .get("google", "google-linked-uid"),
    ).toEqual({ user_id: linkedId });

    const statusUnlinked = await request(app)
      .get(`/api/auth/facebook/deletion-status?code=${unlinked.body.confirmation_code}`)
      .expect(200);
    expect(statusUnlinked.body).toMatchObject({ ok: true, found: true, status: "unlinked" });
  });

  it("POST /api/auth/facebook/data-deletion records unknown Facebook users without failing", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    const res = await request(app)
      .post("/api/auth/facebook/data-deletion")
      .type("form")
      .send({ signed_request: facebookSignedRequest("test-app-secret", "nobody-on-bestie") })
      .expect(200);
    expect(res.body.confirmation_code).toMatch(/^[a-f0-9]{32}$/);

    const status = await request(app)
      .get(`/api/auth/facebook/deletion-status?code=${res.body.confirmation_code}`)
      .expect(200);
    expect(status.body).toMatchObject({ ok: true, found: true, status: "none" });
  });

  it("POST /api/auth/facebook/data-deletion rejects a bad signature", async () => {
    process.env.FACEBOOK_APP_ID = "test-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-app-secret";
    process.env.FACEBOOK_OAUTH_REDIRECT_URI = "http://localhost/api/auth/facebook/callback";

    await request(app)
      .post("/api/auth/facebook/data-deletion")
      .type("form")
      .send({ signed_request: facebookSignedRequest("other-secret", "fb-user-1") })
      .expect(400);
  });
});

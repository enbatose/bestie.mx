import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

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
    expect(res.headers["set-cookie"]?.join(";")).toContain("bestie_facebook_oauth=");
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
});

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

describe("Google OAuth", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;
  const prevClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const prevClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const prevRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const prevWebOrigin = process.env.PUBLIC_WEB_ORIGIN;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.PUBLIC_WEB_ORIGIN = "http://localhost";
    dir = mkdtempSync(join(tmpdir(), "bestie-google-oauth-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", corsOrigins: ["http://localhost"] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.GOOGLE_OAUTH_CLIENT_ID = prevClientId;
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevClientSecret;
    process.env.GOOGLE_OAUTH_REDIRECT_URI = prevRedirect;
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

  it("GET /api/auth/google/enabled reflects configuration", async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    let res = await request(app).get("/api/auth/google/enabled").expect(200);
    expect(res.body.enabled).toBe(false);

    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost/api/auth/google/callback";
    res = await request(app).get("/api/auth/google/enabled").expect(200);
    expect(res.body.enabled).toBe(true);
  });

  it("GET /api/auth/google redirects to Google when configured", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost/api/auth/google/callback";

    const res = await request(app).get("/api/auth/google?returnTo=/mis-anuncios").expect(302);
    expect(res.headers.location).toContain("accounts.google.com/o/oauth2");
    expect(res.headers.location).toContain("client_id=test-client-id");
    expect(res.headers["set-cookie"]?.join(";")).toContain("bestie_google_oauth=");
  });

  it("GET /api/auth/google/callback creates a verified user and session", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost/api/auth/google/callback";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "at-test" }), { status: 200 });
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-sub-123",
            email: `google-user-${randomUUID().slice(0, 8)}@gmail.com`,
            email_verified: true,
            name: "Google Tester",
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const agent = request.agent(app);
    const start = await agent.get("/api/auth/google?returnTo=/mis-anuncios").expect(302);
    const loc = new URL(start.headers.location as string);
    const state = loc.searchParams.get("state");
    expect(state).toBeTruthy();

    const callback = await agent
      .get(`/api/auth/google/callback?code=fake-code&state=${encodeURIComponent(state!)}`)
      .expect(302);
    expect(callback.headers.location).toBe("http://localhost/mis-anuncios");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.emailVerified).toBe(true);
    expect(me.body.accountStatus).toBe("active");
    expect(me.body.displayName).toBe("Google Tester");
  });
});

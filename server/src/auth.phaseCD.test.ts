import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

describe("Phase C/D — auth, handoff, groups, admin, compliance", () => {
  const testId = randomUUID().slice(0, 8);
  const bossEmail = `boss-${testId}@test.mx`;
  const userEmail = `user-${testId}@test.mx`;
  const regularEmail = `regular-${testId}@test.mx`;

  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;
  let app: Application;
  const prevAdmin = process.env.ADMIN_EMAILS;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAILS = bossEmail;
    dir = mkdtempSync(join(tmpdir(), "bestie-phasecd-"));
    dbPath = join(dir, "t.db");
    db = openDb(dbPath);
    app = createApp(db, { databaseLabel: "t.db", corsOrigins: ["http://localhost"] });
  });

  afterAll(() => {
    db.close();
    process.env.ADMIN_EMAILS = prevAdmin;
    process.env.NODE_ENV = prevNodeEnv;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("GET /api/compliance/no-impersonation", async () => {
    const res = await request(app).get("/api/compliance/no-impersonation").expect(200);
    expect(res.body.policy).toBe("no_user_impersonation");
  });

  it("POST /api/auth/impersonate returns 410", async () => {
    await request(app).post("/api/auth/impersonate").expect(410);
  });

  it("register preserves dots in the stored email and logs in via any Gmail alias", async () => {
    const em = `dotty.enrique-${testId}@gmail.com`;
    const atIdx = em.indexOf("@");
    const emNoDots = em.slice(0, atIdx).replace(/\./g, "") + em.slice(atIdx);
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: em, password: "longenough1" }).expect(201);
    const meAfterReg = await agent.get("/api/auth/me").expect(200);
    expect(meAfterReg.body.email).toBe(em);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: em, password: "longenough1" }).expect(200);
    const me1 = await agent.get("/api/auth/me").expect(200);
    expect(me1.body.email).toBe(em);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: emNoDots, password: "longenough1" }).expect(200);
    const me2 = await agent.get("/api/auth/me").expect(200);
    expect(me2.body.email).toBe(em);
    const dup = request.agent(app);
    await dup
      .post("/api/auth/register")
      .send({ email: emNoDots, password: "longenough1" })
      .expect(409);
  });

  it("register, logout, login, /me includes isAdmin", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: userEmail, password: "longenough1", displayName: "U" })
      .expect(201);
    const me1 = await agent.get("/api/auth/me").expect(200);
    expect(me1.body.isAdmin).toBe(false);
    expect(me1.body.emailVerified).toBe(true);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
    await agent.post("/api/auth/login").send({ email: userEmail, password: "longenough1" }).expect(200);
    await agent.get("/api/auth/me").expect(200);
  });

  it("PATCH /api/auth/me updates display name without password", async () => {
    const em = `edit-dn-${testId}@test.mx`;
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: em, password: "longenough1" }).expect(201);
    const r = await agent.patch("/api/auth/me").send({ displayName: "Nuevo Nombre" }).expect(200);
    expect(r.body).toMatchObject({ ok: true, changed: true });
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.displayName).toBe("Nuevo Nombre");
  });

  it("PATCH /api/auth/me saves phone_e164 from phone string", async () => {
    const em = `edit-ph-${testId}@test.mx`;
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: em, password: "longenough1" }).expect(201);
    const r = await agent.patch("/api/auth/me").send({ phone: "3312345678" }).expect(200);
    expect(r.body).toMatchObject({ ok: true, changed: true });
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.phoneE164).toBe("+523312345678");
    const r2 = await agent.patch("/api/auth/me").send({ phone: "3312345678" }).expect(200);
    expect(r2.body).toMatchObject({ ok: true, changed: false });
  });

  it("PATCH /api/auth/me rejects phone already on another user", async () => {
    const em1 = `ph-a-${testId}@test.mx`;
    const em2 = `ph-b-${testId}@test.mx`;
    const a1 = request.agent(app);
    const a2 = request.agent(app);
    await a1.post("/api/auth/register").send({ email: em1, password: "longenough1" }).expect(201);
    await a2.post("/api/auth/register").send({ email: em2, password: "longenough1" }).expect(201);
    await a1.patch("/api/auth/me").send({ phone: "5511112222" }).expect(200);
    await a2.patch("/api/auth/me").send({ phone: "5511112222" }).expect(409);
  });

  it("PATCH /api/auth/me requires current password to change email", async () => {
    const em1 = `edit-em1-${testId}@test.mx`;
    const em2 = `edit.em2-${testId}@gmail.com`;
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: em1, password: "longenough1" }).expect(201);
    await agent.patch("/api/auth/me").send({ email: em2 }).expect(401);
    await agent
      .patch("/api/auth/me")
      .send({ email: em2, currentPassword: "WRONG" })
      .expect(401);
    await agent
      .patch("/api/auth/me")
      .send({ email: em2, currentPassword: "longenough1" })
      .expect(200);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.email).toBe(em2);
    expect(me.body.emailVerified).toBe(true);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: em2, password: "longenough1" }).expect(200);
    await agent.post("/api/auth/logout").expect(200);
    const em2NoDots = (() => {
      const at = em2.indexOf("@");
      return em2.slice(0, at).replace(/\./g, "") + em2.slice(at);
    })();
    await agent.post("/api/auth/login").send({ email: em2NoDots, password: "longenough1" }).expect(200);
  });

  it("PATCH /api/auth/me rejects duplicate email", async () => {
    const emA = `edit-emA-${testId}@test.mx`;
    const emB = `edit-emB-${testId}@test.mx`;
    const a1 = request.agent(app);
    await a1.post("/api/auth/register").send({ email: emA, password: "longenough1" }).expect(201);
    const a2 = request.agent(app);
    await a2.post("/api/auth/register").send({ email: emB, password: "longenough1" }).expect(201);
    await a2
      .patch("/api/auth/me")
      .send({ email: emA, currentPassword: "longenough1" })
      .expect(409);
  });

  it("user whose email was stored dotless can restore the original via PATCH /me", async () => {
    const original = `batani.enrique-${testId}@gmail.com`;
    const dotless = `batanienrique-${testId}@gmail.com`;
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: dotless, password: "longenough1" })
      .expect(201);
    const meOld = await agent.get("/api/auth/me").expect(200);
    expect(meOld.body.email).toBe(dotless);
    await agent
      .patch("/api/auth/me")
      .send({ email: original, currentPassword: "longenough1" })
      .expect(200);
    const meNew = await agent.get("/api/auth/me").expect(200);
    expect(meNew.body.email).toBe(original);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: original, password: "longenough1" }).expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: dotless, password: "longenough1" }).expect(200);
  });

  it("POST /api/auth/change-password rotates the password", async () => {
    const em = `edit-pw-${testId}@test.mx`;
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: em, password: "longenough1" }).expect(201);
    await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "WRONG", newPassword: "newlongenough1" })
      .expect(401);
    await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "longenough1", newPassword: "short" })
      .expect(400);
    await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "longenough1", newPassword: "newlongenough1" })
      .expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/login").send({ email: em, password: "longenough1" }).expect(401);
    await agent.post("/api/auth/login").send({ email: em, password: "newlongenough1" }).expect(200);
  });

  it("admin can list users", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" }).expect(201);
    const r = await agent.get("/api/admin/users").expect(200);
    expect(Array.isArray(r.body.users)).toBe(true);
    expect(r.body.total).toBeGreaterThanOrEqual(1);
  });

  it("non-admin cannot access admin API", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: regularEmail, password: "longenough1" }).expect(201);
    await agent.get("/api/admin/users").expect(403);
  });

  it("handoff create and consume (token single-use)", async () => {
    const a1 = request.agent(app);
    const cr = await a1.post("/api/auth/handoff/create").send({}).expect(200);
    const token = cr.body.token as string;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    const a2 = request.agent(app);
    const cons = await a2.post("/api/auth/handoff/consume").send({ token }).expect(200);
    expect(cons.body.publisherId).toBeTruthy();
    await a2.post("/api/auth/handoff/consume").send({ token }).expect(400);
  });

  it("groups create and list mine", async () => {
    const agent = request.agent(app);
    await agent.post("/api/analytics/heartbeat").expect(200);
    const g = await agent.post("/api/groups/").send({ name: "Roomies CDMX" }).expect(201);
    const mine = await agent.get("/api/groups/mine").expect(200);
    expect(Array.isArray(mine.body)).toBe(true);
    expect(mine.body.some((x: { id: string }) => x.id === g.body.id)).toBe(true);
  });

  it("GET /api/analytics/featured-cities", async () => {
    const res = await request(app).get("/api/analytics/featured-cities").expect(200);
    expect(Array.isArray(res.body.cities)).toBe(true);
  });

  it("admin can GET and PATCH a foreign draft property without the owner publisher cookie", async () => {
    const owner = request.agent(app);
    const cr = await owner
      .post("/api/properties")
      .send({
        postMode: "property",
        title: "Draft ajeno",
        city: "Guadalajara",
        neighborhood: "Centro",
        lat: 20.67,
        lng: -103.35,
        contactWhatsApp: "5213312345678",
        summary: "",
      })
      .expect(201);
    const propertyId = cr.body.id as string;

    await request(app).get(`/api/properties/${encodeURIComponent(propertyId)}`).expect(404);

    const admin = request.agent(app);
    const login = await admin.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" });
    if (login.status !== 200) {
      await admin.post("/api/auth/register").send({ email: bossEmail, password: "longenough1" }).expect(201);
      await admin.post("/api/auth/login").send({ email: bossEmail, password: "longenough1" }).expect(200);
    }
    const bundle = await admin.get(`/api/properties/${encodeURIComponent(propertyId)}`).expect(200);
    expect(bundle.body.property.id).toBe(propertyId);

    const patched = await admin
      .patch(`/api/properties/${encodeURIComponent(propertyId)}`)
      .send({ title: "Actualizado por admin" })
      .expect(200);
    expect(patched.body.title).toBe("Actualizado por admin");
  });

  it("production: register starts session; login works immediately", async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevCookie = process.env.TEST_DISABLE_SECURE_COOKIE;
    process.env.NODE_ENV = "production";
    process.env.TEST_DISABLE_SECURE_COOKIE = "1";
    const dir2 = mkdtempSync(join(tmpdir(), "bestie-prodauth-"));
    const dbPath2 = join(dir2, "prod.db");
    const db2 = openDb(dbPath2);
    const app2 = createApp(db2, { databaseLabel: "prod.db", corsOrigins: ["http://localhost"] });
    try {
      const em = `prodverify-${testId}@test.mx`;
      const agent = request.agent(app2);
      await agent.post("/api/auth/register").send({ email: em, password: "longenough1" }).expect(201);
      const meAfterReg = await agent.get("/api/auth/me").expect(200);
      expect(meAfterReg.body.emailVerified).toBe(true);
      await agent.post("/api/auth/logout").expect(200);
      await agent.get("/api/auth/me").expect(401);
      await agent.post("/api/auth/login").send({ email: em, password: "longenough1" }).expect(200);
      const me = await agent.get("/api/auth/me").expect(200);
      expect(me.body.emailVerified).toBe(true);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevCookie === undefined) delete process.env.TEST_DISABLE_SECURE_COOKIE;
      else process.env.TEST_DISABLE_SECURE_COOKIE = prevCookie;
      db2.close();
      try {
        rmSync(dir2, { recursive: true, force: true });
      } catch {
        /* Windows */
      }
    }
  });
});

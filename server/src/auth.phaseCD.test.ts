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

  it("register, logout, login, /me includes isAdmin", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: userEmail, password: "longenough1", displayName: "U" })
      .expect(201);
    const me1 = await agent.get("/api/auth/me").expect(200);
    expect(me1.body.isAdmin).toBe(false);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
    await agent.post("/api/auth/login").send({ email: userEmail, password: "longenough1" }).expect(200);
    await agent.get("/api/auth/me").expect(200);
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
});

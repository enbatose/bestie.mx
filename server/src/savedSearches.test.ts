import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { buildSavedSearchEmail } from "./emails/savedSearchEmail.js";
import * as mailer from "./mailer.js";

describe("saved searches API", () => {
  const testId = randomUUID().slice(0, 8);
  const userEmail = `seeker-${testId}@test.mx`;

  let dir: string;
  let db: DatabaseSync;
  let app: Application;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    dir = mkdtempSync(join(tmpdir(), "bestie-saved-search-"));
    db = openDb(join(dir, "t.db"));
    app = createApp(db, { databaseLabel: "t.db", corsOrigins: ["http://localhost"] });
  });

  afterAll(() => {
    db.close();
    process.env.NODE_ENV = prevNodeEnv;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("requires auth to list saved searches", async () => {
    await request(app).get("/api/saved-searches").expect(401);
  });

  it("upserts draft, promotes, and excludes draft from list", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: `draft-${testId}@test.mx`, password: "longenough1", displayName: "Draft" })
      .expect(201);

    const payload = {
      cityCode: "gdl",
      filters: {
        q: "",
        budgetMin: null,
        budgetMax: 9000,
        tags: [],
        pref: null,
        age: null,
        ageMin: null,
        ageMax: null,
        bbox: null,
        lodgingType: null,
        wantHouse: false,
        wantApartment: false,
        wantLoft: false,
        availableFrom: null,
        minimalStayMonths: null,
        roomDimensions: [],
        avalRequired: null,
        subletAllowed: null,
      },
      location: {
        cityCode: "gdl",
        cityLabel: "Guadalajara",
        neighborhoods: [{ name: "Providencia", lat: 20.69, lng: -103.38 }],
        lat: 20.67,
        lng: -103.34,
        zoom: 12,
      },
      searchUrl: "/buscar/gdl?max=9000&lat=20.67&lng=-103.34&z=12",
    };

    const draft = await agent.put("/api/saved-searches/draft").send(payload).expect(200);
    expect(draft.body.isDraft).toBe(true);
    expect(draft.body.label).toContain("Guadalajara");
    expect(draft.body.label).toContain("Providencia");

    const listWhileDraft = await agent.get("/api/saved-searches").expect(200);
    expect(listWhileDraft.body).toHaveLength(0);

    const promoted = await agent
      .post("/api/saved-searches/draft/promote")
      .send({ label: "Mi búsqueda GDL" })
      .expect(200);
    expect(promoted.body.isDraft).toBe(false);
    expect(promoted.body.label).toBe("Mi búsqueda GDL");

    const listAfter = await agent.get("/api/saved-searches").expect(200);
    expect(listAfter.body).toHaveLength(1);
  });

  it("creates, lists, enables notify (one active), unsubscribes", async () => {
    vi.spyOn(mailer, "sendTransactionalEmail").mockResolvedValue(true);

    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: userEmail, password: "longenough1", displayName: "Seeker" })
      .expect(201);

    const payload = {
      cityCode: "gdl",
      filters: {
        q: "",
        budgetMin: null,
        budgetMax: 8000,
        tags: [],
        pref: null,
        age: null,
        ageMin: null,
        ageMax: null,
        bbox: null,
        lodgingType: null,
        wantHouse: false,
        wantApartment: false,
        wantLoft: false,
        availableFrom: null,
        minimalStayMonths: null,
        roomDimensions: [],
        avalRequired: null,
        subletAllowed: null,
      },
      location: {
        cityCode: "gdl",
        cityLabel: "Guadalajara",
        neighborhoods: [],
        lat: 20.67,
        lng: -103.34,
        zoom: 12,
      },
      searchUrl: "/buscar/gdl?max=8000&lat=20.67&lng=-103.34&z=12",
      label: "GDL test",
    };

    const created = await agent.post("/api/saved-searches").send(payload).expect(201);
    expect(created.body.label).toBe("GDL test");
    expect(created.body.emailNotifyEnabled).toBe(false);

    const list1 = await agent.get("/api/saved-searches").expect(200);
    expect(list1.body).toHaveLength(1);

    const enabled = await agent
      .post(`/api/saved-searches/${created.body.id}/enable-notify`)
      .send({})
      .expect(200);
    expect(enabled.body.emailNotifyEnabled).toBe(true);
    expect(mailer.sendTransactionalEmail).toHaveBeenCalled();

    const second = await agent
      .post("/api/saved-searches")
      .send({
        ...payload,
        label: "GDL two",
        filters: { ...payload.filters, budgetMax: 7000 },
        searchUrl: "/buscar/gdl?max=7000&lat=20.67&lng=-103.34&z=12",
      })
      .expect(201);

    const enabled2 = await agent
      .post(`/api/saved-searches/${second.body.id}/enable-notify`)
      .send({})
      .expect(200);
    expect(enabled2.body.replacedPrevious?.label).toBe("GDL test");

    const list2 = await agent.get("/api/saved-searches").expect(200);
    const active = list2.body.filter((r: { emailNotifyEnabled: boolean }) => r.emailNotifyEnabled);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second.body.id);

    const tokenRow = db
      .prepare(`SELECT unsubscribe_token FROM saved_searches WHERE id = ?`)
      .get(second.body.id) as { unsubscribe_token: string };

    const unsub = await request(app)
      .get(`/api/saved-searches/unsubscribe/${tokenRow.unsubscribe_token}`)
      .expect(200);
    expect(unsub.text).toContain("Alertas desactivadas");

    const row = db
      .prepare(`SELECT email_notify_enabled FROM saved_searches WHERE id = ?`)
      .get(second.body.id) as { email_notify_enabled: number };
    expect(row.email_notify_enabled).toBe(0);

    vi.restoreAllMocks();
  });

  it("email template includes unsubscribe link", () => {
    const mail = buildSavedSearchEmail({
      label: "Test",
      searchUrl: "/buscar/gdl",
      unsubscribeToken: "abc123",
      mode: "initial",
      newListings: [],
      otherListings: [],
    });
    expect(mail.html).toContain("Dejar de recibir alertas de esta búsqueda");
    expect(mail.html).toContain("/api/saved-searches/unsubscribe/abc123");
    expect(mail.text).toContain("/api/saved-searches/unsubscribe/abc123");
    expect(mail.subject.startsWith("Bestie ·")).toBe(true);
    expect(mail.html).toContain("#143D30");
    expect(mail.previewText.length).toBeGreaterThan(10);
    expect(mail.replyTo).toBe("contacto@bestie.mx");
  });
});

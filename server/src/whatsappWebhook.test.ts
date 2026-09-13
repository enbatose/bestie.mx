import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Application } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { getMessengerChat } from "./messengerSessionStore.js";
import { whatsappSessionId, whatsappSessionIdsForStoredPhone } from "./whatsappCloud.js";

describe("whatsapp session ids", () => {
  it("covers MX extra-1 variants", () => {
    const ids = whatsappSessionIdsForStoredPhone("+523318632070");
    expect(ids).toContain("wa:523318632070");
    expect(ids).toContain("wa:5213318632070");
  });
});

describe("whatsapp webhook", () => {
  let dir: string;
  let db: DatabaseSync;
  let app: Application;
  const secret = "wa-webhook-test-secret-xxxxxx";
  const verify = "wa-verify-token-test";
  const prevSecret = process.env.WHATSAPP_APP_SECRET;
  const prevVerify = process.env.WHATSAPP_VERIFY_TOKEN;
  const prevPhone = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  beforeAll(() => {
    process.env.WHATSAPP_APP_SECRET = secret;
    process.env.WHATSAPP_VERIFY_TOKEN = verify;
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = "phone-prod";
    dir = mkdtempSync(join(tmpdir(), "bestie-wa-"));
    db = openDb(join(dir, "test.db"));
    app = createApp(db, { databaseLabel: "test.db", databasePath: join(dir, "test.db") });
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = prevSecret;
    if (prevVerify === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = prevVerify;
    if (prevPhone === undefined) delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = prevPhone;
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("verifies the webhook challenge", async () => {
    const res = await request(app)
      .get("/api/whatsapp/webhook")
      .query({ "hub.mode": "subscribe", "hub.verify_token": verify, "hub.challenge": "abc123" })
      .expect(200);
    expect(res.text).toBe("abc123");
  });

  it("rejects unsigned posts when the app secret is set", async () => {
    await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .send({ object: "whatsapp_business_account", entry: [] })
      .expect(403);
  });

  it("accepts a signed inbound text and stores a session", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone-prod" },
                messages: [
                  {
                    id: "wamid.test.hola",
                    from: "5213318632070",
                    type: "text",
                    text: { body: "hola" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", `sha256=${sig}`)
      .send(payload)
      .expect(200);

    const s = getMessengerChat(db, whatsappSessionId("5213318632070"));
    expect(s?.flow).toBe("idle");
  });
});

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeEach } from "vitest";
import {
  bindUsageAnalyticsDb,
  buildUsageAnalyticsResponse,
  recordEmailReceived,
  recordEmailSent,
  recordGeminiTokens,
  recordShareAiGenerate,
  recordWhatsAppOtpSend,
} from "./usageAnalytics.js";

function openMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE analytics_daily (
      day TEXT NOT NULL,
      metric TEXT NOT NULL,
      dimension TEXT NOT NULL DEFAULT '',
      value INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, metric, dimension)
    );
    CREATE TABLE upload_blobs (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE whatsapp_otp_challenges (
      id TEXT PRIMARY KEY,
      phone_e164 TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

describe("usageAnalytics", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openMemoryDb();
    bindUsageAnalyticsDb(db);
  });

  it("rolls up Resend quota units without double-counting channel dims", () => {
    recordEmailSent({ tags: [{ name: "category", value: "email_verification" }], channel: "resend" });
    recordEmailSent({ tags: [{ name: "category", value: "saved_search" }], channel: "resend" });
    recordEmailReceived("contacto_forward");

    const month = new Date().toISOString().slice(0, 7);
    const body = buildUsageAnalyticsResponse(db, month);
    expect(body).not.toBeNull();
    expect(body!.resend.sent).toBe(2);
    expect(body!.resend.received).toBe(1);
    expect(body!.resend.quotaUnits).toBe(3);
    expect(body!.resend.byCategory.email_verification).toBe(1);
    expect(body!.resend.byChannel.resend).toBe(2);
  });

  it("estimates Gemini USD from token counters", () => {
    recordShareAiGenerate("gemini", "property");
    recordShareAiGenerate("stored", "property");
    recordGeminiTokens(1_000_000, 1_000_000, "gemini-3.1-flash-lite");

    const month = new Date().toISOString().slice(0, 7);
    const body = buildUsageAnalyticsResponse(db, month)!;
    expect(body.gemini.calls).toBe(1);
    expect(body.gemini.storedCacheHits).toBe(1);
    expect(body.gemini.promptTokens).toBe(1_000_000);
    expect(body.gemini.outputTokens).toBe(1_000_000);
    // 0.25 + 1.5
    expect(body.gemini.estimatedUsd).toBeCloseTo(1.75, 5);
  });

  it("tracks WhatsApp OTP results and storage snapshot", () => {
    recordWhatsAppOtpSend("ok");
    recordWhatsAppOtpSend("skipped");
    db.prepare(
      `INSERT INTO upload_blobs (filename, mime_type, bytes, created_at) VALUES (?, ?, ?, ?)`,
    ).run("a.jpg", "image/jpeg", Buffer.from("hello"), new Date().toISOString());

    const month = new Date().toISOString().slice(0, 7);
    const body = buildUsageAnalyticsResponse(db, month)!;
    expect(body.whatsappOtp.trackedSends).toBe(2);
    expect(body.whatsappOtp.byResult.ok).toBe(1);
    expect(body.storage.blobCount).toBe(1);
    expect(body.storage.totalBytes).toBe(5);
  });
});

import { describe, expect, it, afterEach } from "vitest";
import {
  enqueueWhatsAppAlbumImages,
  pendingWhatsAppAlbumImageCount,
  resetWhatsAppAlbumBuffersForTests,
  sortWhatsAppAlbumImages,
  WHATSAPP_ALBUM_COALESCE_MS,
} from "./whatsappAlbumBuffer.js";
import { mergeWhatsAppPhotoUrls } from "./whatsappSessionStore.js";

describe("mergeWhatsAppPhotoUrls", () => {
  it("keeps the first slots and counts dropped extras", () => {
    const existing = [
      "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.jpg",
      "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000002.jpg",
    ];
    const incoming = Array.from({ length: 15 }, (_, i) => {
      const n = String(i + 10).padStart(12, "0");
      return `/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-${n}.jpg`;
    });
    const merged = mergeWhatsAppPhotoUrls(existing, incoming, 12);
    expect(merged.urls).toHaveLength(12);
    expect(merged.added).toBe(10);
    expect(merged.dropped).toBe(5);
  });
});

describe("whatsapp album coalesce buffer", () => {
  afterEach(() => {
    resetWhatsAppAlbumBuffersForTests();
  });

  it("buffers images across enqueues until the coalesce window", () => {
    const db = {} as import("node:sqlite").DatabaseSync;
    expect(WHATSAPP_ALBUM_COALESCE_MS).toBeGreaterThanOrEqual(5_000);
    enqueueWhatsAppAlbumImages(db, "5213318632070", [{ id: "m1" }, { id: "m2" }], {
      coalesceMs: 60_000,
    });
    expect(pendingWhatsAppAlbumImageCount("5213318632070")).toBe(2);
    enqueueWhatsAppAlbumImages(db, "5213318632070", [{ id: "m2" }, { id: "m3" }], {
      coalesceMs: 60_000,
    });
    expect(pendingWhatsAppAlbumImageCount("5213318632070")).toBe(3);
  });

  it("sorts by WhatsApp message timestamp so first-12 follows send order", () => {
    const sorted = sortWhatsAppAlbumImages([
      { id: "late", timestampSec: 200, enqueueSeq: 0 },
      { id: "early", timestampSec: 100, enqueueSeq: 1 },
      { id: "mid", timestampSec: 150, enqueueSeq: 2 },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["early", "mid", "late"]);
  });
});

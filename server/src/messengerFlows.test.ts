import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { getMessengerChat } from "./messengerSessionStore.js";
import { processMessengerUserInput } from "./messengerFlows.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, parseFilters } from "./searchFilters.js";

describe("Messenger flows (session + state)", () => {
  let dir: string;
  let dbPath: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-messenger-"));
    dbPath = join(dir, "m.db");
    db = openDb(dbPath);
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* */
    }
  });

  it("MB_HELP resets flow to idle", async () => {
    const psid = "test-psid-1";
    await processMessengerUserInput(db, psid, { postback: "MB_HELP" });
    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");
  });

  it("MB_SEARCH moves to search_city", async () => {
    const psid = "test-psid-2";
    await processMessengerUserInput(db, psid, { postback: "MB_SEARCH" });
    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("search_city");
  });

  it("defaults any-city messenger search to Guadalajara", async () => {
    const psid = "test-psid-3";
    await processMessengerUserInput(db, psid, { postback: "MB_SEARCH" });
    await processMessengerUserInput(db, psid, { quickReplyPayload: "MB_CITY:*" });
    await processMessengerUserInput(db, psid, { quickReplyPayload: "MB_BD:*" });
    await processMessengerUserInput(db, psid, { quickReplyPayload: "MB_PREF:any" });

    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");

    const filters = parseFilters(
      new URLSearchParams({
        q: "Guadalajara",
      }),
    );
    const results = filterListings(fetchPublishedListings(db), filters);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((listing) => listing.city === "Guadalajara")).toBe(true);
  });
});

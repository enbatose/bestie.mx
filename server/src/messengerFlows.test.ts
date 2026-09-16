import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatSink } from "./chatChannel.js";
import { openDb } from "./db.js";
import { getMessengerChat } from "./messengerSessionStore.js";
import { processMessengerUserInput } from "./messengerFlows.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import { filterListings, parseFilters } from "./searchFilters.js";

function capturingSink(texts: string[]): ChatSink {
  return {
    sendText: async (t) => {
      texts.push(t);
    },
    sendQuickReplies: async (t) => {
      texts.push(t);
    },
    sendListingCards: async (cards, footer) => {
      texts.push(cards.map((c) => c.title).join(" | "));
      texts.push(footer);
    },
  };
}

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

  it("treats hola as the main menu", async () => {
    const psid = "test-psid-hola";
    await processMessengerUserInput(db, psid, { text: "hola" });
    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");
  });

  it("MB_HELP resets flow to idle", async () => {
    const psid = "test-psid-1";
    await processMessengerUserInput(db, psid, { postback: "MB_HELP" });
    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");
  });

  it("MB_SEARCH asks for a GDL zone", async () => {
    const psid = "test-psid-2";
    await processMessengerUserInput(db, psid, { postback: "MB_SEARCH" });
    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("search_zone");
  });

  it("returns matches on the zone tap and pins the zone on the draft", async () => {
    const psid = "test-psid-zone";
    const texts: string[] = [];
    const sink = capturingSink(texts);
    await processMessengerUserInput(db, psid, { postback: "MB_SEARCH" }, sink);
    await processMessengerUserInput(db, psid, { quickReplyPayload: "MB_POI:centro" }, sink);

    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");
    expect(s?.draft.poiName).toBe("Centro");
    // Results (or an honest "nothing here, this is what the city has") land on that same tap.
    expect(texts.some((t) => t.includes("Centro"))).toBe(true);
    expect(texts.some((t) => /Guadalajara/.test(t))).toBe(true);
  });

  it("defaults the whole-city messenger search to Guadalajara", async () => {
    const psid = "test-psid-3";
    const texts: string[] = [];
    const sink = capturingSink(texts);
    await processMessengerUserInput(db, psid, { postback: "MB_SEARCH" }, sink);
    await processMessengerUserInput(db, psid, { quickReplyPayload: "MB_POI:*" }, sink);

    const s = getMessengerChat(db, psid);
    expect(s?.flow).toBe("idle");
    expect(s?.draft.zoneLabel).toBe("Guadalajara");
    expect(s?.draft.poiLat).toBeNull();

    const filters = parseFilters(new URLSearchParams({ q: "Guadalajara" }));
    const results = filterListings(fetchPublishedListings(db), filters);
    expect(results.every((listing) => listing.city === "Guadalajara")).toBe(true);
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearLiveEditSession,
  consumePhotoPickerIntent,
  markPhotoPickerIntent,
  readLiveEditSession,
  writeLiveEditSession,
  type LiveEditSession,
} from "@/lib/publishWizard/liveEditSession";

function installMemorySessionStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("sessionStorage", memory);
}

function sampleSession(overrides: Partial<LiveEditSession> = {}): LiveEditSession {
  return {
    propertyId: "prop-1",
    roomId: "room-1",
    scope: "room",
    status: "published",
    draft: {
      postMode: "room",
      rooms: [
        {
          id: "r1",
          customName: "",
          occupancyStatus: "available",
          occupantGender: "any",
          occupantAge: 25,
          occupantWomenCount: 0,
          occupantMenCount: 0,
          title: "Cuarto",
          rentMxn: 5000,
          depositMxn: 0,
          roomsAvailable: 1,
          summary: "",
          tags: [],
          roommateGenderPref: "any",
          ageMin: 22,
          ageMax: 45,
          lodgingType: "private_room",
          availableFrom: "2026-07-26",
          minimalStayMonths: 1,
          roomDimension: "medium",
          avalRequired: false,
          rentIncludesUtilities: false,
          photos: [],
        },
      ],
      propertyTitle: "Test",
    } as LiveEditSession["draft"],
    serverSync: { propertyId: "prop-1", roomIds: ["room-1"] },
    previewRoomIndex: 0,
    returnListingId: "room-1",
    editingPhotos: true,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("liveEditSession", () => {
  beforeEach(() => {
    installMemorySessionStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T20:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("round-trips a live edit snapshot", () => {
    writeLiveEditSession(sampleSession());
    const read = readLiveEditSession();
    expect(read?.propertyId).toBe("prop-1");
    expect(read?.editingPhotos).toBe(true);
    expect(read?.draft.propertyTitle).toBe("Test");
  });

  it("expires stale sessions", () => {
    writeLiveEditSession(sampleSession());
    vi.setSystemTime(new Date("2026-07-27T00:00:00Z"));
    expect(readLiveEditSession()).toBeNull();
  });

  it("consumes photo picker intent once", () => {
    markPhotoPickerIntent("camera");
    expect(consumePhotoPickerIntent()?.source).toBe("camera");
    expect(consumePhotoPickerIntent()).toBeNull();
  });

  it("clearLiveEditSession removes the snapshot", () => {
    writeLiveEditSession(sampleSession());
    clearLiveEditSession();
    expect(readLiveEditSession()).toBeNull();
  });
});

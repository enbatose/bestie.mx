import { describe, expect, it } from "vitest";
import {
  preferDraftImages,
  syncDraftPhotoArrays,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";

function imgs(...urls: string[]): DraftImage[] {
  return urls.map((url, i) => ({ url, isCover: i === 0 }));
}

describe("preferDraftImages", () => {
  it("recovers photos added only on the legacy mirror", () => {
    const primary = imgs("/a.jpg", "/b.jpg");
    const legacy = imgs("/a.jpg", "/b.jpg", "/c.jpg");
    expect(preferDraftImages(primary, legacy).map((i) => i.url)).toEqual([
      "/a.jpg",
      "/b.jpg",
      "/c.jpg",
    ]);
  });

  it("keeps canonical when lists match", () => {
    const primary = imgs("/a.jpg");
    const legacy = imgs("/a.jpg");
    expect(preferDraftImages(primary, legacy)).toEqual(primary);
  });

  it("keeps canonical when a deletion only landed on the legacy mirror", () => {
    const primary = imgs("/a.jpg", "/b.jpg");
    const legacy = imgs("/a.jpg");
    expect(preferDraftImages(primary, legacy).map((i) => i.url)).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("honors an explicit empty primary (gallery cleared)", () => {
    expect(preferDraftImages([], imgs("/old.jpg"))).toEqual([]);
  });

  it("falls back when primary is undefined", () => {
    expect(preferDraftImages(undefined, imgs("/only.jpg")).map((i) => i.url)).toEqual(["/only.jpg"]);
  });
});

describe("syncDraftPhotoArrays", () => {
  it("writes both property mirrors from a legacy-only add", () => {
    const synced = syncDraftPhotoArrays({
      commonAreaPhotos: imgs("/old.jpg"),
      propertyImageUrls: imgs("/old.jpg", "/new.jpg"),
      unassignedImageUrls: [],
      roomImageUrls: [[]],
      rooms: [{ photos: [] }],
    });
    // Explicit empty rooms[0].photos must not revive; property mirrors still merge.
    expect(synced.commonAreaPhotos.map((i) => i.url)).toEqual(["/old.jpg", "/new.jpg"]);
    expect(synced.propertyImageUrls.map((i) => i.url)).toEqual(["/old.jpg", "/new.jpg"]);
    expect(synced.rooms[0]!.photos).toEqual([]);
  });

  it("clears room mirrors when photos were explicitly emptied", () => {
    const synced = syncDraftPhotoArrays({
      commonAreaPhotos: [],
      propertyImageUrls: [],
      unassignedImageUrls: [],
      roomImageUrls: [imgs("/old.jpg", "/new.jpg")],
      rooms: [{ photos: [] }],
    });
    expect(synced.rooms[0]!.photos).toEqual([]);
    expect(synced.roomImageUrls[0]).toEqual([]);
  });

  it("writes both room mirrors from a legacy-only add", () => {
    const synced = syncDraftPhotoArrays({
      commonAreaPhotos: [],
      propertyImageUrls: [],
      unassignedImageUrls: [],
      roomImageUrls: [imgs("/old.jpg", "/new.jpg")],
      rooms: [{ photos: imgs("/old.jpg") }],
    });
    expect(synced.rooms[0]!.photos!.map((i) => i.url)).toEqual(["/old.jpg", "/new.jpg"]);
    expect(synced.roomImageUrls[0]!.map((i) => i.url)).toEqual(["/old.jpg", "/new.jpg"]);
  });
});

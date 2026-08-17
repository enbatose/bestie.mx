import { describe, expect, it } from "vitest";
import {
  assignDraftPhoto,
  hydrateRoomModePhotosFromProperty,
  mirrorRoomModePhotosToProperty,
  preferDraftImages,
  roomModeEditorImages,
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

describe("hydrateRoomModePhotosFromProperty", () => {
  it("copies property photos onto an empty room slot for room-mode drafts", () => {
    const photos = imgs("/a.jpg", "/b.jpg");
    const hydrated = hydrateRoomModePhotosFromProperty({
      postMode: "room",
      commonAreaPhotos: photos,
      propertyImageUrls: photos,
      roomImageUrls: [[]],
      rooms: [{ photos: [] }],
    });
    expect(hydrated.rooms[0]!.photos!.map((i) => i.url)).toEqual(["/a.jpg", "/b.jpg"]);
    expect(hydrated.roomImageUrls[0]!.map((i) => i.url)).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("does not overwrite an existing room gallery", () => {
    const hydrated = hydrateRoomModePhotosFromProperty({
      postMode: "room",
      commonAreaPhotos: imgs("/prop.jpg"),
      propertyImageUrls: imgs("/prop.jpg"),
      roomImageUrls: [imgs("/room.jpg")],
      rooms: [{ photos: imgs("/room.jpg") }],
    });
    expect(hydrated.rooms[0]!.photos!.map((i) => i.url)).toEqual(["/room.jpg"]);
  });

  it("does not overwrite when only the legacy roomImageUrls row has photos", () => {
    const hydrated = hydrateRoomModePhotosFromProperty({
      postMode: "room",
      commonAreaPhotos: imgs("/prop.jpg"),
      propertyImageUrls: imgs("/prop.jpg"),
      roomImageUrls: [imgs("/room.jpg")],
      rooms: [{ photos: [] }],
    });
    expect(hydrated.rooms[0]!.photos).toEqual([]);
    expect(hydrated.roomImageUrls[0]!.map((i) => i.url)).toEqual(["/room.jpg"]);
  });

  it("does not copy property common-area photos into property-mode rooms", () => {
    const hydrated = hydrateRoomModePhotosFromProperty({
      postMode: "property",
      commonAreaPhotos: imgs("/shared.jpg"),
      propertyImageUrls: imgs("/shared.jpg"),
      roomImageUrls: [[]],
      rooms: [{ photos: [] }],
    });
    expect(hydrated.rooms[0]!.photos).toEqual([]);
  });
});

describe("mirrorRoomModePhotosToProperty", () => {
  it("clears property mirrors when the room gallery is emptied", () => {
    const mirrored = mirrorRoomModePhotosToProperty({
      postMode: "room",
      commonAreaPhotos: imgs("/old.jpg"),
      propertyImageUrls: imgs("/old.jpg"),
      roomImageUrls: [[]],
      rooms: [{ photos: [] }],
    });
    expect(mirrored.commonAreaPhotos).toEqual([]);
    expect(mirrored.propertyImageUrls).toEqual([]);
  });
});

describe("roomModeEditorImages", () => {
  it("shows property photos in the room editor when the room slot is empty", () => {
    expect(
      roomModeEditorImages("room", [], [], imgs("/ai.jpg"), imgs("/ai.jpg")).map((i) => i.url),
    ).toEqual(["/ai.jpg"]);
  });

  it("does not fall back to property photos for property-mode rooms", () => {
    expect(roomModeEditorImages("property", [], [], imgs("/shared.jpg"), imgs("/shared.jpg"))).toEqual([]);
  });
});

describe("assignDraftPhoto", () => {
  it("moves a shared photo onto a room without leaving a copy", () => {
    const next = assignDraftPhoto(
      {
        commonAreaPhotos: imgs("/sala.jpg", "/cuarto.jpg"),
        propertyImageUrls: imgs("/sala.jpg", "/cuarto.jpg"),
        unassignedImageUrls: [],
        roomImageUrls: [[]],
        rooms: [{ photos: [] }],
      },
      "/cuarto.jpg",
      "room:1",
    );
    expect(next.commonAreaPhotos.map((i) => i.url)).toEqual(["/sala.jpg"]);
    expect(next.rooms[0]!.photos!.map((i) => i.url)).toEqual(["/cuarto.jpg"]);
    expect(next.unassignedImageUrls).toEqual([]);
  });

  it("moves a room photo back to shared areas", () => {
    const next = assignDraftPhoto(
      {
        commonAreaPhotos: imgs("/sala.jpg"),
        propertyImageUrls: imgs("/sala.jpg"),
        unassignedImageUrls: [],
        roomImageUrls: [imgs("/cuarto.jpg")],
        rooms: [{ photos: imgs("/cuarto.jpg") }],
      },
      "/cuarto.jpg",
      "shared",
    );
    expect(next.commonAreaPhotos.map((i) => i.url)).toEqual(["/sala.jpg", "/cuarto.jpg"]);
    expect(next.rooms[0]!.photos).toEqual([]);
  });
});

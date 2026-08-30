import { describe, expect, it } from "vitest";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import {
  firstRoomIndexMissingRent,
  firstStandaloneRoomFixSection,
  formatRoomsValidationMessage,
  isRentRequiredPublishError,
  PUBLISH_PREVIEW_HEADER_ID,
  rentRequiredPublishMessage,
  roomPreviewOptionLabel,
  roomSaveIssuesHeading,
  roomSaveIssuesOpenLabel,
  roomSaveIssuesPrimaryLabel,
  standaloneRoomFixAnchorId,
} from "./roomWizardValidation";

function sampleRoom(overrides: Partial<RoomDraft> = {}): RoomDraft {
  return {
    id: "r1",
    customName: "",
    occupancyStatus: "available",
    occupantGender: "any",
    occupantAge: 25,
    occupantWomenCount: 0,
    occupantMenCount: 0,
    title: "Recámara 1",
    rentMxn: 0,
    depositMxn: 0,
    roomsAvailable: 1,
    summary: "x".repeat(120),
    tags: ["estudiantes"],
    roommateGenderPref: "any",
    ageMin: 22,
    ageMax: 45,
    lodgingType: "private_room",
    availableFrom: "2026-08-15",
    minimalStayMonths: 1,
    roomDimension: "medium",
    avalRequired: false,
    rentIncludesUtilities: false,
    photos: [],
    ...overrides,
  };
}

function sampleDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    postMode: "room",
    roomCreateFlow: "manual",
    city: "Guadalajara",
    propertyTitle: "Casa en Americana",
    neighborhood: "Americana",
    contactWhatsApp: "",
    propertySummary: "x".repeat(120),
    propertyKind: "house",
    propertyBedroomsTotal: 1,
    propertyBathrooms: 1,
    occupiedByWomenCount: 0,
    occupiedByMenCount: 0,
    showWhatsApp: false,
    useCustomMapPin: false,
    customLat: "",
    customLng: "",
    propertyImageUrls: [],
    commonAreaPhotos: [],
    unassignedImageUrls: [],
    roomImageUrls: [[]],
    propertyTags: [],
    rooms: [sampleRoom()],
    legalAccepted: false,
    isApproximateLocation: false,
    approximateRadiusMeters: 200,
    hidePricing: false,
    ...overrides,
  };
}

describe("roomPreviewOptionLabel", () => {
  it("uses Recámara N when the first property room has no title", () => {
    expect(roomPreviewOptionLabel({ title: "", customName: "" }, 0)).toBe("Recámara 1");
  });

  it("does not repeat numbered defaults like Recámara 2: Recámara 2", () => {
    expect(roomPreviewOptionLabel({ title: "Recámara 2", customName: "" }, 1)).toBe("Recámara 2");
    expect(roomPreviewOptionLabel({ title: "Habitación 3", customName: "" }, 2)).toBe("Recámara 3");
  });

  it("keeps a real custom name after the number", () => {
    expect(
      roomPreviewOptionLabel({ title: "Cuarto con balcón", customName: "" }, 0),
    ).toBe("Recámara 1: Cuarto con balcón");
  });
});

describe("single-room missing-field copy", () => {
  it("omits Recámara 1 and property title from the blocked-reason text", () => {
    const message = formatRoomsValidationMessage(sampleDraft());
    expect(message).toBe("Indica la renta mensual en MXN. No se puede guardar en 0.");
    expect(message).not.toMatch(/Recámara/i);
    expect(message).not.toMatch(/Casa en Americana/);
  });

  it("still names the room on a property post", () => {
    const message = formatRoomsValidationMessage(
      sampleDraft({
        postMode: "property",
        rooms: [sampleRoom({ title: "", customName: "" })],
      }),
    );
    expect(message).toMatch(/^Recámara 1:/);
  });

  it("uses anuncio copy in the review callout and CTAs", () => {
    const draft = sampleDraft();
    expect(roomSaveIssuesHeading(draft, "Para publicar,")).toBe(
      "Para publicar, falta completar el anuncio.",
    );
    expect(roomSaveIssuesOpenLabel(draft, "Recámara 1")).toBe("Completar");
    expect(roomSaveIssuesPrimaryLabel(draft, 0)).toBe("Completar anuncio");
  });

  it("keeps numbered copy for property posts", () => {
    const draft = sampleDraft({ postMode: "property" });
    expect(roomSaveIssuesHeading(draft, "Para publicar,")).toBe(
      "Para publicar, falta completar una o más recámaras.",
    );
    expect(roomSaveIssuesOpenLabel(draft, "Recámara 1")).toBe("Completar");
    expect(roomSaveIssuesPrimaryLabel(draft, 0)).toBe("Completar Recámara 1");
  });

  it("does not require occupant gender counts on occupied property rooms", () => {
    const draft = sampleDraft({
      postMode: "property",
      rooms: [sampleRoom({ occupancyStatus: "occupied", occupantWomenCount: 0, occupantMenCount: 0 })],
    });
    expect(formatRoomsValidationMessage(draft)).toBeNull();
  });

  it("points Completar at the rent header on a single-room post missing price", () => {
    const draft = sampleDraft();
    const section = firstStandaloneRoomFixSection(draft, draft.rooms[0]!);
    expect(section).toBe("header");
    expect(standaloneRoomFixAnchorId(section)).toBe(PUBLISH_PREVIEW_HEADER_ID);
  });
});

describe("firstRoomIndexMissingRent", () => {
  it("skips occupied rooms and returns the first available room without rent", () => {
    const draft = sampleDraft({
      postMode: "property",
      rooms: [
        sampleRoom({ occupancyStatus: "occupied", rentMxn: 0 }),
        sampleRoom({ id: "r2", title: "Habitación 2", rentMxn: 0 }),
        sampleRoom({ id: "r3", title: "Habitación 3", rentMxn: 8200 }),
      ],
      roomImageUrls: [[], [], []],
    });
    expect(firstRoomIndexMissingRent(draft)).toBe(1);
  });

  it("returns -1 when every available room has rent", () => {
    const draft = sampleDraft({
      rooms: [sampleRoom({ rentMxn: 8200 })],
    });
    expect(firstRoomIndexMissingRent(draft)).toBe(-1);
  });

  it("skips rent when hidePricing is on", () => {
    const draft = sampleDraft({
      hidePricing: true,
      rooms: [sampleRoom({ rentMxn: 0 })],
    });
    expect(firstRoomIndexMissingRent(draft)).toBe(-1);
    expect(formatRoomsValidationMessage(draft)).toBeNull();
  });
});

describe("rent required copy", () => {
  it("points property posts at a recámara instead of the listing header", () => {
    expect(rentRequiredPublishMessage("property")).toMatch(/recámara disponible/i);
    expect(rentRequiredPublishMessage("room")).not.toMatch(/encabezado/i);
    expect(isRentRequiredPublishError("Falta el precio de renta en una recámara disponible.")).toBe(true);
  });
});

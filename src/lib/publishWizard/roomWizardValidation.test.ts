import { describe, expect, it } from "vitest";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";
import {
  formatRoomsValidationMessage,
  roomPreviewOptionLabel,
  roomSaveIssuesHeading,
  roomSaveIssuesOpenLabel,
  roomSaveIssuesPrimaryLabel,
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
    expect(roomSaveIssuesOpenLabel(draft, "Recámara 1")).toBe("Abrir Recámara 1 y completar");
    expect(roomSaveIssuesPrimaryLabel(draft, 0)).toBe("Completar Recámara 1");
  });
});

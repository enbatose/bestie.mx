import { describe, expect, it } from "vitest";
import { collapseSearchListings, formatSearchListingRent } from "./collapseSearchListings";
import type { PropertyListing } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function room(partial: Partial<PropertyListing> & Pick<PropertyListing, "id" | "propertyId" | "rentMxn">): PropertyListing {
  return {
    title: partial.title ?? "Room",
    city: "Guadalajara",
    neighborhood: "Americana",
    lat: 20.67,
    lng: -103.35,
    roomsAvailable: 1,
    tags: [],
    roommateGenderPref: "any",
    ageMin: 18,
    ageMax: 40,
    summary: "Resumen",
    contactWhatsApp: "",
    propertyPostMode: "property",
    propertyTitle: "Casa Demo",
    propertyImageUrls: ["/cover.jpg"],
    roomImageUrls: ["/room.jpg"],
    ...partial,
  };
}

describe("collapseSearchListings", () => {
  it("collapses property-mode siblings into one card with a rent range", () => {
    const rows = collapseSearchListings([
      room({ id: "r1", propertyId: "prp__1", rentMxn: 7500, title: "Casa Demo · Hab 1", summary: "Recámara 1 detalle" }),
      room({
        id: "r2",
        propertyId: "prp__1",
        rentMxn: 5000,
        title: "Casa Demo · Hab 2",
        summary: "Recámara amplia con clóset",
        propertySummary: "Casa amplia con áreas comunes.",
      }),
      room({
        id: "r3",
        propertyId: "prp__2",
        rentMxn: 6000,
        propertyPostMode: "room",
        propertyTitle: "Cuarto solo",
        title: "Cuarto solo",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("prp__1");
    expect(rows[0]!.propertyPostMode).toBe("property");
    expect(rows[0]!.rentMxn).toBe(5000);
    expect(rows[0]!.rentMxnMax).toBe(7500);
    expect(rows[0]!.title).toBe("Casa Demo");
    expect(rows[0]!.roomImageUrls).toEqual([]);
    expect(rows[0]!.propertyImageUrls).toEqual(["/cover.jpg"]);
    expect(rows[0]!.summary).toBe("Casa amplia con áreas comunes.");
    expect(rows[1]!.id).toBe("r3");
    expect(rows[1]!.rentMxnMax).toBeUndefined();
  });

  it("keeps a room photo when a property-mode post has no property cover", () => {
    const rows = collapseSearchListings([
      room({
        id: "r1",
        propertyId: "prp__efb392e2",
        rentMxn: 10_000,
        propertyImageUrls: undefined,
        roomImageUrls: ["/api/uploads/8d98d445-b4c1-4386-94b9-054405faa27e.jpg"],
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("prp__efb392e2");
    expect(rows[0]!.propertyImageUrls).toBeUndefined();
    expect(rows[0]!.roomImageUrls).toEqual([
      "/api/uploads/8d98d445-b4c1-4386-94b9-054405faa27e.jpg",
    ]);
  });

  it("falls back to another room photo when the cheapest room has none", () => {
    const rows = collapseSearchListings([
      room({
        id: "r-cheap",
        propertyId: "prp__2",
        rentMxn: 4000,
        propertyImageUrls: undefined,
        roomImageUrls: undefined,
      }),
      room({
        id: "r-photo",
        propertyId: "prp__2",
        rentMxn: 8000,
        propertyImageUrls: undefined,
        roomImageUrls: ["/api/uploads/room-cover.jpg"],
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.roomImageUrls).toEqual(["/api/uploads/room-cover.jpg"]);
  });

  it("formats single and ranged rents", () => {
    expect(formatSearchListingRent({ rentMxn: 5000 }, money)).toContain("5");
    expect(formatSearchListingRent({ rentMxn: 5000, rentMxnMax: 7500 }, money)).toMatch(/5.*–.*7/);
  });

  it("formats hidden pricing as Consultar $", () => {
    expect(formatSearchListingRent({ rentMxn: 0, hidePricing: true }, money)).toBe("Consultar $");
  });
});

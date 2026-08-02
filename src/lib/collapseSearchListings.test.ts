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
      room({ id: "r1", propertyId: "prp__1", rentMxn: 7500, title: "Casa Demo · Hab 1" }),
      room({ id: "r2", propertyId: "prp__1", rentMxn: 5000, title: "Casa Demo · Hab 2" }),
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
    expect(rows[1]!.id).toBe("r3");
    expect(rows[1]!.rentMxnMax).toBeUndefined();
  });

  it("formats single and ranged rents", () => {
    expect(formatSearchListingRent({ rentMxn: 5000 }, money)).toContain("5");
    expect(formatSearchListingRent({ rentMxn: 5000, rentMxnMax: 7500 }, money)).toMatch(/5.*–.*7/);
  });
});

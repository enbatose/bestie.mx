import { describe, expect, it } from "vitest";
import { listingCardQuickAttributes } from "@/components/search/searchQuickAttributes";
import type { PropertyListing } from "@/types/listing";

function listing(partial: Partial<PropertyListing>): PropertyListing {
  return {
    id: "room-1",
    propertyId: "prop-1",
    title: "Cuarto",
    city: "Guadalajara",
    neighborhood: "Americana",
    lat: 20.67,
    lng: -103.37,
    rentMxn: 4500,
    roomsAvailable: 1,
    tags: [],
    roommateGenderPref: "any",
    ageMin: 18,
    ageMax: 40,
    summary: "",
    contactWhatsApp: "",
    propertyKind: "apartment",
    lodgingType: "private_room",
    ...partial,
  };
}

describe("listingCardQuickAttributes", () => {
  it("shows every advanced filter icon the listing satisfies, including smoking aliases", () => {
    const ids = listingCardQuickAttributes(
      listing({
        tags: [
          "baño-privado",
          "estacionamiento",
          "muebles",
          "aire-acondicionado",
          "mascotas",
          "lgbt-friendly",
          "parejas",
          "fumar",
        ],
      }),
    ).map((item) => item.id);

    expect(ids).toEqual([
      "property-apartment",
      "room-private",
      "gender-mixed",
      "private-bathroom",
      "private-parking",
      "furnished",
      "tag-aire-acondicionado",
      "tag-mascotas",
      "tag-lgbt-friendly",
      "tag-parejas",
      "tag-fumar-permitido-recamara",
    ]);
  });

  it("does not invent filter icons the listing does not have", () => {
    const ids = listingCardQuickAttributes(listing({ tags: ["wifi"] })).map((item) => item.id);
    expect(ids).toEqual(["property-apartment", "room-private", "gender-mixed"]);
  });
});

import type {
  ListingTag,
  ListingStatus,
  PropertyKind,
  LodgingType,
  RoommateGenderPref,
  RoomDimension,
  PropertyWithRooms,
} from "@/types/listing";
import type { AssistedDraftClaimInfo } from "@/lib/assistedDraftApi";

/** Convert the lightweight claim-info response to a PropertyWithRooms so draftFromPropertyBundle can consume it. */
export function claimInfoToBundle(info: AssistedDraftClaimInfo): PropertyWithRooms {
  const p = info.property;
  return {
    property: {
      id: info.propertyId,
      publisherId: p.publisherId,
      status: p.status as ListingStatus,
      postMode: p.postMode as "room" | "property",
      title: p.title,
      city: p.city,
      neighborhood: p.neighborhood,
      lat: p.lat,
      lng: p.lng,
      summary: p.summary,
      contactWhatsApp: p.contactWhatsApp,
      propertyKind: (p.propertyKind ?? undefined) as PropertyKind | undefined,
      bedroomsTotal: p.bedroomsTotal,
      bathrooms: p.bathrooms,
      showWhatsApp: p.showWhatsApp,
      hidePricing: Boolean(p.hidePricing),
      imageUrls: p.imageUrls,
      isApproximateLocation: p.isApproximateLocation,
      approximateRadiusMeters: p.approximateRadiusMeters,
    },
    rooms: info.rooms.map((r, i) => ({
      id: r.id,
      propertyId: info.propertyId,
      status: "draft" as ListingStatus,
      title: r.title,
      rentMxn: r.rentMxn,
      depositMxn: r.depositMxn,
      roomsAvailable: 1,
      tags: (r.tags ?? []) as ListingTag[],
      roommateGenderPref: (r.roommateGenderPref ?? "any") as RoommateGenderPref,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      summary: r.summary,
      lodgingType: (r.lodgingType ?? undefined) as LodgingType | undefined,
      occupancyStatus: r.occupancyStatus === "occupied" ? "occupied" : "available",
      occupantWomenCount: r.occupantWomenCount,
      occupantMenCount: r.occupantMenCount,
      availableFrom: r.availableFrom ?? undefined,
      minimalStayMonths: r.minimalStayMonths ?? undefined,
      roomDimension: (r.roomDimension ?? undefined) as RoomDimension | undefined,
      sortOrder: i,
      photos:
        (r.imageUrls && r.imageUrls.length > 0) || p.postMode !== "room"
          ? r.imageUrls
          : p.imageUrls,
    })),
  };
}

import { describe, expect, it } from "vitest";
import {
  listingPublicPath,
  listingReferenceId,
  parsePropertyReferenceSuffix,
  parsePublishSuccessSearch,
  parseRoomReferenceSuffix,
  propertyMatchesEditParam,
  propertyPublicPath,
  propertyReferenceCode,
  publishWizardEditPath,
  publishWizardSuccessPath,
  roomMatchesEditParam,
  roomReferenceCode,
  wizardPropertyEditCode,
} from "./listingReference";

describe("listingReference (client)", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";

  it("parses short codes and matches UUID edit params", () => {
    expect(listingReferenceId(uuid)).toBe("550E8400");
    expect(propertyReferenceCode(`prp__${uuid}`)).toBe("P550E8400");
    expect(propertyReferenceCode(`prp__adraft_${uuid.replace(/-/g, "")}`)).toBe("P550E8400");
    expect(roomReferenceCode(`adraft_room__${uuid.replace(/-/g, "")}`)).toBe("A550E8400");
    expect(roomReferenceCode(uuid)).toBe("A550E8400");
    expect(parsePropertyReferenceSuffix("P550E8400")).toBe("550E8400");
    expect(parseRoomReferenceSuffix("a550e8400")).toBe("550E8400");
    expect(propertyMatchesEditParam(`prp__${uuid}`, "P550E8400")).toBe(true);
    expect(propertyMatchesEditParam(`prp__${uuid}`, `prp__${uuid}`)).toBe(true);
    expect(roomMatchesEditParam(uuid, "A550E8400")).toBe(true);
    expect(wizardPropertyEditCode(`prp__${uuid}`)).toBe("P550E8400");
    expect(wizardPropertyEditCode("P550E8400")).toBe("P550E8400");
  });

  it("builds wizard edit URLs with short ids", () => {
    expect(publishWizardEditPath(`prp__${uuid}`)).toBe("/publicar?edit=P550E8400");
    expect(publishWizardEditPath(`prp__${uuid}`, uuid)).toBe(
      "/publicar?edit=P550E8400&room=A550E8400",
    );
  });

  it("builds a reload-safe publish success URL", () => {
    expect(publishWizardSuccessPath({ scope: "room", roomId: uuid })).toBe(
      "/publicar/listo?anuncio=A550E8400",
    );
    expect(
      publishWizardSuccessPath({
        scope: "property",
        propertyId: `prp__${uuid}`,
        roomId: uuid,
      }),
    ).toBe("/publicar/listo?propiedad=P550E8400&anuncio=A550E8400");
    expect(parsePublishSuccessSearch(new URLSearchParams("anuncio=A550E8400"))).toEqual({
      scope: "room",
      propertyId: null,
      roomId: "A550E8400",
    });
    expect(
      parsePublishSuccessSearch(new URLSearchParams("propiedad=P550E8400&anuncio=A550E8400")),
    ).toEqual({
      scope: "property",
      propertyId: "P550E8400",
      roomId: "A550E8400",
    });
    expect(parsePublishSuccessSearch(new URLSearchParams("edit=P550E8400"))).toBeNull();
    expect(publishWizardSuccessPath({ scope: "room", roomId: "" })).toBe("/publicar/listo");
    expect(
      publishWizardSuccessPath({
        scope: "property",
        propertyId: `prp__${uuid}`,
        roomId: "   ",
      }),
    ).toBe("/publicar/listo?propiedad=P550E8400");
  });

  it("does not double-prefix an already-short room code", () => {
    const roomUuid = "313d1c64-e29b-41d4-a716-446655440000";
    expect(roomReferenceCode(roomUuid)).toBe("A313D1C64");
    expect(roomReferenceCode("A313D1C64")).toBe("A313D1C64");
    expect(roomReferenceCode("BES-A-313D1C64")).toBe("A313D1C64");
    expect(listingPublicPath(roomUuid)).toBe("/anuncio/A313D1C64");
    expect(listingPublicPath("A313D1C64")).toBe("/anuncio/A313D1C64");
    expect(propertyReferenceCode("P550E8400")).toBe("P550E8400");
    expect(propertyPublicPath("P550E8400")).toBe("/propiedad/P550E8400");
  });

  it("keeps AA when the room UUID itself starts with A", () => {
    const roomUuid = "a313d1c6-e29b-41d4-a716-446655440000";
    expect(roomReferenceCode(roomUuid)).toBe("AA313D1C6");
    expect(roomReferenceCode("AA313D1C6")).toBe("AA313D1C6");
    expect(listingPublicPath("AA313D1C6")).toBe("/anuncio/AA313D1C6");
  });
});

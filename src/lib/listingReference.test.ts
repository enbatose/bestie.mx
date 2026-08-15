import { describe, expect, it } from "vitest";
import {
  listingReferenceId,
  parsePropertyReferenceSuffix,
  parsePublishSuccessSearch,
  parseRoomReferenceSuffix,
  propertyMatchesEditParam,
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
});

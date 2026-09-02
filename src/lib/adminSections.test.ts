import { describe, expect, it } from "vitest";
import {
  ADMIN_DEFAULT_PATH,
  ADMIN_NAV_SECTIONS,
  ADMIN_SECTIONS,
  adminSectionPath,
  adminSupportConversationPath,
  adminArcoUserPath,
  parseAdminSectionSlug,
} from "./adminSections";

describe("adminSections", () => {
  it("maps each submenu to a stable /admin path", () => {
    expect(adminSectionPath("users")).toBe("/admin/usuarios");
    expect(adminSectionPath("arco")).toBe("/admin/arco");
    expect(adminSectionPath("property")).toBe("/admin/posts");
    expect(adminSectionPath("analytics")).toBe("/admin/metricas");
    expect(ADMIN_NAV_SECTIONS.map((s) => s.slug)).toEqual([
      "usuarios",
      "posts",
      "soporte",
      "outreach",
      "blog",
      "metricas",
      "arco",
    ]);
    expect(ADMIN_SECTIONS.map((s) => s.slug)).toContain("ciudades");
    expect(parseAdminSectionSlug("ciudades")).toBe("cities");
  });

  it("parses slugs and rejects unknown sections", () => {
    expect(parseAdminSectionSlug("posts")).toBe("property");
    expect(parseAdminSectionSlug("usuarios")).toBe("users");
    expect(parseAdminSectionSlug("arco")).toBe("arco");
    expect(parseAdminSectionSlug("nope")).toBeNull();
    expect(parseAdminSectionSlug(undefined)).toBeNull();
    expect(ADMIN_DEFAULT_PATH).toBe("/admin/usuarios");
  });

  it("builds ARCO and Soporte deep links", () => {
    expect(adminArcoUserPath("u-1")).toBe("/admin/arco?u=u-1");
    expect(adminArcoUserPath("")).toBe("/admin/arco");
    expect(adminSupportConversationPath("abc-123")).toBe("/admin/soporte?c=abc-123");
    expect(adminSupportConversationPath("")).toBe("/admin/soporte");
  });
});

import { describe, expect, it } from "vitest";
import {
  ADMIN_DEFAULT_PATH,
  ADMIN_NAV_SECTIONS,
  ADMIN_SECTIONS,
  adminSectionPath,
  parseAdminSectionSlug,
} from "./adminSections";

describe("adminSections", () => {
  it("maps each submenu to a stable /admin path", () => {
    expect(adminSectionPath("users")).toBe("/admin/usuarios");
    expect(adminSectionPath("property")).toBe("/admin/posts");
    expect(adminSectionPath("analytics")).toBe("/admin/metricas");
    expect(ADMIN_NAV_SECTIONS.map((s) => s.slug)).toEqual([
      "usuarios",
      "posts",
      "soporte",
      "outreach",
      "metricas",
    ]);
    expect(ADMIN_SECTIONS.map((s) => s.slug)).toContain("ciudades");
    expect(parseAdminSectionSlug("ciudades")).toBe("cities");
  });

  it("parses slugs and rejects unknown sections", () => {
    expect(parseAdminSectionSlug("posts")).toBe("property");
    expect(parseAdminSectionSlug("usuarios")).toBe("users");
    expect(parseAdminSectionSlug("nope")).toBeNull();
    expect(parseAdminSectionSlug(undefined)).toBeNull();
    expect(ADMIN_DEFAULT_PATH).toBe("/admin/usuarios");
  });
});

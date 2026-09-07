import { describe, expect, it } from "vitest";
import {
  OUTREACH_INVITATION_SIGN_OFF,
  OUTREACH_INVITATION_URL,
  buildTemplateOutreachInvitation,
  finalizeOutreachInvitationCopy,
} from "./outreachInvitationPrompt.js";

describe("finalizeOutreachInvitationCopy", () => {
  it("ensures the GDL URL and exact Equipo Bestie MX sign-off", () => {
    const out = finalizeOutreachInvitationCopy(
      "Hola, publica gratis en Bestie y buscamos roomies contigo.",
    );
    expect(out).toContain(OUTREACH_INVITATION_URL);
    expect(out.endsWith(OUTREACH_INVITATION_SIGN_OFF)).toBe(true);
    expect(out.match(/https?:\/\/[^\s]+/g)).toEqual([OUTREACH_INVITATION_URL]);
  });

  it("scrubs prose bestie.mx so Facebook does not create a second link", () => {
    const out = finalizeOutreachInvitationCopy(
      `Mira Bestie.mx y bestie.mx para publicar.\n${OUTREACH_INVITATION_URL}\n${OUTREACH_INVITATION_SIGN_OFF}`,
    );
    // Prose domains become "Bestie"; only the canonical invite URL may mention the domain.
    expect(out).toContain("Mira Bestie y Bestie para publicar.");
    const domainHits = out.match(/bestie\.mx/gi) ?? [];
    expect(domainHits).toEqual(["bestie.mx"]);
    expect(out).toContain(OUTREACH_INVITATION_URL);
    expect(out.match(/https?:\/\/[^\s]+/g)).toEqual([OUTREACH_INVITATION_URL]);
  });

  it("normalizes a near-miss signature", () => {
    const out = finalizeOutreachInvitationCopy(
      `Hola\n${OUTREACH_INVITATION_URL}\nAtte. Equipo Bestie`,
    );
    expect(out.endsWith(OUTREACH_INVITATION_SIGN_OFF)).toBe(true);
    expect(out.match(/Atte\./g)?.length).toBe(1);
  });
});

describe("buildTemplateOutreachInvitation", () => {
  it("includes free-value pillars in template fallback", () => {
    const text = buildTemplateOutreachInvitation({ publisherName: "Ana" }).toLowerCase();
    expect(text).toContain("ana");
    expect(text).toContain(OUTREACH_INVITATION_URL);
    expect(text).toContain("facebook");
    expect(text.includes("gratis") || text.includes("sin costo") || text.includes("sin pagar")).toBe(
      true,
    );
  });
});

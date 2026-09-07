import { describe, expect, it } from "vitest";
import { httpStatusErrorMessage } from "./httpStatusErrorMessage";

describe("httpStatusErrorMessage", () => {
  it("explains admin_usage_502 with troubleshooting tips", () => {
    const msg = httpStatusErrorMessage(new Error("admin_usage_502"));
    expect(msg).toContain("uso de APIs");
    expect(msg).toContain("502");
    expect(msg).toContain("Qué probar:");
    expect(msg).toContain("Railway");
    expect(msg).toContain("(código: admin_usage_502)");
  });

  it("passes through Spanish prose", () => {
    const prose = "No se pudo contactar la API. Comprueba tu conexión.";
    expect(httpStatusErrorMessage(prose)).toBe(prose);
  });

  it("maps known non-status codes", () => {
    const msg = httpStatusErrorMessage("rate_limited");
    expect(msg).toMatch(/Demasiadas/);
    expect(msg).toContain("(código: rate_limited)");
  });

  it("uses fallback for unknown snake codes", () => {
    const msg = httpStatusErrorMessage("weird_thing", "Falló algo.");
    expect(msg.startsWith("Falló algo.")).toBe(true);
    expect(msg).toContain("(código: weird_thing)");
  });
});

import { describe, expect, it } from "vitest";
import {
  destinationAfterAuth,
  MIS_ANUNCIOS_PATH,
  MIS_BUSQUEDAS_PATH,
  oauthReturnToFor,
  pickPostLoginPath,
  POST_LOGIN_RESOLVE_PATH,
  safeClientReturnTo,
  shouldResolvePostLoginDestination,
} from "./postLoginRedirect";

describe("pickPostLoginPath", () => {
  it("sends publishers with an active post to Mis Anuncios", () => {
    expect(
      pickPostLoginPath({ hasActivePublishedPost: true, hasActiveAlertSearch: true }),
    ).toBe(MIS_ANUNCIOS_PATH);
    expect(
      pickPostLoginPath({ hasActivePublishedPost: true, hasActiveAlertSearch: false }),
    ).toBe(MIS_ANUNCIOS_PATH);
  });

  it("sends seekers with alert searches to Mis Búsquedas", () => {
    expect(
      pickPostLoginPath({ hasActivePublishedPost: false, hasActiveAlertSearch: true }),
    ).toBe(MIS_BUSQUEDAS_PATH);
  });

  it("defaults to Mis Búsquedas when neither is active", () => {
    expect(
      pickPostLoginPath({ hasActivePublishedPost: false, hasActiveAlertSearch: false }),
    ).toBe(MIS_BUSQUEDAS_PATH);
  });
});

describe("shouldResolvePostLoginDestination", () => {
  it("treats home destinations as resolvable", () => {
    expect(shouldResolvePostLoginDestination(undefined)).toBe(true);
    expect(shouldResolvePostLoginDestination("/mis-anuncios")).toBe(true);
    expect(shouldResolvePostLoginDestination("/mis-busquedas")).toBe(true);
    expect(shouldResolvePostLoginDestination(POST_LOGIN_RESOLVE_PATH)).toBe(true);
  });

  it("keeps contextual return URLs", () => {
    expect(shouldResolvePostLoginDestination("/buscar/gdl?q=roma")).toBe(false);
    expect(shouldResolvePostLoginDestination("/publicar")).toBe(false);
    expect(shouldResolvePostLoginDestination("/mensajes")).toBe(false);
    expect(shouldResolvePostLoginDestination("/mensajes?c=abc")).toBe(false);
  });
});

describe("safeClientReturnTo", () => {
  it("allows relative app paths", () => {
    expect(safeClientReturnTo("/mensajes")).toBe("/mensajes");
    expect(safeClientReturnTo("/mensajes?c=1")).toBe("/mensajes?c=1");
  });

  it("rejects open redirects", () => {
    expect(safeClientReturnTo("https://evil.example")).toBeNull();
    expect(safeClientReturnTo("//evil.example")).toBeNull();
    expect(safeClientReturnTo("mensajes")).toBeNull();
  });
});

describe("oauthReturnToFor", () => {
  it("uses the resolve path for defaults", () => {
    expect(oauthReturnToFor()).toBe(POST_LOGIN_RESOLVE_PATH);
    expect(oauthReturnToFor("/mis-anuncios")).toBe(POST_LOGIN_RESOLVE_PATH);
  });

  it("preserves contextual returnTo", () => {
    expect(oauthReturnToFor("/buscar/gdl")).toBe("/buscar/gdl");
    expect(oauthReturnToFor("/mensajes")).toBe("/mensajes");
  });

  it("rejects unsafe returnTo", () => {
    expect(oauthReturnToFor("//evil.example")).toBe(POST_LOGIN_RESOLVE_PATH);
  });
});

describe("destinationAfterAuth", () => {
  it("keeps mensajes through the verify gate", async () => {
    await expect(destinationAfterAuth("/mensajes", true)).resolves.toBe(
      "/verificar-correo?returnTo=%2Fmensajes",
    );
  });

  it("returns mensajes after auth when no verify is needed", async () => {
    await expect(destinationAfterAuth("/mensajes", false)).resolves.toBe("/mensajes");
  });
});

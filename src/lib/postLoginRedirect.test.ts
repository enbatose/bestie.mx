import { describe, expect, it } from "vitest";
import {
  MIS_ANUNCIOS_PATH,
  MIS_BUSQUEDAS_PATH,
  oauthReturnToFor,
  pickPostLoginPath,
  POST_LOGIN_RESOLVE_PATH,
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
  });
});

describe("oauthReturnToFor", () => {
  it("uses the resolve path for defaults", () => {
    expect(oauthReturnToFor()).toBe(POST_LOGIN_RESOLVE_PATH);
    expect(oauthReturnToFor("/mis-anuncios")).toBe(POST_LOGIN_RESOLVE_PATH);
  });

  it("preserves contextual returnTo", () => {
    expect(oauthReturnToFor("/buscar/gdl")).toBe("/buscar/gdl");
  });
});

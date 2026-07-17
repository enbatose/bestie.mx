import { fetchMyListings } from "@/lib/listingsApi";
import { fetchSavedSearches } from "@/lib/savedSearchesApi";
import type { PropertyListing } from "@/types/listing";

/** Client route that picks Mis Anuncios vs Mis Búsquedas after auth. */
export const POST_LOGIN_RESOLVE_PATH = "/despues-de-entrar";

export const MIS_ANUNCIOS_PATH = "/mis-anuncios";
export const MIS_BUSQUEDAS_PATH = "/mis-busquedas";

function pathOnly(redirectTo: string): string {
  return redirectTo.split(/[?#]/)[0] || "/";
}

/** True when redirect should use post-login heuristics instead of a contextual return URL. */
export function shouldResolvePostLoginDestination(redirectTo?: string | null): boolean {
  if (!redirectTo?.trim()) return true;
  const path = pathOnly(redirectTo.trim());
  return (
    path === MIS_ANUNCIOS_PATH ||
    path === MIS_BUSQUEDAS_PATH ||
    path === POST_LOGIN_RESOLVE_PATH ||
    path === "/"
  );
}

/** OAuth `returnTo` — resolve path for defaults, otherwise keep the contextual URL. */
export function oauthReturnToFor(redirectTo?: string | null): string {
  return shouldResolvePostLoginDestination(redirectTo) ? POST_LOGIN_RESOLVE_PATH : redirectTo!.trim();
}

export function listingIsActivePublished(listing: PropertyListing): boolean {
  return (listing.propertyStatus ?? listing.status) === "published";
}

/**
 * Destino después de iniciar sesión / registrarse (cuando no hay return contextual):
 * - Anuncio publicado activo → Mis Anuncios
 * - Sin anuncios activos, con o sin búsquedas con alertas → Mis Búsquedas
 */
export function pickPostLoginPath(input: {
  hasActivePublishedPost: boolean;
  hasActiveAlertSearch: boolean;
}): string {
  if (input.hasActivePublishedPost) return MIS_ANUNCIOS_PATH;
  // Active alert searches, or neither → Mis Búsquedas (seeker home).
  if (input.hasActiveAlertSearch) return MIS_BUSQUEDAS_PATH;
  return MIS_BUSQUEDAS_PATH;
}

export async function resolvePostLoginPath(): Promise<string> {
  const [listings, searches] = await Promise.all([
    fetchMyListings().catch(() => [] as PropertyListing[]),
    fetchSavedSearches().catch(() => []),
  ]);

  const hasActivePublishedPost = listings.some(listingIsActivePublished);
  const hasActiveAlertSearch = searches.some((s) => s.emailNotifyEnabled && !s.isDraft);

  return pickPostLoginPath({ hasActivePublishedPost, hasActiveAlertSearch });
}

/** Spanish copy for claim-token write conflicts. Not a phone uniqueness check. */

export const CLAIM_ALREADY_CLAIMED_MESSAGE =
  "Este borrador ya está ligado a una cuenta. Inicia sesión con esa cuenta para continuar. Cambiar el teléfono del anuncio no libera el enlace.";

export const CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE =
  "Este anuncio ya fue reclamado por otra cuenta. Entra con esa cuenta y ábrelo en Mis Anuncios. Cambiar el teléfono del anuncio no transfiere el anuncio.";

export const CLAIM_PUBLISHER_TAKEN_MESSAGE =
  "Este anuncio ya está vinculado a otra cuenta. Entra con esa cuenta y ábrelo en Mis Anuncios.";

export const ADMIN_OUTREACH_EVIDENCE_REQUIRED_MESSAGE =
  "Para publicar un anuncio de crecimiento sin dueño adjunta una captura de consentimiento (no uses las fotos del anuncio).";

export type ClaimWriteBlock = {
  error: "already_claimed" | "already_claimed_by_other";
  status: 409;
  message: string;
};

/**
 * Who may save or activate a claim token.
 * Unclaimed tokens stay open (outreach recipient, not signed in yet).
 * Once claimed, only that same user may keep writing — the listing phone is not the lock.
 */
export function claimWriteBlock(
  claimedByUserId: string | null | undefined,
  requesterUserId: string | null | undefined,
): ClaimWriteBlock | null {
  if (claimedByUserId == null || claimedByUserId === "") return null;
  if (!requesterUserId) {
    return { error: "already_claimed", status: 409, message: CLAIM_ALREADY_CLAIMED_MESSAGE };
  }
  if (claimedByUserId === requesterUserId) return null;
  return {
    error: "already_claimed_by_other",
    status: 409,
    message: CLAIM_ALREADY_CLAIMED_BY_OTHER_MESSAGE,
  };
}

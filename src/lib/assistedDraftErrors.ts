/** Prefer server `message`; never surface snake_case codes in the wizard. */

const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  already_claimed:
    "Este borrador ya está ligado a una cuenta. Inicia sesión con esa cuenta para continuar. Cambiar el teléfono del anuncio no libera el enlace.",
  already_claimed_by_other:
    "Este anuncio ya fue reclamado por otra cuenta. Entra con esa cuenta y ábrelo en Mis Anuncios. Cambiar el teléfono del anuncio no transfiere el anuncio.",
  publisher_taken:
    "Este anuncio ya está vinculado a otra cuenta. Entra con esa cuenta y ábrelo en Mis Anuncios.",
  not_draft: "Este anuncio ya no es un borrador.",
  expired: "Este enlace ya venció. Pide uno nuevo.",
  not_found: "No encontramos este borrador.",
  unauthorized: "Inicia sesión para continuar.",
  otp_required: "Confirma el celular del anuncio con el código SMS antes de publicar.",
  phone_taken:
    "Este número ya está verificado en otra cuenta. Entra con ese teléfono o correo y contraseña.",
  phone_mismatch:
    "Tu perfil tiene otro celular verificado. Pide a un admin que cambie el número del anuncio, o cambia el teléfono de tu perfil para que coincida con el del borrador.",
  rent_required: "Falta el precio de renta.",
  bad_token: "Este enlace no es válido.",
};

export function isAlreadyClaimedByOtherError(message: string | null | undefined): boolean {
  return Boolean(
    message && /already_claimed_by_other|reclamado por otra cuenta/i.test(message),
  );
}

function looksLikeErrorCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

export function assistedDraftUserMessage(error?: string | null, message?: string | null): string {
  const fromServer = message?.trim() ?? "";
  if (fromServer && !looksLikeErrorCode(fromServer)) return fromServer;
  const code = (fromServer && looksLikeErrorCode(fromServer) ? fromServer : error?.trim()) || "";
  if (code && CLAIM_ERROR_MESSAGES[code]) return CLAIM_ERROR_MESSAGES[code];
  if (fromServer) return fromServer;
  if (error?.trim()) return CLAIM_ERROR_MESSAGES[error] ?? error;
  return "No se pudo completar la acción.";
}

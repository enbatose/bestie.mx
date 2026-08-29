import { digitsOnly, normalizeMxNationalDigits } from "@/lib/mxPhone";

export type ClassifiedAuthIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string }
  | { kind: "undetermined" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AUTH_IDENTIFIER_INVALID_MESSAGE =
  "Escribe un correo o un celular mexicano de 10 dígitos.";

/** True while the user is typing digits / +52 (not an email). */
export function looksLikePhoneInput(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.includes("@")) return false;
  const d = digitsOnly(t);
  if (!d) return false;
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length;
  return d.length >= letters;
}

/**
 * Decide email vs MX phone for login, register, and password reset.
 * Incomplete values stay `undetermined` until they are a full email or 10-digit MX number.
 */
export function classifyAuthIdentifier(raw: string): ClassifiedAuthIdentifier {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "undetermined" };
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (EMAIL_RE.test(email)) return { kind: "email", email };
    return { kind: "undetermined" };
  }
  const national = normalizeMxNationalDigits(trimmed);
  if (national) return { kind: "phone", phone: national };
  return { kind: "undetermined" };
}

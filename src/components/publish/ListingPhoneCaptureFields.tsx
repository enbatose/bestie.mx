import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { normalizeMxNationalDigits, phoneDigitsForStorage } from "@/lib/mxPhone";

type Props = {
  /** National 10 digits or raw draft string. */
  contactWhatsApp: string;
  showWhatsApp: boolean;
  onContactChange: (nationalOrEmpty: string) => void;
  onShowChange: (show: boolean) => void;
  /** Profile phone E.164 if any — drives checkbox copy. */
  profilePhoneE164?: string | null;
  /** Persist post phone to profile when checked. */
  saveToProfile: boolean;
  onSaveToProfileChange: (v: boolean) => void;
  allowSaveToProfile?: boolean;
  /** Publisher fraud tips (mobile short + desktop long via CSS). */
  showPublisherSafety?: boolean;
  /** @deprecated Tips are responsive via CSS; kept for call-site compatibility. */
  compact?: boolean;
  /** Flatten chrome when nested inside another card (wizard Datos Generales). */
  embedded?: boolean;
  disabled?: boolean;
  /** Seekers vs publishers privacy note. */
  audienceNote?: "publisher" | "seeker" | "both";
};

const PUBLISHER_SAFETY_MOBILE = [
  "No compartas CLABE ni códigos OTP por WhatsApp/SMS.",
  "Desconfía de comprobantes falsos o presión para apartar sin visita.",
] as const;

const PUBLISHER_SAFETY_DESKTOP = [
  "No compartas CLABE, claves bancarias ni códigos OTP por SMS o WhatsApp.",
  "Desconfía de comprobantes de pago falsos y de quien urge “apartar” el cuarto solo por mensaje.",
  "Prefiere coordinar visitas con persona verificable; reporta intentos de fraude en Bestie.",
] as const;

/**
 * Optional listing phone block for publish wizard / editable preview (property-level only).
 */
export function ListingPhoneCaptureFields({
  contactWhatsApp,
  showWhatsApp,
  onContactChange,
  onShowChange,
  profilePhoneE164,
  saveToProfile,
  onSaveToProfileChange,
  allowSaveToProfile = true,
  showPublisherSafety = true,
  embedded = false,
  disabled,
  audienceNote = "publisher",
}: Props) {
  const national =
    normalizeMxNationalDigits(contactWhatsApp) ?? contactWhatsApp.replace(/\D/g, "").slice(0, 10);
  const profileNational = profilePhoneE164 ? normalizeMxNationalDigits(profilePhoneE164) : null;
  const postDigits = phoneDigitsForStorage(national);
  const profileDigits = profilePhoneE164 ? phoneDigitsForStorage(profilePhoneE164) : null;
  const differsFromProfile = Boolean(postDigits && profileDigits && postDigits !== profileDigits);
  const noProfilePhone = !profileDigits;

  return (
    <div
      className={
        embedded
          ? "space-y-3 rounded-xl border border-border/70 bg-surface/60 p-3 sm:border-border sm:bg-surface sm:p-4"
          : "space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4"
      }
    >
      <PhoneNumberField
        id="listing-contact-phone"
        value={national}
        onChange={onContactChange}
        disabled={disabled}
        optional
      />

      {audienceNote === "publisher" || audienceNote === "both" ? (
        <p className="text-xs leading-snug text-muted">
          En el anuncio solo se muestra si activas la opción de abajo. Quienes buscan roomie no ven tu
          número en el perfil.
        </p>
      ) : null}

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-0.5 text-sm text-body">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
          checked={showWhatsApp}
          disabled={disabled || !postDigits}
          onChange={(e) => onShowChange(e.target.checked)}
        />
        <span className="min-w-0 leading-snug">
          Mostrar este teléfono en la publicación
          <span className="mt-0.5 block text-xs text-muted">
            Si lo ocultas, no aparece en el anuncio ni viaja en el HTML público (evita scrapers).
          </span>
        </span>
      </label>

      {allowSaveToProfile && postDigits && (noProfilePhone || differsFromProfile) ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-0.5 text-sm text-body">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
            checked={saveToProfile}
            disabled={disabled}
            onChange={(e) => onSaveToProfileChange(e.target.checked)}
          />
          <span className="min-w-0 leading-snug">
            {noProfilePhone
              ? "Guardar también como teléfono de mi perfil"
              : "Reemplazar el teléfono de mi perfil con este número"}
            {profileNational && differsFromProfile ? (
              <span className="mt-0.5 block text-xs text-muted">
                Perfil actual: +52 {profileNational.slice(0, 2)} {profileNational.slice(2, 6)}{" "}
                {profileNational.slice(6)}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}

      {showPublisherSafety && postDigits && showWhatsApp ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning-fg">
          <p className="font-semibold">Prevención de fraude (publicar teléfono)</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 sm:hidden">
            {PUBLISHER_SAFETY_MOBILE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <ul className="mt-1.5 hidden list-disc space-y-1 pl-4 sm:block">
            {PUBLISHER_SAFETY_DESKTOP.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

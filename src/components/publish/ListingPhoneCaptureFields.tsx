import { PhoneNumberField } from "@/components/phone/PhoneNumberField";
import { PublisherPhoneSafetyCallout } from "@/components/publish/PublisherPhoneSafetyCallout";
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
  /** No outer border/padding — use inside an editable preview shell that already has chrome. */
  bare?: boolean;
  disabled?: boolean;
  /** Hide the inner phone field label when an outer section title already names the block. */
  showPhoneLabel?: boolean;
};

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
  bare = false,
  disabled,
  showPhoneLabel = true,
}: Props) {
  const national =
    normalizeMxNationalDigits(contactWhatsApp) ?? contactWhatsApp.replace(/\D/g, "").slice(0, 10);
  const profileNational = profilePhoneE164 ? normalizeMxNationalDigits(profilePhoneE164) : null;
  const postDigits = phoneDigitsForStorage(national);
  const profileDigits = profilePhoneE164 ? phoneDigitsForStorage(profilePhoneE164) : null;
  const differsFromProfile = Boolean(postDigits && profileDigits && postDigits !== profileDigits);
  const noProfilePhone = !profileDigits;

  const handleContactChange = (nextNational: string) => {
    const hadDigits = Boolean(postDigits);
    onContactChange(nextNational);
    const nextDigits = phoneDigitsForStorage(
      normalizeMxNationalDigits(nextNational) ??
        nextNational.replace(/\D/g, "").slice(0, 10),
    );
    if (nextDigits && !hadDigits) {
      onShowChange(true);
    }
  };

  return (
    <div
      className={
        bare
          ? "min-w-0 max-w-full space-y-3"
          : embedded
            ? "min-w-0 max-w-full space-y-3 rounded-xl border border-border/70 bg-surface/60 p-3 sm:border-border sm:bg-surface sm:p-4"
            : "min-w-0 max-w-full space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4"
      }
    >
      <PhoneNumberField
        id="listing-contact-phone"
        value={national}
        onChange={handleContactChange}
        disabled={disabled}
        optional
        showLabel={showPhoneLabel}
        className="min-w-0"
      />

      <label className="grid min-w-0 cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-1 text-sm text-body">
        <input
          type="checkbox"
          className="mt-0.5 size-[1.125rem] shrink-0 rounded border-border accent-primary"
          checked={showWhatsApp}
          disabled={disabled || !postDigits}
          onChange={(e) => onShowChange(e.target.checked)}
        />
        <span className="min-w-0 break-words leading-snug">
          Mostrar este teléfono en la publicación
        </span>
      </label>

      {allowSaveToProfile && postDigits && noProfilePhone ? (
        <label className="grid min-w-0 cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-1 text-sm text-body">
          <input
            type="checkbox"
            className="mt-0.5 size-[1.125rem] shrink-0 rounded border-border accent-primary"
            checked={saveToProfile}
            disabled={disabled}
            onChange={(e) => onSaveToProfileChange(e.target.checked)}
          />
          <span className="min-w-0 break-words leading-snug">
            Guardar también como teléfono de mi perfil
          </span>
        </label>
      ) : null}

      {allowSaveToProfile && postDigits && differsFromProfile ? (
        <label className="grid min-w-0 cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-1 text-sm text-body">
          <input
            type="checkbox"
            className="mt-0.5 size-[1.125rem] shrink-0 rounded border-border accent-primary"
            checked={saveToProfile}
            disabled={disabled}
            onChange={(e) => onSaveToProfileChange(e.target.checked)}
          />
          <span className="min-w-0 break-words leading-snug">
            Reemplazar el teléfono de mi perfil con este número
            {profileNational ? (
              <span className="mt-0.5 block break-all text-xs text-muted sm:break-normal">
                Perfil actual: +52 {profileNational.slice(0, 2)} {profileNational.slice(2, 6)}{" "}
                {profileNational.slice(6)}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}

      {showPublisherSafety && postDigits && showWhatsApp ? (
        <PublisherPhoneSafetyCallout />
      ) : null}
    </div>
  );
}

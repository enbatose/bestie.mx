/** Short tips for narrow preview editors and mobile wizard steps. */
export const PUBLISHER_PHONE_SAFETY_TIPS_MOBILE = [
  "No compartas CLABE ni códigos OTP por WhatsApp/SMS.",
  "Desconfía de comprobantes falsos o presión para apartar sin visita.",
] as const;

/** Full tips on sm+ wizard / desktop preview. */
export const PUBLISHER_PHONE_SAFETY_TIPS_DESKTOP = [
  "No compartas CLABE, claves bancarias ni códigos OTP por SMS o WhatsApp.",
  "Desconfía de comprobantes de pago falsos y de quien urge “apartar” el cuarto solo por mensaje.",
  "Prefiere coordinar visitas con persona verificable; reporta intentos de fraude en Bestie.",
] as const;

type Props = {
  /** Tighter padding and type for nested preview editor panels at 360px. */
  dense?: boolean;
  className?: string;
};

/**
 * Inline publisher fraud tips when a listing phone will be shown publicly.
 * Shared by Datos Generales (`ListingPhoneCaptureFields`) and editable preview.
 */
export function PublisherPhoneSafetyCallout({ dense = false, className = "" }: Props) {
  return (
    <div
      className={`min-w-0 max-w-full rounded-xl border border-warning/40 bg-warning/10 text-warning-fg ${
        dense
          ? "px-2.5 py-2 text-[11px] leading-snug sm:px-3 sm:py-2.5 sm:text-xs sm:leading-relaxed"
          : "px-3 py-2.5 text-xs leading-relaxed"
      } ${className}`.trim()}
      role="note"
    >
      <p className="font-semibold">Prevención de fraude (publicar teléfono)</p>
      <ul className="mt-1.5 list-disc space-y-1 break-words pl-4 sm:hidden">
        {PUBLISHER_PHONE_SAFETY_TIPS_MOBILE.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <ul className="mt-1.5 hidden list-disc space-y-1 break-words pl-4 sm:block">
        {PUBLISHER_PHONE_SAFETY_TIPS_DESKTOP.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

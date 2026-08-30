import { HIDE_PRICING_DISCLAIMER } from "@/lib/listingPricing";

type Props = {
  hasPhone: boolean;
  hasMessaging: boolean;
  onPhone: () => void;
  onMessage: () => void;
};

/** Hero / room-modal replacement for the monthly rent line. */
export function ListingHiddenPricing({ hasPhone, hasMessaging, onPhone, onMessage }: Props) {
  if (!hasPhone && !hasMessaging) {
    return (
      <p className="mt-2 min-w-0 break-words text-base font-bold leading-snug text-body sm:text-xl">
        {HIDE_PRICING_DISCLAIMER}
      </p>
    );
  }

  return (
    <div className="mt-2 min-w-0 space-y-1">
      <p className="min-w-0 break-words text-base font-bold leading-snug text-body sm:text-xl">
        {HIDE_PRICING_DISCLAIMER}
      </p>
      <div className="flex min-w-0 flex-wrap gap-x-4">
        {hasPhone ? (
          <button
            type="button"
            onClick={onPhone}
            className="min-h-11 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Teléfono
          </button>
        ) : null}
        {hasMessaging ? (
          <button
            type="button"
            onClick={onMessage}
            className="min-h-11 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Enviar mensaje
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HiddenPricingBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-bg-light px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
      Oculto
    </span>
  );
}

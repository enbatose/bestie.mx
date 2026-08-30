import { useState } from "react";
import { HIDE_PRICING_CONTACT_MESSAGE } from "@/lib/listingPricing";

type Props = {
  hidePricing: boolean;
  contactOk: boolean;
  onChange: (next: boolean) => void;
};

/** Property-level control: hide rent + deposit on public surfaces. */
export function HidePricingToggle({ hidePricing, contactOk, onChange }: Props) {
  const [gateError, setGateError] = useState<string | null>(null);

  return (
    <div className="min-w-0">
      <label className="grid cursor-pointer grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-x-3 py-1 text-sm text-body">
        <input
          type="checkbox"
          checked={hidePricing}
          onChange={(e) => {
            const next = e.target.checked;
            if (next && !contactOk) {
              setGateError(HIDE_PRICING_CONTACT_MESSAGE);
              onChange(false);
              return;
            }
            setGateError(null);
            onChange(next);
          }}
          className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
        />
        <span className="min-w-0">
          <span className="block font-medium">No mostrar renta ni depósito</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">
            Quienes buscan verán Consultar $ y te escribirán o llamarán. Necesitas teléfono o
            mensajes en Bestie.
          </span>
          {gateError ? <span className="mt-1 block text-xs text-error">{gateError}</span> : null}
        </span>
      </label>
    </div>
  );
}

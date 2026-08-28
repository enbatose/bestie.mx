import { useMemo } from "react";
import {
  digitsOnly,
  formatMxPhoneDisplay,
  MX_COUNTRY_CODE,
  MX_NATIONAL_DIGITS,
  normalizeMxNationalDigits,
  phoneDigitsForStorage,
} from "@/lib/mxPhone";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Show WhatsApp hint under the field. */
  showWhatsAppHint?: boolean;
  className?: string;
  inputClassName?: string;
  label?: string;
  optional?: boolean;
  error?: string | null;
};

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.82c2.17 0 4.21.85 5.75 2.38a8.08 8.08 0 0 1 2.37 5.75c0 4.48-3.65 8.12-8.12 8.12-1.42 0-2.8-.36-4.02-1.05l-.29-.17-3.12.82.83-3.04-.19-.31a8.1 8.1 0 0 1-1.24-4.37c0-4.48 3.65-8.13 8.13-8.13zm4.52 10.52c-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.1-1.38-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.38c-.13 0-.34.05-.52.25-.18.2-.68.67-.68 1.63s.7 1.89.8 2.02c.1.13 1.37 2.1 3.32 2.94.46.2.83.32 1.11.41.47.15.89.13 1.23.08.37-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23z"
      />
    </svg>
  );
}

/** Controlled MX phone input: fixed +52 + exactly 10 national digits. */
export function PhoneNumberField({
  id,
  value,
  onChange,
  disabled,
  showWhatsAppHint = true,
  className = "",
  inputClassName = "",
  label = "Número de teléfono / móvil",
  optional = true,
  error = null,
}: Props) {
  const national = useMemo(() => {
    const fromMx = normalizeMxNationalDigits(value);
    if (fromMx) return fromMx;
    const d = digitsOnly(value);
    if (d.length <= MX_NATIONAL_DIGITS) return d;
    if (d.startsWith(MX_COUNTRY_CODE) && d.length >= 12) return d.slice(2, 12);
    return d.slice(0, MX_NATIONAL_DIGITS);
  }, [value]);

  const complete = national.length === MX_NATIONAL_DIGITS;
  const preview = complete ? formatMxPhoneDisplay(`${MX_COUNTRY_CODE}${national}`) : null;

  return (
    <div className={`min-w-0 max-w-full ${className}`.trim()}>
      <label htmlFor={id} className="block text-sm font-medium text-body break-words">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted">(opcional)</span>
        ) : (
          <span className="text-error"> *</span>
        )}
      </label>
      {showWhatsAppHint ? (
        <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-snug text-muted">
          <WhatsAppLogo className="mt-0.5 size-3.5 shrink-0 text-[#25D366]" />
          <span className="min-w-0 break-words">Idealmente el número que usas en WhatsApp.</span>
        </p>
      ) : null}
      <div className="mt-2 flex min-w-0 items-stretch gap-2">
        <div
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border bg-bg-light px-2.5 text-base font-semibold tabular-nums text-body sm:px-3 sm:text-sm"
          aria-label="Código de país México"
        >
          +{MX_COUNTRY_CODE}
        </div>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          maxLength={MX_NATIONAL_DIGITS}
          placeholder="10 dígitos"
          onChange={(e) => {
            const next = digitsOnly(e.target.value).slice(0, MX_NATIONAL_DIGITS);
            onChange(next);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text");
            const stored = phoneDigitsForStorage(pasted);
            if (stored?.startsWith(MX_COUNTRY_CODE) && stored.length === 12) {
              onChange(stored.slice(2));
              return;
            }
            onChange(digitsOnly(pasted).slice(0, MX_NATIONAL_DIGITS));
          }}
          className={
            inputClassName ||
            // text-base on mobile avoids iOS focus zoom; sm:text-sm matches desktop forms
            "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-base tabular-nums text-body outline-none ring-accent focus:ring-2 disabled:opacity-50 sm:text-sm"
          }
          aria-invalid={Boolean(error) || (national.length > 0 && !complete)}
          aria-describedby={error ? `${id ?? "phone"}-err` : undefined}
        />
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] leading-snug text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <span className="min-w-0 break-words">
          {national.length}/{MX_NATIONAL_DIGITS} dígitos
          {preview ? (
            <>
              <span className="hidden sm:inline">{` · ${preview}`}</span>
              <span className="mt-0.5 block font-mono text-xs tabular-nums text-body sm:hidden">
                {preview}
              </span>
            </>
          ) : null}
        </span>
        {national.length > 0 && !complete ? (
          <span className="text-warning-fg">Faltan {MX_NATIONAL_DIGITS - national.length}</span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id ?? "phone"}-err`} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

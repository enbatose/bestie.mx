import { useEffect, useState } from "react";

type WizardNumberStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  decrementLabel?: string;
  incrementLabel?: string;
  /** When true, center is an `<input type="number">` for typing; +/- still adjust by `step`. */
  editableCenter?: boolean;
  /** Amount to add/subtract with +/- (default 1). */
  step?: number;
  /** Max digits while typing (e.g. 2 for ages 0–99). */
  maxInputDigits?: number;
  /** Tighter label spacing for side-by-side wizard fields. Control size stays the same. */
  compact?: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function stepDecimalPlaces(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function snapToStep(n: number, step: number): number {
  const places = stepDecimalPlaces(step);
  return Number((Math.round(n / step) * step).toFixed(places));
}

function formatStepperValue(n: number, step: number): string {
  return String(snapToStep(n, step));
}

const STEPPER_BUTTON_CLASS =
  "flex h-full w-11 shrink-0 items-center justify-center text-lg font-semibold text-primary transition enabled:hover:bg-surface-elevated enabled:active:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Compact +/- control for wizard counts (mobile-friendly).
 * With `editableCenter`, the value can be typed; `inputMode` follows whether `step` is fractional.
 */
export function WizardNumberStepper({
  value,
  onChange,
  min,
  max,
  disabled = false,
  decrementLabel = "Disminuir",
  incrementLabel = "Aumentar",
  editableCenter = false,
  step = 1,
  maxInputDigits,
  compact = false,
}: WizardNumberStepperProps) {
  const allowDecimal = stepDecimalPlaces(step) > 0;
  const [inputStr, setInputStr] = useState(formatStepperValue(value, step));

  useEffect(() => {
    setInputStr(formatStepperValue(value, step));
  }, [value, step]);

  const commitValue = (next: number) => {
    onChange(clamp(snapToStep(next, step), min, max));
  };

  const dec = () => commitValue(value - step);
  const inc = () => commitValue(value + step);
  const atMin = value <= min;
  const atMax = value >= max;

  const commitInput = () => {
    const trimmed = inputStr.trim().replace(",", ".");
    if (trimmed === "" || trimmed === ".") {
      const fallback = clamp(snapToStep(value, step), min, max);
      onChange(fallback);
      setInputStr(formatStepperValue(fallback, step));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setInputStr(formatStepperValue(value, step));
      return;
    }
    const c = clamp(allowDecimal ? snapToStep(n, step) : Math.trunc(n), min, max);
    onChange(c);
    setInputStr(formatStepperValue(c, step));
  };

  const center = editableCenter ? (
    <div className="flex min-w-0 flex-1 items-center border-x border-border">
      <input
        type={allowDecimal ? "text" : "number"}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        value={inputStr}
        onChange={(e) => {
          if (!allowDecimal) {
            let raw = e.target.value.replace(/\D/g, "");
            if (maxInputDigits != null && maxInputDigits > 0) {
              raw = raw.slice(0, maxInputDigits);
            }
            setInputStr(raw);
            return;
          }
          let raw = e.target.value.replace(",", ".");
          raw = raw.replace(/[^\d.]/g, "");
          const firstDot = raw.indexOf(".");
          if (firstDot !== -1) {
            raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
            const places = stepDecimalPlaces(step);
            const [intPart, frac = ""] = raw.split(".");
            raw = `${intPart}.${frac.slice(0, places)}`;
          }
          setInputStr(raw);
        }}
        onBlur={commitInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="min-w-0 w-full border-0 bg-transparent px-1 py-0 text-center text-sm font-semibold tabular-nums text-body outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  ) : (
    <div className="flex flex-1 items-center justify-center border-x border-border text-sm font-semibold tabular-nums text-body">
      {formatStepperValue(value, step)}
    </div>
  );

  return (
    <div
      className={`flex h-11 w-full items-center justify-between overflow-hidden rounded-xl border border-border bg-surface shadow-sm focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-0 ${
        compact ? "mt-1" : "mt-2"
      } ${disabled ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={disabled || atMin}
        onClick={dec}
        className={STEPPER_BUTTON_CLASS}
      >
        −
      </button>
      {center}
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={disabled || atMax}
        onClick={inc}
        className={STEPPER_BUTTON_CLASS}
      >
        +
      </button>
    </div>
  );
}

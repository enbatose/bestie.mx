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
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Compact +/- control for wizard counts (mobile-friendly).
 * With `editableCenter`, the value can be typed; `inputMode="numeric"` helps on mobile.
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
}: WizardNumberStepperProps) {
  const [inputStr, setInputStr] = useState(String(value));

  useEffect(() => {
    setInputStr(String(value));
  }, [value]);

  const dec = () => onChange(clamp(value - step, min, max));
  const inc = () => onChange(clamp(value + step, min, max));
  const atMin = value <= min;
  const atMax = value >= max;

  const commitInput = () => {
    const trimmed = inputStr.trim();
    if (trimmed === "") {
      const fallback = clamp(value, min, max);
      onChange(fallback);
      setInputStr(String(fallback));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setInputStr(String(value));
      return;
    }
    const c = clamp(Math.trunc(n), min, max);
    onChange(c);
    setInputStr(String(c));
  };

  const center = editableCenter ? (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      value={inputStr}
      onChange={(e) => {
        let raw = e.target.value.replace(/\D/g, "");
        if (maxInputDigits != null && maxInputDigits > 0) {
          raw = raw.slice(0, maxInputDigits);
        }
        setInputStr(raw);
      }}
      onBlur={commitInput}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm font-semibold tabular-nums text-body outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  ) : (
    <div className="flex min-w-[2.5rem] flex-1 items-center justify-center border-x border-border text-sm font-semibold tabular-nums text-body">
      {value}
    </div>
  );

  return (
    <div
      className={`mt-2 flex h-11 items-stretch overflow-hidden rounded-xl border border-border bg-surface shadow-sm focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-0 ${
        disabled ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={disabled || atMin}
        onClick={dec}
        className="min-w-[2.75rem] px-2 text-lg font-semibold text-primary transition enabled:hover:bg-surface-elevated enabled:active:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      {center}
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={disabled || atMax}
        onClick={inc}
        className="min-w-[2.75rem] px-2 text-lg font-semibold text-primary transition enabled:hover:bg-surface-elevated enabled:active:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

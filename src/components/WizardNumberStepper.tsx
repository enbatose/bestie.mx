type WizardNumberStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  decrementLabel?: string;
  incrementLabel?: string;
};

/**
 * Compact +/- control for wizard counts (mobile-friendly).
 * Borders/rings follow Tailwind theme tokens (`border-border`, `ring-accent`).
 */
export function WizardNumberStepper({
  value,
  onChange,
  min,
  max,
  disabled = false,
  decrementLabel = "Disminuir",
  incrementLabel = "Aumentar",
}: WizardNumberStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const atMin = value <= min;
  const atMax = value >= max;

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
      <div className="flex min-w-[2.5rem] flex-1 items-center justify-center border-x border-border text-sm font-semibold tabular-nums text-body">
        {value}
      </div>
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

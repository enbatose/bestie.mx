type FieldCharCountProps = {
  current: number;
  min: number;
  /** When set, counter shows `current / max`; otherwise `current / min`. */
  max?: number;
  /** Highlight the counter while under the minimum. */
  warnBelowMin?: boolean;
  className?: string;
  /** Title fields use a tighter meta size. */
  size?: "xs" | "xxs";
};

/**
 * Footer under publish text fields: subtle minimum on the left, live count on the right.
 * Callers that already space children (e.g. `space-y-*`) can omit top margin;
 * fields nested under a label should pass `className="mt-1"`.
 */
export function FieldCharCount({
  current,
  min,
  max,
  warnBelowMin = false,
  className = "",
  size = "xs",
}: FieldCharCountProps) {
  const textSize = size === "xxs" ? "text-[10px]" : "text-xs";
  const counterTone =
    warnBelowMin && current < min ? "text-warning-fg" : "text-muted";
  const ceiling = max ?? min;

  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${textSize} ${className}`.trim()}
    >
      <span className="min-w-0 text-muted">Mín. {min} caracteres</span>
      <span className={`shrink-0 tabular-nums ${counterTone}`}>
        {current} / {ceiling}
      </span>
    </div>
  );
}

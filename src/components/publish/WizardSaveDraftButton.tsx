type Props = {
  onClick: () => void;
  disabled?: boolean;
  inFlight?: boolean;
  saved?: boolean;
  compact?: boolean;
  className?: string;
};

export function WizardSaveDraftButton({
  onClick,
  disabled = false,
  inFlight = false,
  saved = false,
  compact = false,
  className = "",
}: Props) {
  const label = inFlight ? "Guardando…" : saved ? "Borrador guardado" : "Guardar borrador";

  return (
    <button
      type="button"
      disabled={disabled || inFlight}
      onClick={onClick}
      className={`rounded-full border border-secondary/50 bg-secondary/10 font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50 ${
        compact ? "px-3 py-1.5 text-xs" : "px-5 py-2 text-sm"
      } ${saved && !inFlight ? "border-secondary/40 bg-secondary/10 text-body" : ""} ${className}`}
    >
      {label}
    </button>
  );
}

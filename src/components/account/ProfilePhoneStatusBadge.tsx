import { AlertCircle, CheckCircle2 } from "lucide-react";

type ProfilePhoneStatusBadgeProps = {
  verified: boolean;
  /** Opens the SMS verification modal when the number is not verified. */
  onVerifyClick?: () => void;
};

export function ProfilePhoneStatusBadge({ verified, onVerifyClick }: ProfilePhoneStatusBadgeProps) {
  const pillClass = verified
    ? "inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-full border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"
    : "inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning-fg";

  const inner = (
    <>
      {verified ? (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">{verified ? "Verificado" : "Sin verificar"}</span>
    </>
  );

  if (!verified && onVerifyClick) {
    return (
      <button
        type="button"
        onClick={onVerifyClick}
        className={`${pillClass} cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/50`}
        aria-label="Verificar teléfono por SMS"
      >
        {inner}
      </button>
    );
  }

  return <span className={pillClass}>{inner}</span>;
}

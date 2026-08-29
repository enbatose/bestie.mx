import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

type ProfilePhoneStatusBadgeProps = {
  verified: boolean;
  /** When unverified, the badge links here so the user can start SMS verification. */
  verifyHref?: string;
};

export function ProfilePhoneStatusBadge({ verified, verifyHref }: ProfilePhoneStatusBadgeProps) {
  const pill = (
    <span
      className={
        verified
          ? "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"
          : "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning-fg"
      }
    >
      {verified ? (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">{verified ? "Verificado" : "Sin verificar"}</span>
    </span>
  );

  if (!verified && verifyHref) {
    return (
      <Link
        to={verifyHref}
        className="inline-flex min-w-0 max-w-full hover:opacity-90"
        aria-label="Verificar teléfono por SMS"
      >
        {pill}
      </Link>
    );
  }

  return pill;
}

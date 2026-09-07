import { useState } from "react";
import { confirmListingAvailability } from "@/lib/listingsApi";

type Props = {
  propertyId: string;
};

/** Owner-only confirm on the live post after 25 days. */
export function AvailabilityConfirmButton({ propertyId }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (done) {
    return (
      <span className="inline-flex min-h-11 items-center rounded-full bg-secondary/15 px-3 text-xs font-semibold text-primary">
        Confirmado
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setErr(null);
          void confirmListingAvailability(propertyId)
            .then(() => setDone(true))
            .catch(() => setErr("No se pudo confirmar."))
            .finally(() => setBusy(false));
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Confirmando…" : "Sigue disponible"}
      </button>
      {err ? (
        <span className="text-xs text-error" role="alert">
          {err}
        </span>
      ) : null}
    </span>
  );
}

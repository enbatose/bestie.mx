import { MessageCircle, Share2 } from "lucide-react";

type ShareLink = { id: string; label: string };

type Props = {
  shareMsg: string | null;
  onShareListing: () => void;
  isPropertyPost?: boolean;
  propertyId?: string;
  roomShareLinks?: readonly ShareLink[];
  currentListingId?: string;
  onSharePath: (path: string, label: string) => void;
};

export function ListingShareActions({
  shareMsg,
  onShareListing,
  isPropertyPost,
  propertyId,
  roomShareLinks = [],
  currentListingId,
  onSharePath,
}: Props) {
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onShareListing}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated"
        aria-label="Compartir anuncio"
      >
        <Share2 className="size-3.5" aria-hidden />
        Compartir
      </button>
      {shareMsg ? (
        <p className="max-w-[12rem] text-right text-[11px] text-muted" role="status" aria-live="polite">
          {shareMsg}
        </p>
      ) : null}
    </div>
  );
}

export function ListingStickyContactBar({
  rentMxn,
  canContact,
  contactLabel,
  onContact,
}: {
  rentMxn: number;
  canContact: boolean;
  contactLabel: string;
  onContact: () => void;
}) {
  if (!canContact) return null;

  const price = `${rentMxn.toLocaleString("es-MX")} MXN/mes`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-body">{price}</p>
          <p className="truncate text-xs text-muted">¿Te interesa este cuarto?</p>
        </div>
        <button
          type="button"
          onClick={onContact}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          <MessageCircle className="size-4" aria-hidden />
          {contactLabel}
        </button>
      </div>
    </div>
  );
}

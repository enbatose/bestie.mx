import { Eye, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPublisherMetrics } from "@/components/myListings/listingFormat";

type PublisherMetricChipsProps = {
  viewsCount: number | undefined | null;
  inquiryCount: number | undefined | null;
  /** When true, tooltip notes these are summed across all rooms. */
  summed?: boolean;
  /** Opens the inbox filtered to the listing(s) represented by this metric. */
  messagesTo: string;
  className?: string;
};

/**
 * Compact owner metrics: Eye + count, MessageSquare + count.
 * MessageSquare matches the top-nav Mensajes icon.
 */
export function PublisherMetricChips({
  viewsCount,
  inquiryCount,
  summed = false,
  messagesTo,
  className = "",
}: PublisherMetricChipsProps) {
  const label = formatPublisherMetrics(viewsCount, inquiryCount);
  if (!label) return null;

  const v = Math.max(0, Math.floor(viewsCount ?? 0));
  const m = Math.max(0, Math.floor(inquiryCount ?? 0));
  const title = summed ? `Suma de todas las recámaras — ${label}` : label;

  return (
    <span
      className={`inline-flex items-center gap-x-3 text-xs text-muted ${className}`.trim()}
      title={title}
    >
      <span
        className="inline-flex items-center gap-1"
        aria-label={`${v} vista${v === 1 ? "" : "s"}`}
      >
        <Eye className="size-3.5 shrink-0" aria-hidden />
        {v}
      </span>
      <Link
        to={messagesTo}
        className="inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:underline"
        aria-label={`${m} mensaje${m === 1 ? "" : "s"}. Ver conversaciones de este anuncio`}
      >
        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
        {m}
      </Link>
    </span>
  );
}

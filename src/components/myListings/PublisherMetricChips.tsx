import { Eye, MessageSquare } from "lucide-react";
import { formatPublisherMetrics } from "@/components/myListings/listingFormat";

type PublisherMetricChipsProps = {
  viewsCount: number | undefined | null;
  inquiryCount: number | undefined | null;
  /** When true, tooltip notes these are summed across all rooms. */
  summed?: boolean;
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
      <span
        className="inline-flex items-center gap-1"
        aria-label={`${m} mensaje${m === 1 ? "" : "s"}`}
      >
        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
        {m}
      </span>
    </span>
  );
}

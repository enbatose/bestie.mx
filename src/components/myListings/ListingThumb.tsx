import { Home } from "lucide-react";

type Props = {
  src?: string | null;
  /** Decorative by default; pass alt only when the image carries unique meaning. */
  alt?: string;
  className?: string;
};

/**
 * Compact square thumbnail for publisher hub cards.
 * Pass size via className (`size-16` mobile, `size-10` desktop table).
 * Do not hardcode conflicting size on this shell — see icon-filter-rendering-updates.
 */
export function ListingThumb({ src, alt = "", className = "size-16" }: Props) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-light ring-1 ring-border ${className}`.trim()}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <Home className="size-5 text-muted" strokeWidth={1.75} aria-hidden />
      )}
    </div>
  );
}

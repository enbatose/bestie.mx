import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { KeyLabelItem } from "@/lib/listingKeyLabels";

function KeyLabelCard({ item }: { item: KeyLabelItem }) {
  const Icon = item.icon;
  const valueRef = useRef<HTMLParagraphElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;

    const checkTruncation = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.value]);

  useEffect(() => {
    if (!tooltipOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tooltipRef.current?.contains(target)) return;
      setTooltipOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [tooltipOpen]);

  return (
    <article className="relative rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="relative min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 hyphens-manual text-[11px] font-semibold uppercase tracking-wide text-muted">
              {item.title}
            </p>
            {isTruncated ? (
              <button
                type="button"
                className="-mt-0.5 shrink-0 rounded-full text-muted transition hover:text-primary"
                aria-label={`Ver ${item.title} completo`}
                aria-expanded={tooltipOpen}
                onClick={() => setTooltipOpen((open) => !open)}
              >
                <Info className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <p
            ref={valueRef}
            className="truncate text-xs font-medium text-body"
            title={isTruncated ? item.value : undefined}
          >
            {item.value}
          </p>
          {tooltipOpen ? (
            <div
              ref={tooltipRef}
              role="tooltip"
              className="absolute right-0 top-full z-20 mt-1 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface px-2.5 py-2 text-xs leading-relaxed text-body shadow-md"
            >
              {item.value}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ListingKeyLabelsGrid({ items }: { items: readonly KeyLabelItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.slice(0, 12).map((item) => (
        <KeyLabelCard key={`${item.title}-${item.value}`} item={item} />
      ))}
    </div>
  );
}

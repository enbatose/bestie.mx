import { Camera, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { listingCardQuickAttributes } from "@/components/search/searchQuickAttributes";
import { listingCardSubtitle, listingCardTitle } from "@/lib/listingKeyLabels";
import { listingCoverImageUrl } from "@/lib/listingImageUrls";
import type { PropertyListing } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Variant = "sidebar" | "popup";

type Props = {
  listing: PropertyListing;
  variant: Variant;
  to: string;
  state?: unknown;
  active?: boolean;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  onClick?: () => void;
};

function popupCtaLabel(listing: PropertyListing): string {
  if (listing.lodgingType === "private_room" || listing.lodgingType === "shared_room") {
    return "Ver cuarto";
  }
  return "Ver anuncio";
}

function popupAriaLabel(listing: PropertyListing, title: string): string {
  return `${popupCtaLabel(listing)}: ${title}, ${money.format(listing.rentMxn)} al mes en ${listing.neighborhood}`;
}

function ListingCardThumb({ listing, className }: { listing: PropertyListing; className: string }) {
  const src = listingCoverImageUrl(listing);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-lg object-cover ring-1 ring-border ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-bg-light ring-1 ring-border ${className}`}
      aria-hidden
    >
      <Camera className="size-5 text-muted" strokeWidth={1.75} />
    </div>
  );
}

function ListingCardHero({ listing }: { listing: PropertyListing }) {
  const src = listingCoverImageUrl(listing);
  if (src) {
    return <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-light" aria-hidden>
      <Camera className="size-8 text-muted" strokeWidth={1.75} />
    </div>
  );
}

function SearchListingPopupCard({
  listing,
  to,
  state,
  onClick,
}: Pick<Props, "listing" | "to" | "state" | "onClick">) {
  const title = listingCardTitle(listing);
  const pills = listingCardQuickAttributes(listing)
    .slice(0, 3)
    .map((item) => item.mobileLabel ?? item.label);

  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      aria-label={popupAriaLabel(listing, title)}
      className="block w-[min(92vw,20rem)] overflow-hidden rounded-xl bg-surface text-body shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
    >
      <div className="aspect-[16/10] w-full overflow-hidden bg-bg-light">
        <ListingCardHero listing={listing} />
      </div>
      <div className="p-3">
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-primary">{title}</h2>
        <p className="mt-0.5 truncate text-xs text-muted">{listing.neighborhood}</p>
        <p className="mt-2 text-base font-bold leading-none text-body">
          {money.format(listing.rentMxn)}
          <span className="ml-1 text-xs font-normal text-muted">/ mes</span>
        </p>
        {pills.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {pills.map((label) => (
              <span
                key={label}
                className="rounded-full bg-bg-light px-2 py-0.5 text-[11px] font-semibold text-body ring-1 ring-border"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary">
          <span>{popupCtaLabel(listing)}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

function SearchListingSidebarCard({
  listing,
  to,
  state,
  active,
  onMouseEnter,
  onFocus,
  onClick,
}: Pick<Props, "listing" | "to" | "state" | "active" | "onMouseEnter" | "onFocus" | "onClick">) {
  const title = listingCardTitle(listing);
  const subtitle = listingCardSubtitle(listing);
  const quickAttributes = listingCardQuickAttributes(listing);

  return (
    <Link
      to={to}
      state={state}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onClick={onClick}
      className={`block w-full cursor-pointer rounded-xl border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${
        active
          ? "border-secondary bg-surface shadow-sm ring-2 ring-secondary/25"
          : "border-border bg-surface hover:border-secondary/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <ListingCardThumb listing={listing} className="size-16 sm:size-[4.5rem]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 text-sm font-semibold leading-snug text-primary sm:text-base">{title}</h2>
            <p className="shrink-0 text-xs font-semibold text-body sm:text-sm">{money.format(listing.rentMxn)}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>
          <p className="mt-2 line-clamp-2 text-xs text-muted sm:text-sm">{listing.summary}</p>
          {quickAttributes.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
              {quickAttributes.map((item) => {
                const Icon = item.icon;
                return (
                  <span key={item.id} className="group/icon relative inline-flex">
                    <span
                      className="inline-flex size-8 items-center justify-center rounded-full bg-bg-light text-primary ring-1 ring-border sm:size-9"
                      aria-hidden="true"
                    >
                      <Icon className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-body shadow-md md:group-hover/icon:block">
                      {item.tooltip}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function SearchListingCard({ variant, ...props }: Props) {
  if (variant === "popup") {
    return <SearchListingPopupCard {...props} />;
  }
  return <SearchListingSidebarCard {...props} />;
}

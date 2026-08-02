import { Camera, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { listingCardQuickAttributes } from "@/components/search/searchQuickAttributes";
import { quickAttributeGenderIconClass } from "@/components/icons/GenderFilterIcons";
import { listingCardSubtitle, listingCardTitle } from "@/lib/listingKeyLabels";
import { formatSearchListingRent } from "@/lib/collapseSearchListings";
import { listingCoverImageUrl } from "@/lib/listingImageUrls";
import type { PropertyListing } from "@/types/listing";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type Variant = "sidebar" | "popup" | "mobile-drawer";

type Props = {
  listing: PropertyListing;
  variant: Variant;
  to: string;
  state?: unknown;
  active?: boolean;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  onClick?: () => void;
  onClose?: () => void;
};

function popupCtaLabel(listing: PropertyListing): string {
  if (listing.propertyPostMode === "property") return "Ver propiedad";
  if (listing.lodgingType === "private_room" || listing.lodgingType === "shared_room") {
    return "Ver cuarto";
  }
  return "Ver anuncio";
}

function rentLabel(listing: PropertyListing): string {
  return formatSearchListingRent(listing, money);
}

function popupAriaLabel(listing: PropertyListing, title: string): string {
  return `${popupCtaLabel(listing)}: ${title}, ${rentLabel(listing)} al mes en ${listing.neighborhood}`;
}

function ListingCardThumb({ listing, className }: { listing: PropertyListing; className: string }) {
  const src = listingCoverImageUrl(listing);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`object-cover ring-1 ring-border ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-bg-light ring-1 ring-border ${className}`}
      aria-hidden
    >
      <Camera className="size-4 text-muted" strokeWidth={1.75} />
    </div>
  );
}

function SearchListingPopupCard({
  listing,
  to,
  state,
  onClick,
  onClose,
}: Pick<Props, "listing" | "to" | "state" | "onClick" | "onClose">) {
  const title = listingCardTitle(listing);
  const pills = listingCardQuickAttributes(listing)
    .slice(0, 2)
    .map((item) => item.mobileLabel ?? item.label);

  return (
    <div className="relative w-[min(84vw,15rem)] drop-shadow-md">
      {onClose ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-1 top-1 z-10 inline-flex size-6 items-center justify-center rounded-full bg-surface/95 text-muted shadow-sm ring-1 ring-border transition hover:bg-surface hover:text-body"
          aria-label="Cerrar"
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
      <Link
        to={to}
        state={state}
        onClick={onClick}
        aria-label={popupAriaLabel(listing, title)}
        className="block overflow-hidden rounded-lg bg-surface text-body transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
      >
        <div className="flex items-start gap-2 p-2">
          <ListingCardThumb listing={listing} className="size-[3.25rem] shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 pr-5">
            <h2 className="line-clamp-2 text-xs font-semibold leading-snug text-primary">{title}</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">{listing.neighborhood}</p>
            <p className="mt-1 text-sm font-bold leading-none text-body">
              {rentLabel(listing)}
              <span className="ml-0.5 text-[10px] font-normal text-muted">/ mes</span>
            </p>
            {pills.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {pills.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-bg-light px-1.5 py-px text-[10px] font-semibold text-body ring-1 ring-border"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-9 items-center justify-between gap-2 border-t border-border bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary">
          <span>{popupCtaLabel(listing)}</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        </div>
      </Link>
      <div
        aria-hidden
        className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-surface"
      />
    </div>
  );
}

function SearchListingMobileDrawerCard({
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
      className={`block w-full cursor-pointer rounded-xl border p-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${
        active
          ? "border-secondary bg-surface shadow-sm ring-2 ring-secondary/25"
          : "border-border bg-surface hover:border-secondary/60"
      }`}
    >
      <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-primary">{title}</h2>
      <div className="mt-2 flex items-center gap-2.5">
        <ListingCardThumb listing={listing} className="size-14 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-none text-body">{rentLabel(listing)}</p>
          <p className="mt-1 truncate text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      {quickAttributes.length ? (
        <div className="mt-2.5 flex w-full items-center justify-between gap-1">
          {quickAttributes.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.id} className="group/icon relative inline-flex min-w-0 flex-1 justify-center">
                <span
                  className="inline-flex size-7 items-center justify-center rounded-full bg-bg-light text-primary ring-1 ring-border"
                  aria-hidden="true"
                >
                  <Icon className={quickAttributeGenderIconClass(item.id, true)} aria-hidden="true" />
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-body shadow-md group-hover/icon:block">
                  {item.tooltip}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
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
        <ListingCardThumb listing={listing} className="size-16 shrink-0 rounded-lg sm:size-[4.5rem]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 text-sm font-semibold leading-snug text-primary sm:text-base">{title}</h2>
            <p className="shrink-0 text-xs font-semibold text-body sm:text-sm">{rentLabel(listing)}</p>
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
                      <Icon className={quickAttributeGenderIconClass(item.id, false)} aria-hidden="true" />
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
  if (variant === "mobile-drawer") {
    return <SearchListingMobileDrawerCard {...props} />;
  }
  return <SearchListingSidebarCard {...props} />;
}

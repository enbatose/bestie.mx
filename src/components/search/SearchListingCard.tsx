import { Camera } from "lucide-react";
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

const variantConfig: Record<
  Variant,
  {
    shell: string;
    activeShell: string;
    idleShell: string;
    thumb: string;
    title: string;
    subtitle: string;
    price: string;
    summary: string;
    iconWrap: string;
    icon: string;
    attrGap: string;
    summaryMt: string;
  }
> = {
  sidebar: {
    shell: "rounded-xl p-3",
    activeShell: "border-secondary bg-surface shadow-sm ring-2 ring-secondary/25",
    idleShell: "border-border bg-surface hover:border-secondary/60",
    thumb: "size-16 sm:size-[4.5rem]",
    title: "text-sm leading-snug sm:text-base",
    subtitle: "text-xs sm:text-sm",
    price: "text-xs sm:text-sm",
    summary: "line-clamp-2 text-xs sm:line-clamp-2 sm:text-sm",
    iconWrap: "size-8 sm:size-9",
    icon: "size-4 sm:size-[1.05rem]",
    attrGap: "mt-2 sm:mt-3",
    summaryMt: "mt-2",
  },
  popup: {
    shell: "rounded-lg p-2",
    activeShell: "",
    idleShell: "",
    thumb: "size-14 sm:size-16",
    title: "text-sm leading-snug",
    subtitle: "text-xs",
    price: "text-xs sm:text-sm",
    summary: "line-clamp-2 text-xs",
    iconWrap: "size-7",
    icon: "size-3.5",
    attrGap: "mt-1.5",
    summaryMt: "mt-1.5",
  },
};

function ListingCardCover({ listing, className }: { listing: PropertyListing; className: string }) {
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

export function SearchListingCard({
  listing,
  variant,
  to,
  state,
  active = false,
  onMouseEnter,
  onFocus,
  onClick,
}: Props) {
  const cfg = variantConfig[variant];
  const title = listingCardTitle(listing);
  const subtitle = listingCardSubtitle(listing);
  const quickAttributes = listingCardQuickAttributes(listing);
  const isPopup = variant === "popup";

  return (
    <Link
      to={to}
      state={state}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onClick={onClick}
      className={`block w-full cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${
        isPopup
          ? `min-w-[248px] max-w-[280px] text-body hover:opacity-95 ${cfg.shell}`
          : `border ${cfg.shell} ${active ? cfg.activeShell : cfg.idleShell}`
      }`}
    >
      <div className="flex items-start gap-3">
        <ListingCardCover listing={listing} className={cfg.thumb} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`min-w-0 font-semibold text-primary ${cfg.title}`}>{title}</h2>
            <p className={`shrink-0 font-semibold text-body ${cfg.price}`}>{money.format(listing.rentMxn)}</p>
          </div>
          <p className={`mt-0.5 text-muted ${cfg.subtitle}`}>{subtitle}</p>
          <p className={`text-muted ${cfg.summaryMt} ${cfg.summary}`}>{listing.summary}</p>
          {quickAttributes.length ? (
            <div className={`flex flex-wrap gap-1.5 ${cfg.attrGap}`}>
              {quickAttributes.map((item) => {
                const Icon = item.icon;
                return (
                  <span key={item.id} className="group/icon relative inline-flex">
                    <span
                      className={`inline-flex items-center justify-center rounded-full bg-bg-light text-primary ring-1 ring-border ${cfg.iconWrap}`}
                      aria-hidden="true"
                    >
                      <Icon className={cfg.icon} aria-hidden="true" />
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

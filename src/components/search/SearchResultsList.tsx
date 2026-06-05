import { Link } from "react-router-dom";
import { listingCardQuickAttributes } from "@/components/search/searchQuickAttributes";
import {
  listingCardHref,
  listingCardSubtitle,
  listingCardTitle,
} from "@/lib/listingKeyLabels";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Tighter cards for the narrow list column. */
  dense?: boolean;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function SearchResultsList({ listings, selectedId, onSelect, dense = false }: Props) {
  if (!listings.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-bg-light p-6 text-sm text-muted">
        No hay resultados con estos filtros. Ajusta ubicación o presupuesto.
      </div>
    );
  }

  return (
    <ol className={dense ? "space-y-2" : "space-y-3"}>
      {listings.map((l) => {
        const active = l.id === selectedId;
        const title = listingCardTitle(l);
        const subtitle = listingCardSubtitle(l);
        const quickAttributes = listingCardQuickAttributes(l);

        return (
          <li key={l.id}>
            <Link
              to={listingCardHref(l)}
              onMouseEnter={() => onSelect(l.id)}
              onFocus={() => onSelect(l.id)}
              onClick={() => onSelect(l.id)}
              className={`border transition ${
                dense ? "rounded-xl p-3" : "rounded-2xl p-4 sm:p-5"
              } ${
                active
                  ? "border-secondary bg-surface shadow-sm ring-2 ring-secondary/25"
                  : "border-border bg-surface hover:border-secondary/60"
              } block w-full cursor-pointer focus-visible:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    className={`font-semibold text-primary ${
                      dense ? "text-sm leading-snug sm:text-base" : "text-base sm:text-lg"
                    }`}
                  >
                    {title}
                  </h2>
                  <p className={`mt-0.5 text-muted ${dense ? "text-xs" : "text-sm"}`}>{subtitle}</p>
                </div>
                <p
                  className={`shrink-0 font-semibold text-body ${
                    dense ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                  }`}
                >
                  {money.format(l.rentMxn)}
                </p>
              </div>
              <p className={`mt-2 text-muted ${dense ? "line-clamp-2 text-xs" : "line-clamp-2 text-sm"}`}>
                {l.summary}
              </p>
              {quickAttributes.length ? (
                <div className={`flex flex-wrap gap-2 ${dense ? "mt-2" : "mt-3"}`}>
                  {quickAttributes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <span key={item.id} className="group/icon relative inline-flex">
                        <span
                          className={`inline-flex items-center justify-center rounded-full bg-bg-light text-primary ring-1 ring-border ${
                            dense ? "size-8" : "size-9"
                          }`}
                          aria-hidden="true"
                        >
                          <Icon className={dense ? "size-4" : "size-[1.05rem]"} aria-hidden="true" />
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-body shadow-md md:group-hover/icon:block">
                          {item.tooltip}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

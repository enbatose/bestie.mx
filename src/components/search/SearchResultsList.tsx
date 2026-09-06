import { SearchListingCard } from "@/components/search/SearchListingCard";
import { listingCardHref } from "@/lib/listingKeyLabels";
import { listingNavigationState, type SearchReturnContext } from "@/lib/searchReturn";
import type { PropertyListing } from "@/types/listing";

export type SearchResultsSection = {
  id: string;
  title: string;
  listings: PropertyListing[];
};

type Props = {
  listings: PropertyListing[];
  sections?: SearchResultsSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchReturn: SearchReturnContext;
  /** Tighter cards for the narrow list column. */
  dense?: boolean;
  cardVariant?: "sidebar" | "mobile-drawer";
};

export function SearchResultsList({
  listings,
  sections,
  selectedId,
  onSelect,
  searchReturn,
  dense = false,
  cardVariant = "sidebar",
}: Props) {
  const blocks = sections?.length
    ? sections
    : [{ id: "all", title: "", listings }];
  const total = blocks.reduce((n, b) => n + b.listings.length, 0);

  if (!total) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-bg-light p-6 text-sm text-muted">
        No hay resultados con estos filtros. Ajusta ubicación o presupuesto.
      </div>
    );
  }

  return (
    <div className={dense ? "space-y-4" : "space-y-5"}>
      {blocks.map((block) => (
        <section key={block.id} className="min-w-0">
          {block.title ? (
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {block.title}
              <span className="ml-1 font-medium tabular-nums">({block.listings.length})</span>
            </h3>
          ) : null}
          {block.listings.length ? (
            <ol className={dense ? "space-y-2" : "space-y-3"}>
              {block.listings.map((l) => (
                <li key={l.id}>
                  <SearchListingCard
                    listing={l}
                    variant={cardVariant}
                    to={listingCardHref(l)}
                    state={listingNavigationState(searchReturn)}
                    active={l.id === selectedId}
                    onMouseEnter={() => onSelect(l.id)}
                    onFocus={() => onSelect(l.id)}
                    onClick={() => onSelect(l.id)}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Ningún anuncio en este grupo.</p>
          )}
        </section>
      ))}
    </div>
  );
}

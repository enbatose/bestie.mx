import { SearchListingCard } from "@/components/search/SearchListingCard";
import { listingCardHref } from "@/lib/listingKeyLabels";
import { listingNavigationState, type SearchReturnContext } from "@/lib/searchReturn";
import type { PropertyListing } from "@/types/listing";

type Props = {
  listings: PropertyListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchReturn: SearchReturnContext;
  /** Tighter cards for the narrow list column. */
  dense?: boolean;
};

export function SearchResultsList({ listings, selectedId, onSelect, searchReturn, dense = false }: Props) {
  if (!listings.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-bg-light p-6 text-sm text-muted">
        No hay resultados con estos filtros. Ajusta ubicación o presupuesto.
      </div>
    );
  }

  return (
    <ol className={dense ? "space-y-2" : "space-y-3"}>
      {listings.map((l) => (
        <li key={l.id}>
          <SearchListingCard
            listing={l}
            variant="sidebar"
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
  );
}

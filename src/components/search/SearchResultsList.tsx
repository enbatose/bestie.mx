import { Link } from "react-router-dom";
import {
  listingCardHref,
  listingCardKeyTags,
  listingCardSubtitle,
  listingCardTagLabel,
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
        const keyTags = listingCardKeyTags(l.tags);
        const title = listingCardTitle(l);
        const subtitle = listingCardSubtitle(l);

        return (
          <li key={l.id}>
            <article
              className={`border transition ${
                dense ? "rounded-xl p-3" : "rounded-2xl p-4 sm:p-5"
              } ${
                active
                  ? "border-secondary bg-surface shadow-sm ring-2 ring-secondary/25"
                  : "border-border bg-surface hover:border-secondary/60"
              }`}
            >
              <button type="button" onClick={() => onSelect(l.id)} className="w-full text-left">
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
                {keyTags.length ? (
                  <div className={`flex flex-wrap gap-1 ${dense ? "mt-2" : "mt-3 gap-1.5"}`}>
                    {keyTags.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full bg-bg-light font-medium text-body ring-1 ring-border ${
                          dense ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px] sm:text-xs"
                        }`}
                      >
                        {listingCardTagLabel(t)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
              <div className={`flex flex-wrap gap-2 ${dense ? "mt-2" : "mt-3"}`}>
                <Link
                  to={listingCardHref(l)}
                  className={`inline-flex min-h-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-fg transition hover:brightness-110 ${
                    dense ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs sm:text-sm"
                  }`}
                >
                  Ver anuncio
                </Link>
                {!dense ? (
                  <button
                    type="button"
                    onClick={() => onSelect(l.id)}
                    className="inline-flex min-h-9 items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated sm:text-sm"
                  >
                    Ver en mapa
                  </button>
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

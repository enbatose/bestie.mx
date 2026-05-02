import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { DEFAULT_SEARCH_FILTERS, filtersToParams } from "@/lib/searchFilters";
import { withDefaultSearchCity } from "@/lib/searchDefaults";

const PROXIMAS_CITIES = ["Mérida", "Puerto Vallarta", "Sayulita", "Bucerías"] as const;

const cityChipAvailable =
  "rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-body transition hover:border-secondary hover:bg-surface-elevated";

const cityChipSoon =
  "inline-flex rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-body";

function buildSearchParams(query: string): URLSearchParams {
  return filtersToParams({ ...DEFAULT_SEARCH_FILTERS, q: withDefaultSearchCity(query) });
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const goSearch = useCallback(() => {
    navigate({ pathname: "/buscar", search: `?${buildSearchParams(searchQuery).toString()}` });
  }, [navigate, searchQuery]);

  const goSearchForCity = useCallback(
    (city: string) => {
      navigate({ pathname: "/buscar", search: `?${buildSearchParams(city).toString()}` });
    },
    [navigate],
  );

  return (
    <>
      <section className="relative overflow-hidden bg-primary px-4 pb-16 pt-10 text-primary-fg sm:px-6 sm:pb-24 sm:pt-14">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-secondary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-6 max-w-xl">
            <BrandLogo
              variant="onDark"
              imgClassName="h-10 w-auto max-w-[min(100%,280px)] object-left sm:h-12 sm:max-w-[320px]"
            />
          </div>
          <p className="text-sm font-medium uppercase tracking-wider text-accent">
            México · depas compartidos
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Tu roomie, <span className="text-secondary">tu bestie</span>. Encuentra roomies en las
            ciudades donde vives o quieres estar.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-primary-fg/90">
            Bestie.mx te permite encontrar roomies de forma rápida y segura. Priorizamos la búsqueda
            por ubicación sin sacrificar los filtros que de verdad te importan.
          </p>
          <div
            id="hero-busqueda"
            className="mt-8 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-center"
          >
            <label className="sr-only" htmlFor="search-q">
              Buscar ciudad o colonia
            </label>
            <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
              <input
                ref={searchInputRef}
                id="search-q"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goSearch();
                }}
                placeholder="Ciudad o colonia"
                className="min-h-12 w-full flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-base text-primary-fg placeholder:text-primary-fg/60 backdrop-blur focus:border-accent focus:bg-white/15"
              />
              <button
                type="button"
                onClick={goSearch}
                className="min-h-12 shrink-0 rounded-xl bg-secondary px-6 text-base font-semibold text-primary shadow-lg transition hover:brightness-95 active:scale-[0.99]"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <div>
              <h2 className="text-lg font-semibold text-body sm:text-xl">Ciudades disponibles</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                <li>
                  <button
                    type="button"
                    aria-label="Abrir mapa de búsqueda en Guadalajara"
                    onClick={() => goSearchForCity("Guadalajara")}
                    className={cityChipAvailable}
                  >
                    Guadalajara
                  </button>
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted">
                Toca la ciudad para ir al mapa y a la lista con filtros para esa zona.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-body sm:text-xl">Próximamente</h2>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Ciudades próximamente">
                {PROXIMAS_CITIES.map((city) => (
                  <li key={city}>
                    <span className={cityChipSoon}>{city}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-primary px-4 py-10 text-center text-primary-fg sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">Publicar anuncios</h2>
          <p className="mt-2 text-sm text-primary-fg/90">
            Publica un cuarto o múltiples cuartos como parte de una propiedad completa.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              to="/publicar"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-secondary px-8 text-base font-bold text-primary shadow-md transition hover:brightness-95"
            >
              Publicar anuncio
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

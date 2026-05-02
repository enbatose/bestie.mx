import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="w-full max-w-[60rem]">
            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Tu roomie, <span className="text-secondary">tu bestie</span>. Encuentra roomies en las
              ciudades donde vives o quieres estar.
            </h1>
            <p className="mt-4 text-balance text-lg leading-7 text-primary-fg/90">
              Bestie.mx te permite encontrar roomies de forma rápida y segura. Priorizamos la búsqueda
              por ubicación sin sacrificar los filtros que de verdad te importan.
            </p>
          </div>
          <div
            id="hero-busqueda"
            className="mt-8 flex w-full max-w-[45rem] scroll-mt-24 flex-col items-stretch gap-3"
          >
            <label className="sr-only" htmlFor="search-q">
              Buscar ciudad o colonia
            </label>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
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
            <div className="flex flex-col items-center text-center">
              <h2 className="text-lg font-semibold text-body sm:text-xl">Ciudades disponibles</h2>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
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
              <p className="mt-4 text-balance text-sm text-muted">
                Toca la ciudad para ir al mapa y a la lista con filtros para esa zona.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <h2 className="text-lg font-semibold text-body sm:text-xl">Próximamente</h2>
              <ul
                className="mt-4 flex flex-wrap justify-center gap-2"
                aria-label="Ciudades próximamente"
              >
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

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Propiedad y cuartos",
              body: "Publica un cuarto de forma rápida. Adicionalmente, ofrecemos publicaciones de propiedad, para mostrar múltiples cuartos y áreas comunes de forma clara.",
            },
            {
              title: "Mapa + lista",
              body: "Interfaz de mapa con pins y listado de publicaciones para explorar por zona.",
            },
            {
              title: "Filtros relevantes",
              body: "Selecciona los filtros más relevantes como género de roomies buscados o existentes, rango de edad, baño privado, estacionamiento, entre muchos otros.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="flex flex-col items-center rounded-2xl border border-border bg-surface p-5 text-center shadow-sm"
            >
              <img
                src="/brand/logo-mark.svg"
                alt=""
                width={40}
                height={40}
                className="mb-3 h-9 w-9 opacity-90 sm:h-10 sm:w-10"
                decoding="async"
              />
              <h3 className="font-semibold text-primary">{card.title}</h3>
              <p className="mt-2 text-balance text-sm leading-relaxed text-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchFeaturedCities } from "@/lib/authApi";
import { DEFAULT_SEARCH_FILTERS, filtersToParams } from "@/lib/searchFilters";
import { withDefaultSearchCity } from "@/lib/searchDefaults";

const DEFAULT_CITIES = ["Guadalajara"] as const;

/** Cities removed from the home list (still allowed in search data if present). */
const HOME_CITY_BLOCKLIST = new Set([
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
]);

function filterHomeCities(list: string[]): string[] {
  return [...new Set(list.map((c) => c.trim()).filter(Boolean))].filter((c) => !HOME_CITY_BLOCKLIST.has(c));
}

function buildSearchParams(query: string): URLSearchParams {
  return filtersToParams({ ...DEFAULT_SEARCH_FILTERS, q: withDefaultSearchCity(query) });
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [cityChoices, setCityChoices] = useState<string[]>(filterHomeCities([...DEFAULT_CITIES]));
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchFeaturedCities().then((fc) => {
      const merged = filterHomeCities([...new Set([...fc, ...DEFAULT_CITIES])]);
      setCityChoices(merged.length ? merged : [...DEFAULT_CITIES]);
    });
  }, []);

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
            Tu depa, <span className="text-secondary">tus reglas</span>. Encuentra roomies en las
            ciudades donde vives o quieres estar.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-primary-fg/90">
            Mapa con pins, filtros por ubicación, presupuesto, etiquetas, preferencia de roomies y
            edad. Publica por propiedad o por cuarto con un flujo claro.
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
                placeholder="Ciudad, colonia o punto de interés…"
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
          <h2 className="text-lg font-semibold text-body sm:text-xl">Ciudades disponibles</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cityChoices.map((city) => (
              <li key={city}>
                <button
                  type="button"
                  aria-label={`Abrir mapa de búsqueda en ${city}`}
                  onClick={() => goSearchForCity(city)}
                  className="rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-body transition hover:border-secondary hover:bg-surface-elevated"
                >
                  {city}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Toca una ciudad para ir al mapa y a la lista con filtros para esa zona.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-primary px-4 py-10 text-center text-primary-fg sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">Publicar anuncio</h2>
          <p className="mt-2 text-sm text-primary-fg/90">
            Publica cuarto(s) o vivienda completa con el asistente paso a paso en Bestie.
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
              body: "Un anuncio por propiedad; cada cuarto con su estado (borrador, publicado, pausado, archivado).",
            },
            {
              title: "Mapa + lista",
              body: "Pins en mapa y tarjetas sincronizadas para explorar por zona, con datos de ejemplo hasta conectar la API.",
            },
            {
              title: "Cuenta y comunidad",
              body: "WhatsApp OTP y correo vía API, webhook de Messenger con handoff a publicar, y grupos para rentar en equipo.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
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
              <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

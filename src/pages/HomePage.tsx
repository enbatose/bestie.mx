import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPinned, Search, SlidersHorizontal, UsersRound, type LucideIcon } from "lucide-react";
import { HeroAnimatedLockup } from "@/components/HeroAnimatedLockup";
import { DEFAULT_SEARCH_FILTERS, filtersToParams } from "@/lib/searchFilters";
import { withDefaultSearchCity } from "@/lib/searchDefaults";
import { DEFAULT_METRO_CITY } from "@/lib/metroCities";

const PROXIMAS_CITIES = [
  "Puerto Vallarta",
  "Sayulita",
  "Morelia",
  "Aguascalientes",
  "León",
] as const;

const STEPS: ReadonlyArray<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: MapPinned,
    title: "Elige tu zona",
    body: "Empieza por ciudad o colonia. El mapa y la lista se mueven juntos.",
  },
  {
    icon: SlidersHorizontal,
    title: "Filtra lo que importa",
    body: "Género, edad, baño privado, estacionamiento y más — sin ruido.",
  },
  {
    icon: UsersRound,
    title: "Conoce a tu roomie",
    body: "Abre el anuncio, revisa el espacio y da el siguiente paso con confianza.",
  },
];

function buildSearchParams(query: string): URLSearchParams {
  return filtersToParams({ ...DEFAULT_SEARCH_FILTERS, q: withDefaultSearchCity(query) });
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const goSearch = useCallback(() => {
    navigate({ pathname: "/buscar/gdl", search: `?${buildSearchParams(searchQuery).toString()}` });
  }, [navigate, searchQuery]);

  const goSearchForCity = useCallback(
    (city: string) => {
      navigate({ pathname: "/buscar/gdl", search: `?${buildSearchParams(city).toString()}` });
    },
    [navigate],
  );

  return (
    <>
      {/* Hero — one composition: brand, line, support, search */}
      <section className="home-hero relative overflow-hidden bg-primary px-4 pb-16 pt-12 text-primary-fg sm:px-6 sm:pb-20 sm:pt-16">
        <div
          className="home-hero-orb pointer-events-none absolute -left-20 -top-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="home-hero-orb home-hero-orb--delay pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-secondary/10 blur-2xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="home-hero-rise flex w-full max-w-[42rem] flex-col items-center">
            <HeroAnimatedLockup />

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary-fg/70">
              Roomies en México
            </p>

            <h1 className="mt-3 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Tu roomie, <span className="text-secondary">tu bestie</span>.
            </h1>

            <p className="mt-4 max-w-xl text-balance text-base leading-7 text-primary-fg/90 sm:text-lg">
              Encuentra roomies de forma rápida y segura. Priorizamos la ubicación sin sacrificar
              los filtros que de verdad te importan.
            </p>
          </div>

          <div
            id="hero-busqueda"
            className="home-hero-rise home-hero-rise--delay mt-8 w-full max-w-[32rem] scroll-mt-24 sm:max-w-[36rem]"
          >
            <label className="sr-only" htmlFor="search-q">
              Buscar colonia
            </label>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
              <div className="flex min-h-12 w-full flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40">
                <span
                  className="inline-flex shrink-0 items-center rounded-full border border-primary/35 bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-fg"
                  aria-label={`Ciudad ${DEFAULT_METRO_CITY.label}`}
                >
                  {DEFAULT_METRO_CITY.abbr}
                </span>
                <Search className="size-4 shrink-0 text-muted" aria-hidden strokeWidth={2.25} />
                <input
                  ref={searchInputRef}
                  id="search-q"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goSearch();
                  }}
                  placeholder="Buscar colonia…"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-base font-medium text-body caret-primary placeholder:text-muted outline-none"
                />
              </div>
              <button
                type="button"
                onClick={goSearch}
                className="min-h-12 shrink-0 rounded-full bg-secondary px-7 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona — one job, light structure, no decorative cards */}
      <section className="border-b border-border bg-bg-light px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-lg font-semibold tracking-tight text-body sm:text-xl">
              Así de simple
            </h2>
            <p className="mt-2 text-balance text-sm leading-relaxed text-muted sm:text-base">
              Menos scroll infinito, más roomies reales cerca de ti.
            </p>
          </div>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-8 lg:gap-10">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="mx-auto flex w-full max-w-xs flex-col items-center text-center">
                  <span
                    className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary"
                    aria-hidden
                  >
                    <Icon className="size-6" strokeWidth={2.25} />
                  </span>
                  <h3 className="mt-4 font-semibold text-body">{step.title}</h3>
                  <p className="mt-2 text-balance text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Ciudades */}
      <section className="bg-surface px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Disponible</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Ciudades activas</h2>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                <li>
                  <button
                    type="button"
                    aria-label="Abrir mapa de búsqueda en Guadalajara"
                    onClick={() => goSearchForCity("Guadalajara")}
                    className="rounded-full border border-secondary/50 bg-secondary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-secondary/25 active:scale-[0.99]"
                  >
                    Guadalajara
                  </button>
                </li>
              </ul>
              <p className="mt-4 max-w-sm text-balance text-sm text-muted">
                Toca la ciudad para ir al mapa y a la lista con filtros para esa zona.
              </p>
            </div>

            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Roadmap</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Próximamente</h2>
              <ul
                className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start"
                aria-label="Ciudades próximamente"
              >
                {PROXIMAS_CITIES.map((city) => (
                  <li key={city}>
                    <span className="inline-flex rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-muted">
                      {city}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Publicar — trust + energy CTA on forest */}
      <section className="relative overflow-hidden bg-primary px-4 py-14 text-center text-primary-fg sm:px-6 sm:py-16">
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-secondary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">¿Tienes un cuarto libre?</h2>
          <p className="mt-2 text-balance text-sm leading-relaxed text-primary-fg/90 sm:text-base">
            Publica un cuarto o varios como parte de una propiedad. Claro, rápido y en tu ciudad.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/publicar"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
            >
              Publicar anuncio
            </Link>
            <Link
              to="/faq"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 text-sm font-semibold text-primary-fg transition hover:bg-white/10"
            >
              Cómo funciona
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

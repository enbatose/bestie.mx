import { Link } from "react-router-dom";
import { MapPinned, SlidersHorizontal, UsersRound, type LucideIcon } from "lucide-react";
import { HeroAnimatedLockup } from "@/components/HeroAnimatedLockup";
import { METRO_CITIES } from "@/lib/metroCities";
import { track } from "@/lib/analytics";
import { usePageSeo } from "@/hooks/usePageSeo";
import { DEFAULT_SEO } from "@/lib/seo";

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

/** Mexico hub: pick a city before search/publish CTAs (those live on city landings). */
export function HomePage() {
  usePageSeo({
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    canonicalPath: "/",
  });

  const launchCities = METRO_CITIES.filter((c) => c.enabled);
  const soonMetros = METRO_CITIES.filter((c) => !c.enabled);

  return (
    <>
      <section className="home-hero relative bg-primary px-4 pb-16 pt-12 text-primary-fg sm:px-6 sm:pb-20 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="home-hero-orb absolute -left-20 -top-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
          <div className="home-hero-orb home-hero-orb--delay absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-secondary/10 blur-2xl" />
        </div>

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
              Bestie MX conecta roomies y cuartos compartidos en las principales ciudades de México.
              Elige tu ciudad para ver anuncios, mapa y filtros locales.
            </p>
          </div>

          <div className="home-hero-rise home-hero-rise--delay mt-10 w-full max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-fg/65">
              ¿En qué ciudad buscas?
            </p>
            <ul className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {launchCities.map((city) => (
                <li key={city.code}>
                  <Link
                    to={`/${city.code === "gdl" ? "guadalajara" : city.code}`}
                    onClick={() =>
                      track("home_cta_clicked", { cta: "city_guadalajara" })
                    }
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-secondary px-7 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
                  >
                    {city.label}
                    <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold tracking-wide">
                      {city.abbr}
                    </span>
                  </Link>
                </li>
              ))}
              {soonMetros.map((city) => (
                <li key={city.code}>
                  <span
                    className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 text-sm font-semibold text-primary-fg/55"
                    title="Próximamente"
                    aria-disabled="true"
                  >
                    {city.label}
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tracking-wide">
                      {city.abbr}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-primary-fg/70">
              Guadalajara ya está disponible. CDMX y Monterrey llegan pronto.
            </p>
          </div>
        </div>
      </section>

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
                <li
                  key={step.title}
                  className="mx-auto flex w-full max-w-xs flex-col items-center text-center"
                >
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

      <section className="bg-surface px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Disponible</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Ciudades activas</h2>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                {launchCities.map((city) => (
                  <li key={city.code}>
                    <Link
                      to="/guadalajara"
                      onClick={() => track("home_cta_clicked", { cta: "city_guadalajara" })}
                      className="rounded-full border border-secondary/50 bg-secondary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-secondary/25 active:scale-[0.99]"
                    >
                      {city.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-sm text-balance text-sm text-muted">
                Entra a la ciudad para ver anuncios, datos locales y el mapa con filtros.
              </p>
            </div>

            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Roadmap</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">Próximamente</h2>
              <ul
                className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start"
                aria-label="Ciudades próximamente"
              >
                {soonMetros.map((city) => (
                  <li key={city.code}>
                    <span className="inline-flex rounded-full border border-border bg-bg-light px-4 py-2 text-sm font-medium text-muted">
                      {city.label}
                    </span>
                  </li>
                ))}
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

      <section className="border-t border-border bg-bg-light px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-lg font-semibold text-body sm:text-xl">
            Una plataforma, varias ciudades
          </h2>
          <p className="mt-3 text-balance text-sm leading-relaxed text-muted sm:text-base">
            Bestie MX nace en Guadalajara y crece hacia el resto del país: mismo mapa, mismos
            filtros y contacto directo, ciudad por ciudad.
          </p>
          <Link
            to="/faq"
            onClick={() => track("home_cta_clicked", { cta: "faq" })}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-primary/25 bg-surface px-6 text-sm font-semibold text-primary transition hover:border-primary/50"
          >
            Cómo funciona
          </Link>
        </div>
      </section>
    </>
  );
}

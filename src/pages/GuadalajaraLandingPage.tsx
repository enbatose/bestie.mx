import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPinned, TrendingUp, Users } from "lucide-react";
import { GdlHeroAnimatedLockup } from "@/components/home/GdlHeroAnimatedLockup";
import { GdlLandmarkSilhouettes } from "@/components/home/GdlLandmarkSilhouettes";
import { HomeLocationSearch } from "@/components/home/HomeLocationSearch";
import { SearchListingCard } from "@/components/search/SearchListingCard";
import { usePageSeo } from "@/hooks/usePageSeo";
import { track } from "@/lib/analytics";
import { collapseSearchListings } from "@/lib/collapseSearchListings";
import { fetchListingsFromApi, isListingsApiConfigured } from "@/lib/listingsApi";
import { listingCardHref } from "@/lib/listingKeyLabels";
import { findMetroCity } from "@/lib/metroCities";
import { searchPathForCity } from "@/lib/searchLocation";
import type { PropertyListing } from "@/types/listing";

const GDL = findMetroCity("gdl")!;

const GDL_FACTS: ReadonlyArray<{
  icon: typeof Users;
  title: string;
  body: string;
}> = [
  {
    icon: Users,
    title: "Ciudad de roomies",
    body: "Universidades, hospitales y corredores creativos concentran mucha demanda de cuarto compartido y comparto depa.",
  },
  {
    icon: MapPinned,
    title: "Zona metropolitana",
    body: "Americana, Lafayette, Providencia, Chapalita y Zapopan suelen liderar búsquedas de roomie GDL en Bestie.",
  },
  {
    icon: TrendingUp,
    title: "Mercado activo",
    body: "Fotos claras, renta y reglas de convivencia en el anuncio aceleran el match frente a posts sueltos.",
  },
  {
    icon: Building2,
    title: "Íconos tapatíos",
    body: "Del Centro Histórico a la Minerva y el Águila: la ciudad se vive por colonias — por eso el mapa es el centro de Bestie.",
  },
];

function isGuadalajaraListing(listing: PropertyListing): boolean {
  const city = `${listing.city} ${listing.neighborhood}`.toLowerCase();
  return (
    city.includes("guadalajara") ||
    city.includes("zapopan") ||
    city.includes("tlaquepaque") ||
    city.includes("tonalá") ||
    city.includes("tonala") ||
    city.includes("gdl")
  );
}

export function GuadalajaraLandingPage() {
  usePageSeo({
    title: "Roomie Guadalajara | Cuartos compartidos y comparto depa GDL — Bestie MX",
    description:
      "Roomie Guadalajara y roomie GDL: hechos locales, anuncios activos y mapa con filtros para cuartos compartidos y comparto depa en la ZMG.",
    canonicalPath: "/guadalajara",
  });

  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    if (!isListingsApiConfigured()) {
      setLoadingListings(false);
      return;
    }
    const ac = new AbortController();
    fetchListingsFromApi(new URLSearchParams(), ac.signal)
      .then((rows) => {
        // Match search: one card per property-mode post; room-mode stays one per room.
        const gdl = collapseSearchListings(rows.filter(isGuadalajaraListing)).slice(0, 8);
        setListings(gdl.length ? gdl : collapseSearchListings(rows).slice(0, 8));
      })
      .catch(() => setListings([]))
      .finally(() => {
        if (!ac.signal.aborted) setLoadingListings(false);
      });
    return () => ac.abort();
  }, []);

  const mapHref = searchPathForCity(GDL.code);

  return (
    <>
      <section className="home-hero relative overflow-hidden bg-primary px-4 pb-16 pt-12 text-primary-fg sm:px-6 sm:pb-20 sm:pt-16 md:pb-36">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <img
            src="/brand/facebook/cover-1640x624.png"
            alt=""
            className="h-full w-full object-cover opacity-[0.18]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/88 to-primary" />
          <div className="home-hero-orb absolute -left-20 -top-16 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
          <div className="home-hero-orb home-hero-orb--delay absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
        </div>

        <GdlLandmarkSilhouettes />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="home-hero-rise flex w-full max-w-[42rem] flex-col items-center">
            <GdlHeroAnimatedLockup />

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary-fg/70">
              Bestie MX · Guadalajara
            </p>

            <div className="mt-3 flex w-full max-w-full flex-col items-stretch sm:inline-flex sm:w-fit">
              <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:whitespace-nowrap sm:text-4xl md:text-5xl">
                Roomie en <span className="text-secondary">Guadalajara</span>
              </h1>

              <p className="mt-4 w-0 min-w-full text-balance text-base leading-7 text-primary-fg/90 sm:text-lg">
                Cuartos compartidos, comparto depa y roomie GDL con mapa, filtros y contacto directo.
                Empieza por colonia o abre el mapa de la ZMG.
              </p>

              <HomeLocationSearch metro={GDL} className="mt-8 !max-w-none" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={mapHref}
              onClick={() => track("home_cta_clicked", { cta: "map_gdl" })}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-primary-fg transition hover:bg-white/15"
            >
              Ver mapa GDL
            </Link>
            <Link
              to="/publicar"
              onClick={() => track("home_cta_clicked", { cta: "publish" })}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-primary transition hover:brightness-95"
            >
              Publicar anuncio
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-bg-light px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-lg font-semibold tracking-tight text-body sm:text-xl">
              La escena roomie en GDL
            </h2>
            <p className="mt-2 text-balance text-sm leading-relaxed text-muted sm:text-base">
              Datos y contexto para buscar (o publicar) con más claridad en Guadalajara.
            </p>
          </div>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {GDL_FACTS.map((fact) => {
              const Icon = fact.icon;
              return (
                <li key={fact.title} className="text-center sm:text-left">
                  <span
                    className="inline-flex size-11 items-center justify-center rounded-full bg-secondary text-primary"
                    aria-hidden
                  >
                    <Icon className="size-5" strokeWidth={2.25} />
                  </span>
                  <h3 className="mt-3 font-semibold text-body">{fact.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{fact.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-b border-border bg-surface px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Dato curioso · GDL</p>
          <h2 className="mt-3 text-balance text-lg font-semibold tracking-tight text-body sm:text-xl">
            En Guadalajara, roomie todavía se busca en Facebook
          </h2>
          <p className="mt-3 text-balance text-sm leading-relaxed text-muted sm:text-base">
            La mayoría de la gente publica y busca cuarto compartido en grupos. El detalle: no hay un
            solo lugar. En rentas de la ZMG aparecen más de 160 grupos de vivienda, y más de 50 son
            específicos de roomies y cuartos — cada uno con sus reglas, su spam y su timeline.
          </p>
          <p className="mt-3 text-balance text-sm leading-relaxed text-body sm:text-base">
            Encontrar el match exacto se vuelve un laberinto. Bestie junta eso en un mapa: filtros,
            anuncios claros y contacto directo, sin cazar entre 50+ feeds.
          </p>
          <Link
            to={mapHref}
            onClick={() => track("home_cta_clicked", { cta: "map_gdl_dato" })}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
          >
            Ver el mapa de GDL
          </Link>
        </div>
      </section>

      <section className="bg-bg-light px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Anuncios</p>
              <h2 className="mt-2 text-lg font-semibold text-body sm:text-xl">
                Publicaciones en Guadalajara
              </h2>
              <p className="mt-1 text-sm text-muted">
                Una muestra de lo que hay ahora. El mapa tiene el inventario completo.
              </p>
            </div>
            <Link
              to={mapHref}
              onClick={() => track("home_cta_clicked", { cta: "map_gdl" })}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-primary/25 px-4 text-sm font-semibold text-primary transition hover:border-primary/50"
            >
              Ver todos en el mapa
            </Link>
          </div>

          {loadingListings ? (
            <p className="mt-8 animate-pulse text-sm text-muted" role="status">
              Cargando anuncios…
            </p>
          ) : listings.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-border bg-surface px-5 py-8 text-center">
              <p className="text-sm text-muted">
                Aún no hay anuncios para mostrar aquí. Explora el mapa o publica el primero.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  to={mapHref}
                  className="inline-flex min-h-10 items-center rounded-full bg-secondary px-4 text-sm font-semibold text-primary"
                >
                  Abrir mapa
                </Link>
                <Link
                  to="/publicar"
                  className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-body"
                >
                  Publicar
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <SearchListingCard
                    listing={listing}
                    variant="sidebar"
                    to={listingCardHref(listing)}
                    onClick={() =>
                      track("search_listing_selected", {
                        listing_id: listing.id,
                        source: "list",
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-primary px-4 py-14 text-center text-primary-fg sm:px-6 sm:py-16">
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-secondary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">¿Tienes un cuarto libre en GDL?</h2>
          <p className="mt-2 text-balance text-sm leading-relaxed text-primary-fg/90 sm:text-base">
            Publica un cuarto o varios como parte de una propiedad. Claro, rápido y visible en el
            mapa de Guadalajara.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/publicar"
              onClick={() => track("home_cta_clicked", { cta: "publish" })}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-semibold text-primary shadow-md transition hover:brightness-95 active:scale-[0.99]"
            >
              Publicar anuncio
            </Link>
            <Link
              to="/faq"
              onClick={() => track("home_cta_clicked", { cta: "faq" })}
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

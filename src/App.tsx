import { useCallback, useRef, useState } from "react";
import { BrandLogo } from "./components/BrandLogo";

const CITIES = [
  "Guadalajara",
  "Mérida",
  "Puerto Vallarta",
  "Sayulita",
  "Bucerías",
];

export function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectCity = useCallback((city: string) => {
    setSearchQuery(city);
    document.getElementById("hero-busqueda")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    queueMicrotask(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogo />
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="hidden rounded-full border border-border px-3 py-1.5 text-sm font-medium text-body hover:bg-surface-elevated sm:inline-block"
            >
              Buscar
            </button>
            <button
              type="button"
              className="rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-primary shadow-sm transition hover:brightness-95 active:scale-[0.98] sm:px-4"
            >
              Publicar
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
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
              Tu depa,{" "}
              <span className="text-secondary">tus reglas</span>. Encuentra roomies
              en las ciudades donde vives o quieres estar.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-fg/90 sm:text-lg">
              Mapa con pins, filtros por ubicación, presupuesto, etiquetas, género y
              edad. Publica por propiedad y cuarto. Pronto también grupos para rentar
              casa completa.
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
                  placeholder="Ciudad, colonia o punto de interés…"
                  className="min-h-12 w-full flex-1 rounded-xl border border-white/20 bg-white/10 px-4 text-base text-primary-fg placeholder:text-primary-fg/60 backdrop-blur focus:border-accent focus:bg-white/15"
                />
                <button
                  type="button"
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
            <h2 className="text-lg font-semibold text-body sm:text-xl">
              Ciudades al inicio
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {CITIES.map((city) => {
                const active = searchQuery.trim() === city;
                return (
                  <li key={city}>
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={`Buscar en ${city}`}
                      onClick={() => selectCity(city)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-surface-elevated ${
                        active
                          ? "border-secondary bg-surface-elevated text-primary ring-2 ring-secondary/40"
                          : "border-border bg-bg-light text-body hover:border-secondary"
                      }`}
                    >
                      {city}
                    </button>
                  </li>
                );
              })}
            </ul>
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
                title: "Mapa obligatorio",
                body: "Pins en mapa para ubicar ofertas — experiencia mobile-first.",
              },
              {
                title: "Próximamente aquí",
                body: "WhatsApp OTP, Messenger para búsqueda y handoff a la web, grupos para renta completa.",
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
      </main>

      <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <BrandLogo imgClassName="h-7 w-auto max-w-[200px] object-left sm:h-8" />
            <p className="text-sm text-muted">
              © {new Date().getFullYear()} Bestie™ ·{" "}
              <a
                href="mailto:support@bestie.mx"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                support@bestie.mx
              </a>
            </p>
          </div>
          <p className="text-xs text-muted sm:text-right">bestie.mx — MVP en construcción</p>
        </div>
      </footer>
    </div>
  );
}

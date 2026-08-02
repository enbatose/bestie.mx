import { Link } from "react-router-dom";
import { usePageSeo } from "@/hooks/usePageSeo";
import { aboutPageJsonLd } from "@/lib/seo";

export function NosotrosPage() {
  usePageSeo({
    title: "Sobre Bestie MX | Roomies y cuartos compartidos en Guadalajara",
    description:
      "Bestie MX es la plataforma para encontrar roomie en Guadalajara: cuartos en renta, cuarto compartido y comparto depa con mapa, filtros y contacto directo.",
    canonicalPath: "/nosotros",
    jsonLd: [aboutPageJsonLd()],
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sobre nosotros</p>
      <h1 className="mt-2 text-2xl font-bold text-primary">Bestie MX: roomie en Guadalajara</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Bestie MX (bestie.mx) es una plataforma para encontrar roomie en Guadalajara (GDL) y publicar
        cuartos compartidos o un “comparto depa” de forma clara, con mapa y filtros.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-body">Qué resolvemos</h2>
        <p className="text-sm leading-relaxed text-muted">
          Si buscas roomie Guadalajara, roomie GDL, cuartos Guadalajara o un cuarto compartido en la
          zona metro, Bestie concentra anuncios reales en un solo lugar — sin el ruido de grupos
          genéricos.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          También cubrimos búsquedas cercanas como roomi GDL, comparto depa Guadalajara y rentas
          compartidas en GDL: misma intención, distinto wording.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-body">Cómo funciona</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-medium text-body">Busca</span> por colonia o zona en el mapa de
            Guadalajara y filtra lo que importa (presupuesto, baño, preferencias).
          </li>
          <li>
            <span className="font-medium text-body">Publica</span> un cuarto libre o varios dentro de
            una propiedad, con fotos y datos claros.
          </li>
          <li>
            <span className="font-medium text-body">Contacta</span> al anunciante desde el flujo de la
            app.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-body">Dónde estamos</h2>
        <p className="text-sm leading-relaxed text-muted">
          Hoy el lanzamiento está enfocado en Guadalajara / área metropolitana. Más ciudades de
          México están en el roadmap.
        </p>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          to="/buscar/gdl"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-fg transition hover:brightness-110"
        >
          Buscar roomie en GDL
        </Link>
        <Link
          to="/publicar"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-semibold text-body transition hover:border-primary/40"
        >
          Publicar un cuarto
        </Link>
        <Link
          to="/faq"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-semibold text-body transition hover:border-primary/40"
        >
          Preguntas frecuentes
        </Link>
      </div>
    </div>
  );
}

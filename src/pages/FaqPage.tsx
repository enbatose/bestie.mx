import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { usePageSeo } from "@/hooks/usePageSeo";
import { FAQ_ITEMS, filterFaqItems, type FaqItem } from "@/lib/faqContent";
import { faqPageJsonLd } from "@/lib/seo";

function FaqAnswer({ item }: { item: FaqItem }): ReactNode {
  if (item.id === "reportar") {
    return (
      <>
        Usa el botón <strong>Reportar</strong> en el anuncio, en una foto o en la conversación
        privada. Elige un motivo (por ejemplo estafa, fotos falsas, contenido inapropiado o acoso) y,
        si quieres, agrega un detalle. Revisaremos el reporte. También puedes escribir a{" "}
        <a
          className="font-medium text-primary underline-offset-2 hover:underline"
          href="mailto:contacto@bestie.mx"
        >
          contacto@bestie.mx
        </a>{" "}
        con el enlace. Bestie puede pausar anuncios o restringir cuentas que incumplan las reglas.
      </>
    );
  }
  if (item.id === "prevenir-estafas") {
    return (
      <>
        Antes de ver mensajes sobre un anuncio, Bestie muestra un <strong>aviso de seguridad</strong>{" "}
        que debes aceptar. No pagues depósito ni renta antes de visitar el inmueble y firmar un
        contrato. Desconfía de urgencia, precios muy bajos o “dueños” que no pueden mostrarte la
        propiedad. Verifica la identidad de tu contraparte. Si algo no cuadra, usa{" "}
        <strong>Reportar</strong>. Bestie solo facilita el contacto: no es parte del arrendamiento ni
        garantiza pagos entre usuarios. Ver también{" "}
        <Link to="/legal/terminos#rol" className="font-medium text-primary underline-offset-2 hover:underline">
          Términos · Rol de Bestie
        </Link>
        .
      </>
    );
  }
  if (item.id === "cookies") {
    return (
      <>
        Las cookies necesarias (sesión e inicio de sesión) siempre están activas. La analítica
        (PostHog) y la medición de anuncios (píxel de Meta) solo se activan si las aceptas en el
        banner de cookies. Puedes elegir “Solo necesarias”, “Aceptar todas” o personalizar, y cambiar
        tu decisión desde el enlace <strong>Cookies</strong> del pie de página. Más detalle en el{" "}
        <Link
          to="/legal/privacidad#cookies"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Aviso de Privacidad · Cookies
        </Link>
        .
      </>
    );
  }
  if (item.id === "datos") {
    return (
      <>
        Consulta cómo tratamos y protegemos tus datos en nuestro{" "}
        <Link
          to="/legal/privacidad"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Aviso de Privacidad
        </Link>
        . Puedes solicitar la eliminación de tu cuenta y datos escribiendo a{" "}
        <a
          className="font-medium text-primary underline-offset-2 hover:underline"
          href="mailto:contacto@bestie.mx"
        >
          contacto@bestie.mx
        </a>
        .
      </>
    );
  }
  if (item.id === "roomie-gdl") {
    return (
      <>
        Sí. El lanzamiento está enfocado en Guadalajara y el área metropolitana. Entra a{" "}
        <Link
          to="/buscar/gdl"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Buscar roomie en GDL
        </Link>
        , elige colonias en el mapa y filtra cuartos compartidos o rentas compartidas según lo que
        necesites.
      </>
    );
  }
  return item.answer;
}

export function FaqPage() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterFaqItems(FAQ_ITEMS, query), [query]);
  const trimmed = query.trim();

  usePageSeo({
    title: "FAQ: roomie Guadalajara, cuartos compartidos y Bestie MX",
    description:
      "Preguntas frecuentes sobre buscar roomie en Guadalajara, publicar cuartos compartidos, comparto depa GDL y cómo funciona Bestie MX.",
    canonicalPath: "/faq",
    jsonLd: [faqPageJsonLd(FAQ_ITEMS.map((i) => ({ question: i.question, answer: i.answer })))],
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Preguntas frecuentes</h1>
      <p className="mt-2 text-sm text-muted">
        Respuestas cortas sobre roomie en Guadalajara, cuartos compartidos y cómo funciona Bestie MX.
      </p>

      <div className="relative mt-6">
        <label htmlFor="faq-search" className="sr-only">
          Buscar en preguntas frecuentes
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (ej. roomie GDL, costo, mapa…)"
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-10 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {trimmed ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-bg-light hover:text-body"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {trimmed ? (
        <p className="mt-3 text-xs text-muted" role="status">
          {visible.length === 0
            ? "No hay resultados para tu búsqueda."
            : visible.length === 1
              ? "1 resultado"
              : `${visible.length} resultados`}
        </p>
      ) : null}

      <dl className="mt-8 space-y-8">
        {visible.map((item) => (
          <div key={item.id} id={item.id}>
            <dt className="text-base font-semibold text-body">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">
              <FaqAnswer item={item} />
            </dd>
          </div>
        ))}
      </dl>

      {trimmed && visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          ¿No encontraste lo que buscabas?{" "}
          <Link to="/contacto" className="font-semibold text-primary underline-offset-2 hover:underline">
            Contáctanos
          </Link>
          .
        </p>
      ) : null}

      <p className="mt-10 text-sm text-muted">
        <Link to="/nosotros" className="font-semibold text-primary underline-offset-2 hover:underline">
          Sobre Bestie MX
        </Link>
        {" · "}
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}

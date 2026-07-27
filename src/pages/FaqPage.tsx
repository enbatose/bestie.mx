import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { FAQ_ITEMS, filterFaqItems, type FaqItem } from "@/lib/faqContent";

function FaqAnswer({ item }: { item: FaqItem }): ReactNode {
  if (item.id === "reportar") {
    return (
      <>
        Escríbenos a{" "}
        <a
          className="font-medium text-primary underline-offset-2 hover:underline"
          href="mailto:contacto@bestie.mx"
        >
          contacto@bestie.mx
        </a>{" "}
        con el enlace del anuncio y una breve descripción.
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
        .
      </>
    );
  }
  return item.answer;
}

export function FaqPage() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterFaqItems(FAQ_ITEMS, query), [query]);
  const trimmed = query.trim();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Preguntas frecuentes</h1>
      <p className="mt-2 text-sm text-muted">
        Respuestas cortas sobre cómo funciona Bestie mientras el producto evoluciona.
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
          placeholder="Buscar (ej. costo, mapa, privacidad…)"
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
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}

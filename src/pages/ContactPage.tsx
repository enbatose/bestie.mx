import { Link } from "react-router-dom";

export function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Contacto</h1>
      <p className="mt-3 text-sm text-muted">
        ¿Problemas con la búsqueda, un anuncio o tu cuenta? Escríbenos y te respondemos lo antes
        posible.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-body">Correo</p>
        <a
          href="mailto:support@bestie.mx?subject=Bestie%20—%20Soporte"
          className="mt-2 inline-block text-lg font-semibold text-primary underline-offset-2 hover:underline"
        >
          support@bestie.mx
        </a>
        <p className="mt-4 text-xs text-muted">
          Asegúrate de que el dominio <strong>bestie.mx</strong> esté permitido en tu bandeja si usas
          filtros de spam.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Volver a buscar
        </Link>
      </p>
    </div>
  );
}

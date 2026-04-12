import { Link } from "react-router-dom";

export function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Preguntas frecuentes</h1>
      <p className="mt-2 text-sm text-muted">Respuestas cortas mientras el producto evoluciona.</p>

      <dl className="mt-8 space-y-8">
        <div>
          <dt className="text-base font-semibold text-body">¿Qué es Bestie?</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">
            Un marketplace para encontrar roomies y rentas compartidas en ciudades de México, con
            foco en confianza y flujos sencillos (mapa, filtros y contacto por WhatsApp).
          </dd>
        </div>
        <div>
          <dt className="text-base font-semibold text-body">¿Cobra comisión Bestie?</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">
            En esta etapa MVP el uso es gratuito para buscadores y anunciantes; cualquier cambio se
            publicará con anticipación en esta página y en avisos legales.
          </dd>
        </div>
        <div>
          <dt className="text-base font-semibold text-body">¿Cómo reporto un anuncio sospechoso?</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">
            Escríbenos a{" "}
            <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:support@bestie.mx">
              support@bestie.mx
            </a>{" "}
            con el enlace del anuncio y una breve descripción.
          </dd>
        </div>
        <div>
          <dt className="text-base font-semibold text-body">¿Mis datos están seguros?</dt>
          <dd className="mt-2 text-sm leading-relaxed text-muted">
            Publicamos prácticas mínimas en{" "}
            <Link to="/legal" className="font-medium text-primary underline-offset-2 hover:underline">
              Aviso de privacidad
            </Link>
            . El detalle legal crecerá conforme el producto madure.
          </dd>
        </div>
      </dl>

      <p className="mt-10 text-sm text-muted">
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}

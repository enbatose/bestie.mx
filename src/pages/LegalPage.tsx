import { Link } from "react-router-dom";

export function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Aviso legal y privacidad (borrador)</h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">
        Versión MVP · no constituye asesoría legal
      </p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-body">
        <h2 className="text-lg font-semibold text-primary">Términos de uso</h2>
        <p className="text-muted">
          Al usar <strong>bestie.mx</strong> aceptas utilizar el sitio de buena fe, no publicar
          contenido ilegal o engañoso, y entender que los anuncios son responsabilidad de quien los
          publica. Podemos suspender cuentas o anuncios que incumplan estas reglas o dañen la
          experiencia de la comunidad.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-body">
        <h2 className="text-lg font-semibold text-primary">Privacidad</h2>
        <p className="text-muted">
          Recopilamos datos mínimos para operar el servicio (por ejemplo, datos de anuncios y, en
          navegador, identificadores técnicos para sesión de publicador). Puedes solicitar
          correcciones o reportar problemas en{" "}
          <a className="font-medium text-primary underline-offset-2 hover:underline" href="mailto:support@bestie.mx">
            support@bestie.mx
          </a>
          .
        </p>
        <p className="text-muted">
          Los mapas pueden cargar teselas desde proveedores externos (p. ej. OpenStreetMap)
          conforme a sus políticas.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-body">
        <h2 className="text-lg font-semibold text-primary">Limitación de responsabilidad</h2>
        <p className="text-muted">
          Bestie no es parte de los arrendamientos ni verifica en campo cada anuncio en esta etapa.
          Los usuarios son responsables de validar identidad, contratos y condiciones de la renta.
        </p>
      </section>

      <p className="mt-10 text-sm text-muted">
        <Link to="/faq" className="font-semibold text-primary underline-offset-2 hover:underline">
          FAQ
        </Link>
        {" · "}
        <Link to="/contacto" className="font-semibold text-primary underline-offset-2 hover:underline">
          Contacto
        </Link>
      </p>
    </div>
  );
}

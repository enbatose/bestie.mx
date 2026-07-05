import { Link } from "react-router-dom";
import { LEGAL_LAST_UPDATED, LEGAL_OPERATOR } from "@/pages/legal/legalUi";

const cards = [
  {
    to: "/legal/terminos",
    title: "Términos y Condiciones",
    description:
      "Las reglas para usar Bestie: cuentas, publicación de anuncios, conducta, propiedad intelectual y responsabilidades.",
  },
  {
    to: "/legal/privacidad",
    title: "Aviso de Privacidad",
    description:
      "Cómo recabamos, usamos, protegemos y eliminamos tus datos personales, incluidos los de inicio de sesión con Google y Facebook.",
  },
] as const;

export function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-primary">Centro legal</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Aquí encuentras los documentos que rigen el uso de <strong>Bestie</strong>. Última
        actualización: {LEGAL_LAST_UPDATED}. Operado por {LEGAL_OPERATOR.responsible} ({" "}
        {LEGAL_OPERATOR.fiscalRegime}).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-primary group-hover:underline">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{card.description}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-primary">Leer →</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-primary">¿Quieres eliminar tus datos?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Consulta cómo solicitar la eliminación de tu cuenta y datos personales en la sección{" "}
          <Link
            to="/legal/privacidad#eliminacion-de-datos"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Eliminación de datos
          </Link>{" "}
          del Aviso de Privacidad.
        </p>
      </div>

      <p className="mt-10 text-sm text-muted">
        <Link to="/faq" className="font-semibold text-primary underline-offset-2 hover:underline">
          Preguntas frecuentes
        </Link>
        {" · "}
        <Link to="/contacto" className="font-semibold text-primary underline-offset-2 hover:underline">
          Contacto
        </Link>
      </p>
    </div>
  );
}

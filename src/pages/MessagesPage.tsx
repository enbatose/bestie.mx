import { Link } from "react-router-dom";

/**
 * Roomix exposes an in-app “Mensajes” center. Bestie v1 is explicitly no in-app chat
 * (PRODUCT_V1); this page preserves the nav affordance and routes users to supported channels.
 */
export function MessagesPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-bold text-primary">Mensajes</h1>
      <p className="mt-3 text-sm text-muted">
        En Bestie v1 no hay bandeja de chat dentro de la app (a diferencia de Roomix). Para hablar con un roomie o
        anunciante, usa el{" "}
        <span className="font-medium text-body">WhatsApp que aparece en el anuncio</span> cuando el publicador lo
        dejó visible.
      </p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-body">
        <li>
          <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
            Buscar
          </Link>{" "}
          y abre un anuncio para ver contacto.
        </li>
        <li>
          Soporte:{" "}
          <a href="mailto:support@bestie.mx" className="font-semibold text-primary underline-offset-2 hover:underline">
            support@bestie.mx
          </a>
        </li>
      </ul>
    </div>
  );
}

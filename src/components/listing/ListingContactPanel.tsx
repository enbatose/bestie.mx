import { MessageCircle } from "lucide-react";
import type { AuthMe } from "@/lib/authApi";

type Props = {
  listingStatus: string;
  messagingOn: boolean;
  listingId?: string;
  viewer: AuthMe | null | undefined;
  msgBusy: boolean;
  msgErr: string | null;
  onInAppMessage: () => void;
  showWhatsApp: boolean;
  revealed: boolean;
  onRevealWhatsApp: () => void;
  contactWhatsApp: string;
  waUrl: string;
};

export function ListingContactPanel({
  listingStatus,
  messagingOn,
  listingId,
  viewer,
  msgBusy,
  msgErr,
  onInAppMessage,
  showWhatsApp,
  revealed,
  onRevealWhatsApp,
  contactWhatsApp,
  waUrl,
}: Props) {
  const canMessage = messagingOn && listingStatus === "published" && Boolean(listingId);

  return (
    <section
      id="contacto"
      className="scroll-mt-24 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-surface p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-semibold text-body">Contactar al anunciante</h2>
      <p className="mt-1 text-sm text-muted">
        Escríbele para resolver dudas, pedir fotos adicionales o coordinar una visita.
      </p>

      {canMessage ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          {msgErr ? <p className="mb-2 text-sm text-error">{msgErr}</p> : null}
          <button
            type="button"
            onClick={onInAppMessage}
            disabled={msgBusy || viewer === undefined}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            <MessageCircle className="size-4" aria-hidden />
            {msgBusy
              ? "Abriendo…"
              : viewer === undefined
                ? "Comprobando sesión…"
                : !viewer
                  ? "Enviar mensaje (inicia sesión)"
                  : "Enviar mensaje en Bestie"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Mensaje directo dentro de Bestie. Si aún no tienes cuenta, te pediremos iniciar sesión.
          </p>
        </div>
      ) : null}

      {showWhatsApp ? (
        <div className={`${canMessage ? "mt-4" : "mt-4"} rounded-xl border border-border bg-surface p-4`}>
          {!revealed ? (
            <>
              <p className="text-sm text-muted">También puedes contactar por WhatsApp cuando estés listo.</p>
              <button
                type="button"
                onClick={onRevealWhatsApp}
                className="mt-3 inline-flex w-full justify-center rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-primary shadow-sm transition hover:brightness-95 sm:w-auto"
              >
                Ver WhatsApp
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-body">
                <span className="font-medium">WhatsApp:</span> +{contactWhatsApp}
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition hover:brightness-110 sm:w-auto"
              >
                Abrir WhatsApp
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">WhatsApp no disponible en este anuncio</p>
          <p className="mt-1 leading-relaxed">
            {canMessage
              ? "El anunciante eligió no mostrar su número. Usa el mensaje en Bestie arriba."
              : "El anunciante eligió no mostrar su número públicamente."}{" "}
            Si necesitas ayuda para conectar, escribe a{" "}
            <a href="mailto:contacto@bestie.mx" className="font-medium text-primary underline-offset-2 hover:underline">
              contacto@bestie.mx
            </a>
            .
          </p>
        </div>
      )}
    </section>
  );
}

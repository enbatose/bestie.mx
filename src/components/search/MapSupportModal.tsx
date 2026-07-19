import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ContactSupportForm } from "@/components/contact/ContactSupportForm";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Google OAuth return path that reopens this modal and resumes the draft. */
  oauthReturnTo: string;
  autoResume?: boolean;
};

export function MapSupportModal({ open, onClose, oauthReturnTo, autoResume = false }: Props) {
  const titleId = useId();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) {
      setSent(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      style={{
        paddingTop: "max(0px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-primary">
              ¿Necesitas ayuda?
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Envíanos un mensaje. Las respuestas pueden tardar hasta 48 horas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-muted hover:bg-surface-elevated"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {sent ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-lg font-semibold text-primary">Mensaje enviado</p>
              <p className="mt-2 text-sm text-muted">
                Puedes seguir la conversación en{" "}
                <Link
                  to="/mensajes"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Mensajes
                </Link>
                .
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
              >
                Seguir buscando
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm leading-relaxed text-muted">
                Cuéntanos tu comentario, pregunta o solicitud. Si no has iniciado sesión, te pediremos
                entrar para enviarlo.
              </p>
              <ContactSupportForm
                oauthReturnTo={oauthReturnTo}
                autoResume={autoResume}
                onSuccess={() => setSent(true)}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

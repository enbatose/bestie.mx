import { useEffect, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import { usePageSeo } from "@/hooks/usePageSeo";
import {
  listingPublicPath,
  parsePublishSuccessSearch,
  propertyPublicPath,
  PUBLISH_SUCCESS_PATH,
} from "@/lib/listingReference";
import {
  buildMyListingsRestorePath,
  readMyListingsReturn,
} from "@/lib/myListingsReturn";
import { ShareAiCopyPanel } from "@/components/share/ShareAiCopyPanel";

function readPublishedTitle(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const t = (state as { publishedTitle?: unknown }).publishedTitle;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

/** Confirmation after first-time publish. Reload-safe; does not reopen the wizard editor. */
export function PublishSuccessPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { openFeedback } = useFeedbackModal();
  const parsed = useMemo(() => parsePublishSuccessSearch(searchParams), [searchParams]);
  const myListingsReturn = useMemo(
    () => readMyListingsReturn(location.state),
    [location.state],
  );
  const myListingsRestorePath = myListingsReturn
    ? buildMyListingsRestorePath(myListingsReturn)
    : "/mis-anuncios";
  const publishedTitle = readPublishedTitle(location.state) || "Anuncio publicado";

  usePageSeo({
    title: "Anuncio publicado | Bestie MX",
    description:
      "Tu anuncio ya está visible. Copia el mensaje sugerido y compártelo en WhatsApp, Facebook o Instagram.",
    canonicalPath: PUBLISH_SUCCESS_PATH,
    noindex: true,
  });

  useEffect(() => {
    if (!parsed) return;
    const timer = window.setTimeout(() => {
      openFeedback({
        source: "publish",
        publishedRoomId: parsed.roomId ?? parsed.propertyId ?? undefined,
        publishedTitle,
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [parsed, openFeedback, publishedTitle]);

  if (!parsed) {
    return <Navigate to="/mis-anuncios" replace />;
  }

  const successTitle =
    parsed.scope === "property"
      ? "Listo. Tu propiedad ya está publicada"
      : "Listo. Tu recámara ya está publicada";
  const listingPath =
    parsed.scope === "property" && parsed.propertyId
      ? propertyPublicPath(parsed.propertyId)
      : parsed.roomId
        ? listingPublicPath(parsed.roomId)
        : "/mis-anuncios";

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-4 text-center sm:px-6 sm:pb-12 sm:pt-5">
      <div
        className="mx-auto inline-flex rounded-full bg-secondary/15 p-4 text-primary dark:bg-secondary/20"
        aria-hidden
      >
        <CheckCircle2 className="size-10" strokeWidth={2} />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-body">{successTitle}</h1>
      <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted">
        Tu anuncio ya está visible para la comunidad. Comparte el mensaje optimizado para llegar más
        rápido a roomies en WhatsApp, Facebook e Instagram.
      </p>

      <div className="mx-auto mt-6 max-w-md text-left">
        <ShareAiCopyPanel
          scope={parsed.scope}
          propertyId={parsed.scope === "property" ? parsed.propertyId : null}
          roomId={parsed.scope === "room" ? parsed.roomId : null}
        />
      </div>

      <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-bg-light p-4 text-left">
        <ul className="space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <strong className="font-semibold text-body">Recibe mensajes:</strong> Atiende a los
            interesados directamente desde tu bandeja de entrada.
          </li>
          <li>
            <strong className="font-semibold text-body">Control total:</strong> Modifica precios,
            fotos o pausa el anuncio desde Mis anuncios.
          </li>
        </ul>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          to={listingPath}
          state={myListingsReturn ? { myListingsReturn } : undefined}
          className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-fg shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Ver mi anuncio
        </Link>
        <Link
          to={myListingsRestorePath}
          className="text-sm font-medium text-muted transition hover:text-body"
        >
          Ir a Mis anuncios
        </Link>
      </div>
    </div>
  );
}

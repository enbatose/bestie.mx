import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { authMe, type AuthMe } from "@/lib/authApi";
import {
  buildFeedbackMessageBody,
  feedbackSubjectForSource,
  type FeedbackViewedListing,
} from "@/lib/feedbackSession";
import { startFeedbackConversation, type FeedbackSource } from "@/lib/messagesApi";

const SENT_AUTO_CLOSE_MS = 2_000;
const COMMENT_MAX = 2000;

type Props = {
  open: boolean;
  onClose: () => void;
  source: FeedbackSource;
  publishedRoomId?: string;
  publishedTitle?: string;
  viewedListings?: FeedbackViewedListing[];
};

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="radiogroup"
      aria-label="Calificación de 1 a 5 estrellas"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 5`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className="rounded-full p-1 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 disabled:opacity-50"
          >
            <Star
              className={`size-9 sm:size-10 ${
                filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-border"
              }`}
              strokeWidth={1.6}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

export function FeedbackModal({
  open,
  onClose,
  source,
  publishedRoomId,
  publishedTitle,
  viewedListings,
}: Props) {
  const titleId = useId();
  const { openLogin } = useAuthModal();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRating(0);
      setComment("");
      setSending(false);
      setSent(false);
      setErr(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const refresh = () => {
      void authMe()
        .then(setMe)
        .catch(() => setMe(null));
    };
    refresh();
    window.addEventListener("bestie:me-changed", refresh);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("bestie:me-changed", refresh);
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

  useEffect(() => {
    if (!open || !sent) return;
    const timer = window.setTimeout(() => onClose(), SENT_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, sent, onClose]);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      setErr("Elige una calificación de 1 a 5 estrellas.");
      return;
    }
    if (!me?.id) {
      openLogin();
      setErr("Inicia sesión para enviar tu feedback.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const body = buildFeedbackMessageBody({
        rating,
        comment,
        source,
        publishedRoomId,
        publishedTitle,
        viewedListings,
      });
      await startFeedbackConversation({
        rating,
        body,
        subject: feedbackSubjectForSource(source),
        source,
        listingRoomId: publishedRoomId,
        comment: comment.trim(),
      });
      setSent(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo enviar tu feedback. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2090] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
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
        className="flex max-h-[min(92dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-amber-500/25 bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-body">
              ¿Qué te parece Bestie?
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Tu opinión nos ayuda a mejorar. Las respuestas pueden tardar hasta 48 horas.
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
            <p
              className="py-10 text-center text-base font-semibold leading-snug text-body"
              role="status"
            >
              ¡Gracias por tu feedback!
              <span className="mt-2 block text-sm font-normal text-muted">
                Lo recibimos. Si hace falta, te responderemos en Mensajes.
              </span>
            </p>
          ) : (
            <div className="space-y-5">
              <StarPicker value={rating} onChange={setRating} disabled={sending} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Comentario <span className="font-normal normal-case">(opcional)</span>
                </span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                  rows={4}
                  disabled={sending}
                  placeholder="Cuéntanos qué funcionó bien o qué mejorarías…"
                  className="min-h-[6rem] w-full resize-y rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-60"
                />
              </label>
              {err ? (
                <p className="text-sm text-error" role="alert">
                  {err}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={sending || rating < 1}
                className="w-full rounded-full bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Enviando…" : "Enviar feedback"}
              </button>
              {me === null ? (
                <p className="text-center text-xs text-muted">
                  Necesitas{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary underline"
                    onClick={() => openLogin()}
                  >
                    iniciar sesión
                  </button>{" "}
                  para enviar.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

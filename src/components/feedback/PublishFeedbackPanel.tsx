import { useEffect, useId, useState } from "react";
import { MessageCircleHeart, Star } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { authMe, type AuthMe } from "@/lib/authApi";
import {
  buildFeedbackMessageBody,
  feedbackSubjectForSource,
} from "@/lib/feedbackSession";
import { startFeedbackConversation } from "@/lib/messagesApi";

const COMMENT_MAX = 2000;

type Props = {
  publishedRoomId: string;
  publishedTitle?: string;
  className?: string;
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
            className="rounded-full p-1 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:opacity-50"
          >
            <Star
              className={`size-8 sm:size-9 ${
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

export function PublishFeedbackPanel({
  publishedRoomId,
  publishedTitle,
  className = "",
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
    const refresh = () => {
      void authMe()
        .then(setMe)
        .catch(() => setMe(null));
    };
    refresh();
    window.addEventListener("bestie:me-changed", refresh);
    return () => window.removeEventListener("bestie:me-changed", refresh);
  }, []);

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
        source: "publish",
        publishedRoomId,
        publishedTitle,
      });
      await startFeedbackConversation({
        rating,
        body,
        subject: feedbackSubjectForSource("publish"),
        source: "publish",
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

  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-amber-500/5 text-left p-4 sm:p-5 ${className}`}
      aria-labelledby={titleId}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex rounded-full bg-amber-500/15 p-1.5 text-amber-700"
          aria-hidden
        >
          <MessageCircleHeart className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold text-body">
            ¿Qué te parece Bestie?
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted">
            Tu opinión nos ayuda a mejorar. Las respuestas pueden tardar hasta 48 horas.
          </p>
        </div>
      </div>

      {sent ? (
        <p className="mt-4 text-center text-sm font-semibold text-amber-800" role="status">
          ¡Gracias!
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <StarPicker value={rating} onChange={setRating} disabled={sending} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Comentario <span className="font-normal normal-case">(opcional)</span>
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              rows={3}
              disabled={sending}
              placeholder="Cuéntanos qué funcionó bien o qué mejorarías…"
              className="min-h-[5rem] w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-60"
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
  );
}

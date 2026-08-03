import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2, Sparkles } from "lucide-react";
import {
  generateShareAiCopy,
  saveShareAiCopy,
  type ShareAiCopyResult,
  type ShareAiScope,
} from "@/lib/shareAiCopyApi";
import { toWhatsAppSafeShareText } from "@/lib/shareAiWhatsAppText";
import { track } from "@/lib/analytics";

type Props = {
  scope: ShareAiScope;
  propertyId?: string | null;
  roomId?: string | null;
  /** Compact layout for sheets / cards. */
  compact?: boolean;
  className?: string;
};

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v8h4v-8h3.1l.9-4H13V9c0-.6.4-1 1-1z" />
    </svg>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.5 0-9.96 4.45-9.96 9.93 0 1.75.46 3.45 1.33 4.95L2 22l5.28-1.38a9.95 9.95 0 0 0 4.76 1.21h.01c5.5 0 9.96-4.46 9.96-9.94C22 6.45 17.54 2 12.04 2zm5.8 14.2c-.24.68-1.4 1.25-1.93 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.79-4.18-4.93-4.37-.14-.2-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.38.26-.28.57-.35.76-.35h.55c.17 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.2-.14.31-.28.48-.14.17-.3.37-.42.5-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.93 1.94 1.22 2.21 1.36.28.14.44.12.6-.07.17-.2.7-.81.88-1.09.19-.28.37-.23.62-.14.26.1 1.63.77 1.91.91.28.14.47.21.54.32.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.2A4.8 4.8 0 1 0 16.8 12 4.81 4.81 0 0 0 12 7.2zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1zM17.65 6.2a1.15 1.15 0 1 0 1.15 1.15 1.15 1.15 0 0 0-1.15-1.15z" />
    </svg>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareAiCopyPanel({
  scope,
  propertyId = null,
  roomId = null,
  compact = false,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ShareAiCopyResult | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await generateShareAiCopy({ scope, propertyId, roomId });
        if (cancelled) return;
        setPayload(result);
        setText(result.text);
        lastSaved.current = result.text;
        track("listing_share_ai_ready", {
          scope,
          source: result.source,
          listing_id: roomId ?? propertyId ?? "",
        });
      } catch {
        if (!cancelled) setError("No se pudo preparar el texto. Intenta de nuevo en un momento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [scope, propertyId, roomId]);

  function scheduleSave(next: string) {
    setText(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (next === lastSaved.current || !next.trim()) return;
      void saveShareAiCopy({ scope, propertyId, roomId, text: next })
        .then((r) => {
          lastSaved.current = r.text;
          setPayload(r);
        })
        .catch(() => {
          /* silent — user still has local text */
        });
    }, 600);
  }

  async function onCopy() {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      track("listing_share_ai_copied", {
        scope,
        listing_id: roomId ?? propertyId ?? "",
      });
      if (text !== lastSaved.current) {
        void saveShareAiCopy({ scope, propertyId, roomId, text }).then((r) => {
          lastSaved.current = r.text;
        });
      }
    }
  }

  async function openExternal(kind: "facebook" | "whatsapp" | "instagram") {
    const permalink = payload?.permalink ?? "";
    track("listing_share_ai_channel", {
      scope,
      channel: kind,
      listing_id: roomId ?? propertyId ?? "",
    });
    if (kind === "whatsapp") {
      // Clipboard keeps colorful emojis; URL prefill uses BMP-safe remap (no extra LLM).
      void copyText(text).then((ok) => {
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }
      });
      const waText = toWhatsAppSafeShareText(text);
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (kind === "facebook") {
      const u = permalink || text;
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  async function onSystemShare() {
    track("listing_share_ai_channel", {
      scope,
      channel: "system",
      listing_id: roomId ?? propertyId ?? "",
    });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "Bestie",
          text,
          url: payload?.permalink,
        });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    await onCopy();
  }

  return (
    <div
      className={`rounded-2xl border border-secondary/30 bg-secondary/5 text-left ${
        compact ? "p-3" : "p-4 sm:p-5"
      } ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex rounded-full bg-secondary/20 p-1.5 text-primary" aria-hidden>
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`font-bold text-body ${compact ? "text-sm" : "text-base"}`}>
            Comparte tu anuncio optimizado con IA
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted">
            Texto listo para pegar. En WhatsApp puede ir prellenado; en Facebook e Instagram copia primero
            y pega al publicar.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 animate-pulse text-sm text-muted" role="status">
          Preparando tu mensaje…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-warning-fg" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Paso 1 · Revisa y copia
              </p>
              <button
                type="button"
                onClick={() => void onCopy()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-body transition hover:bg-surface-elevated"
              >
                {copied ? <Check className="size-3.5 text-secondary" /> : <Copy className="size-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => scheduleSave(e.target.value)}
              rows={compact ? 8 : 10}
              maxLength={700}
              className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-body shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              aria-label="Mensaje para compartir"
            />
            <p className="mt-1 text-right text-[11px] text-muted">{text.length}/700</p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Paso 2 · Comparte
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => openExternal("facebook")}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1877F2] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <FacebookGlyph className="size-3.5" />
                Facebook
              </button>
              <button
                type="button"
                onClick={() => openExternal("instagram")}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <InstagramGlyph className="size-3.5" />
                Instagram
              </button>
              <button
                type="button"
                onClick={() => openExternal("whatsapp")}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <WhatsAppGlyph className="size-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void onSystemShare()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-body transition hover:bg-surface-elevated"
              >
                <Share2 className="size-3.5" />
                Más
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Tip: en Facebook e Instagram, pega el texto del Paso 1 (emojis a color). WhatsApp lleva
              una versión compatible prellenada y también copiamos el texto completo.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

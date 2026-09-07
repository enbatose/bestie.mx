import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { generateOutreachInvitation } from "@/lib/outreachInvitationApi";

function invitationErrorMessage(code: string): string {
  if (code === "rate_limited") return "Demasiadas generaciones. Espera un momento e intenta de nuevo.";
  if (code === "unauthorized" || code === "forbidden") return "Necesitas sesión de administrador.";
  return "No se pudo generar el comentario. Intenta de nuevo.";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AdminOutreachInvitationPanel() {
  const [publisherName, setPublisherName] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState<"gemini" | "template" | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runGenerate(opts?: { regenerate?: boolean }) {
    setLoading(true);
    setErr(null);
    setCopied(false);
    try {
      const result = await generateOutreachInvitation({
        publisherName: publisherName.trim() || undefined,
        previousText: opts?.regenerate && text.trim() ? text : undefined,
      });
      setText(result.text);
      setSource(result.source);
    } catch (e) {
      setErr(invitationErrorMessage(e instanceof Error ? e.message : "error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runGenerate();
    // Auto-load one comment on first open; regenerate / name are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  async function onCopy() {
    if (!text.trim()) return;
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-body">Invitación</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Comentario listo para pegar bajo un post de Facebook de alguien que ya ofrece un cuarto.
          Cada generación parafrasea el mensaje (IA) para reducir detección de spam. Incluye{" "}
          <span className="font-mono text-xs">https://bestie.mx/gdl</span> (tarjeta OG) y cierra con{" "}
          <span className="font-medium text-body">Atte. Equipo Bestie MX.</span> para que puedas
          vincularlo a la presencia de Bestie en Facebook.
        </p>
      </div>

      <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <label htmlFor="outreach-invitation-name" className="block text-sm font-medium text-body">
          Nombre del publicador{" "}
          <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id="outreach-invitation-name"
          type="text"
          size={10}
          value={publisherName}
          onChange={(e) => setPublisherName(e.target.value)}
          placeholder="Ej. Ana"
          autoComplete="off"
          className="mt-2 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2.5 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p className="mt-1.5 text-xs text-muted">
          Si lo dejas vacío, el saludo es genérico. No hace falta pegar el post: el comentario es
          genérico a propósito.
        </p>

        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runGenerate({ regenerate: Boolean(text.trim()) })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : text.trim() ? (
              <RefreshCw className="size-4" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {loading ? "Generando…" : text.trim() ? "Regenerar" : "Generar"}
          </button>
          <button
            type="button"
            disabled={!text.trim() || loading}
            onClick={() => void onCopy()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-60"
          >
            {copied ? <Check className="size-4 text-primary" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        {err ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {err}
          </p>
        ) : null}

        <label htmlFor="outreach-invitation-text" className="mt-5 block text-sm font-medium text-body">
          Comentario
        </label>
        <textarea
          id="outreach-invitation-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck
          className="mt-2 w-full min-w-0 resize-y rounded-xl border border-border bg-bg-light px-3 py-3 text-sm leading-relaxed text-body placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          placeholder="El comentario aparecerá aquí…"
        />
        <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {source === "gemini"
              ? "Generado con IA (Gemini)"
              : source === "template"
                ? "Plantilla de respaldo (sin IA o fallo de IA)"
                : "\u00a0"}
          </span>
          <span>{text.trim() ? `${text.length} caracteres` : ""}</span>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
        <li>Beneficios: gratis publicar / buscar cuarto / mensajear; promoción en grupos; menos republicar.</li>
        <li>
          Un solo enlace: <span className="font-mono">https://bestie.mx/gdl</span> (no escribas bestie.mx en
          prosa o Facebook crea un segundo link).
        </li>
        <li>Firma fija al final para etiquetar al Equipo Bestie MX en el comentario.</li>
      </ul>
    </div>
  );
}

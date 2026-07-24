import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";

type Props = {
  code: string;
  label?: string;
  title?: string;
  /** `compact` drops the mobile min-h-11 for dense desktop tables. `quiet` is a discrete under-photo id. */
  size?: "default" | "compact" | "quiet";
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function ListingReferenceChip({ code, label = "Ref.", title, size = "default" }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const sizeClass =
    size === "quiet"
      ? "min-h-0 max-w-full gap-0.5 rounded px-0.5 py-0.5 font-mono text-[9px] font-medium text-muted hover:text-body"
      : size === "compact"
        ? "min-h-8 gap-1 rounded-full border border-border bg-bg-light px-2 py-0.5 font-mono text-[11px] font-semibold text-muted hover:border-primary/30 hover:text-body"
        : "min-h-11 gap-1 rounded-full border border-border bg-bg-light px-2.5 py-1 font-mono text-[11px] font-semibold text-muted hover:border-primary/30 hover:text-body";

  const iconClass = size === "quiet" ? "size-2.5 opacity-50" : "size-3 opacity-60";
  const labelClass =
    size === "quiet"
      ? "shrink-0 text-[9px] font-medium text-muted/70"
      : "shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted/80";

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title={title ?? `Copiar referencia ${code}`}
      aria-label={copied ? `Referencia ${code} copiada` : `Copiar referencia ${code}`}
      className={`inline-flex max-w-full items-center transition ${sizeClass}`}
    >
      <span className={labelClass}>{label}</span>
      <span className={`truncate ${size === "quiet" ? "text-muted" : "text-body"}`}>{code}</span>
      {copied ? (
        <Check className={`${iconClass} text-primary`} aria-hidden />
      ) : (
        <Copy className={iconClass} aria-hidden />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Referencia copiada." : ""}
      </span>
    </button>
  );
}

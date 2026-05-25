import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";

type Props = {
  code: string;
  label?: string;
  title?: string;
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

export function ListingReferenceChip({ code, label = "Ref.", title }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title={title ?? `Copiar referencia ${code}`}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-light px-2 py-0.5 font-mono text-[11px] font-semibold text-muted transition hover:border-primary/30 hover:text-body"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted/80">{label}</span>
      <span className="text-body">{code}</span>
      {copied ? (
        <Check className="size-3 text-primary" aria-hidden />
      ) : (
        <Copy className="size-3 opacity-60" aria-hidden />
      )}
      <span className="sr-only">{copied ? "Copiado" : "Copiar referencia"}</span>
    </button>
  );
}

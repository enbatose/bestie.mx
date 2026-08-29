import { useState } from "react";

type Props = {
  busy: boolean;
  onPublish: (file: File, note?: string) => void | Promise<void>;
  /** Primary button label. */
  submitLabel?: string;
};

/**
 * Consent screenshot + optional note for publishing unclaimed admin-outreach drafts.
 * Evidence is stored privately — never as listing photos.
 */
export function AdminConsentEvidenceForm({
  busy,
  onPublish,
  submitLabel = "Publicar sin dueño",
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs leading-snug text-body">
        Publicar sin dueño: adjunta una captura de consentimiento (no las fotos del anuncio). La
        evidencia no se muestra al público.
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full min-w-0 text-xs text-body file:mr-2 file:rounded-full file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Nota opcional"
        disabled={busy}
        size={10}
        className="w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-body outline-none ring-accent focus:ring-2"
      />
      <button
        type="button"
        disabled={busy || !file}
        onClick={() => {
          if (file) void onPublish(file, note);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50 sm:w-auto"
      >
        {busy ? "…" : submitLabel}
      </button>
    </div>
  );
}

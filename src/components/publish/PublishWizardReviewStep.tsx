import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import type { Draft } from "@/pages/PublishWizardPage";

type Props = {
  draft: Draft;
  roomIndex: number;
  onRoomIndexChange: (index: number) => void;
  onDraftChange: (updater: (d: Draft) => Draft) => void;
  apiOn: boolean;
  publishBlockedReason: string | null;
  actionErr: string | null;
  submitInFlight: "publish" | "draft" | null;
  onSaveDraft: () => void;
  onPublish: () => void;
};

export function PublishWizardReviewStep({
  draft,
  roomIndex,
  onRoomIndexChange,
  onDraftChange,
  apiOn,
  publishBlockedReason,
  actionErr,
  submitInFlight,
  onSaveDraft,
  onPublish,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm">
        <h3 className="text-[15px] font-bold text-primary">Revisión final</h3>
        <p className="mt-2 text-sm text-muted">
          Así se verá tu anuncio publicado. Toca <strong className="font-medium text-body">Editar</strong> en cada
          bloque para ajustar el contenido aquí mismo, sin salir de este paso.
        </p>
      </div>

      {draft.rooms.length > 1 ? (
        <label className="block text-sm font-medium text-body">
          Recámara en vista previa
          <select
            value={roomIndex}
            onChange={(e) => onRoomIndexChange(Number(e.target.value))}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {draft.rooms.map((r, i) => (
              <option key={i} value={i}>
                Recámara {i + 1}: {r.title.trim() || "Sin título"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <EditableListingPreview
        draft={draft}
        roomIndex={roomIndex}
        apiOn={apiOn}
        onDraftChange={onDraftChange}
      />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            checked={draft.legalAccepted}
            onChange={(e) => onDraftChange((d) => ({ ...d, legalAccepted: e.target.checked }))}
            className="mt-1 size-4 rounded border-border text-primary"
          />
          <span>
            Confirmo que la información es verídica y acepto las responsabilidades legales al publicar en Bestie (v1).
          </span>
        </label>
        {publishBlockedReason ? (
          <p className="mt-3 text-xs text-muted" role="status">
            Para publicar: {publishBlockedReason}
          </p>
        ) : null}
        {actionErr ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {actionErr}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={onSaveDraft}
              className="rounded-full border border-secondary/50 bg-secondary/10 px-5 py-2 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/20 disabled:opacity-50"
            >
              {submitInFlight === "draft" ? "Guardando…" : "Guardar como borrador"}
            </button>
          ) : null}
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null || Boolean(publishBlockedReason)}
              title={publishBlockedReason ?? undefined}
              onClick={onPublish}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {submitInFlight === "publish" ? "Publicando…" : "Publicar anuncio"}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: configura <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code> para publicar.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

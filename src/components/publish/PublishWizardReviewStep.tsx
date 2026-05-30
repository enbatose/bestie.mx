import { Link } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { PublishReviewDisclaimer } from "@/components/publish/PublishReviewDisclaimer";
import type { Draft } from "@/pages/PublishWizardPage";
import type { ListingStatus } from "@/types/listing";

type LiveEditContext = {
  status: Extract<ListingStatus, "published" | "paused">;
  returnListingId?: string | null;
};

type Props = {
  draft: Draft;
  roomIndex: number;
  onRoomIndexChange: (index: number) => void;
  onDraftChange: (updater: (d: Draft) => Draft) => void;
  apiOn: boolean;
  profilePhoneE164?: string | null;
  publishBlockedReason: string | null;
  actionErr: string | null;
  submitInFlight: "publish" | "draft" | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** Owner editing an already-published or paused listing (not the first-time wizard). */
  liveEdit?: LiveEditContext | null;
};

export function PublishWizardReviewStep({
  draft,
  roomIndex,
  onRoomIndexChange,
  onDraftChange,
  apiOn,
  profilePhoneE164,
  publishBlockedReason,
  actionErr,
  submitInFlight,
  onSaveDraft,
  onPublish,
  liveEdit = null,
}: Props) {
  const isLiveEdit = liveEdit != null;
  const returnListingId = liveEdit?.returnListingId ?? null;
  const primaryLabel =
    submitInFlight === "publish"
      ? "Guardando…"
      : isLiveEdit && liveEdit.status === "published"
        ? "Guardar cambios"
        : isLiveEdit && liveEdit.status === "paused"
          ? "Guardar y republicar"
          : "Publicar anuncio";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm">
        <h3 className="text-[15px] font-bold text-primary">
          {isLiveEdit ? "Editar anuncio" : "Revisión final"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {isLiveEdit ? (
            <>
              Tu anuncio se ve como en la página publicada. Toca{" "}
              <strong className="font-medium text-body">Editar</strong> en cada bloque para cambiar fotos, precio,
              descripción y más.
            </>
          ) : (
            <>
              Así se verá tu anuncio publicado. Toca <strong className="font-medium text-body">Editar</strong> en cada
              bloque para ajustar el contenido aquí mismo, sin salir de este paso.
            </>
          )}
        </p>
        {isLiveEdit && returnListingId ? (
          <Link
            to={listingPublicPath(returnListingId)}
            className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Volver al anuncio publicado
          </Link>
        ) : null}
      </div>

      {draft.rooms.length > 1 ? (
        <label className="block text-sm font-medium text-body">
          {isLiveEdit ? "Recámara que estás editando" : "Recámara en vista previa"}
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
        variant={isLiveEdit ? "live-edit" : "preview"}
        profilePhoneE164={profilePhoneE164}
        onDraftChange={onDraftChange}
      />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {publishBlockedReason ? (
          <p className="text-xs text-muted" role="status">
            {isLiveEdit ? "Para guardar:" : "Para publicar:"} {publishBlockedReason}
          </p>
        ) : null}
        {actionErr ? (
          <p className={`text-sm text-red-600 ${publishBlockedReason ? "mt-3" : ""}`} role="alert">
            {actionErr}
          </p>
        ) : null}

        <div
          className={`flex flex-wrap items-center gap-2 ${publishBlockedReason || actionErr ? "mt-5" : ""}`}
        >
          {apiOn && !isLiveEdit ? (
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
              {primaryLabel}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: configura <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code> para publicar.
            </span>
          )}
          {isLiveEdit && returnListingId ? (
            <Link
              to={listingPublicPath(returnListingId)}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
            >
              Cancelar
            </Link>
          ) : null}
        </div>

        {!isLiveEdit ? <PublishReviewDisclaimer /> : null}
      </section>
    </div>
  );
}

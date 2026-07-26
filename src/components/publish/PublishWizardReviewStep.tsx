import { Link } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { PublishReviewDisclaimer } from "@/components/publish/PublishReviewDisclaimer";
import type { Draft } from "@/pages/PublishWizardPage";
import type { ListingStatus } from "@/types/listing";

export type LiveEditScope = "property" | "room";

type LiveEditContext = {
  status: Extract<ListingStatus, "published" | "paused">;
  returnListingId?: string | null;
  /** When set, Cancelar returns to Mis Anuncios instead of the public listing. */
  myListingsRestorePath?: string | null;
  /** Pass through so the public listing can still offer Volver a Mis anuncios. */
  myListingsReturnState?: unknown;
  /** Property-card vs room-row entry from Mis Anuncios. */
  scope?: LiveEditScope;
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
  const editScope = liveEdit?.scope ?? null;
  const returnListingId = liveEdit?.returnListingId ?? null;
  const myListingsRestorePath = liveEdit?.myListingsRestorePath ?? null;
  const myListingsReturnState = liveEdit?.myListingsReturnState;
  const cancelTo = myListingsRestorePath
    ? myListingsRestorePath
    : returnListingId
      ? listingPublicPath(returnListingId)
      : null;
  const cancelLabel = myListingsRestorePath ? "Volver a Mis anuncios" : "Cancelar";
  const primaryLabel =
    submitInFlight === "publish"
      ? "Guardando…"
      : isLiveEdit && liveEdit.status === "published"
        ? "Guardar cambios"
        : isLiveEdit && liveEdit.status === "paused"
          ? "Guardar y republicar"
          : "Publicar anuncio";

  const heading =
    editScope === "property"
      ? "Editar propiedad"
      : editScope === "room"
        ? "Editar recámara"
        : isLiveEdit
          ? "Editar anuncio"
          : "Revisión final";

  const intro =
    editScope === "property" ? (
      <>
        Edita los datos de la <strong className="font-medium text-body">propiedad</strong> (título, fotos
        compartidas, amenidades, ubicación). Para cambiar una recámara, vuelve a Mis anuncios y usa Editar en esa
        recámara.
      </>
    ) : editScope === "room" ? (
      <>
        Estás editando esta <strong className="font-medium text-body">recámara</strong>. Toca{" "}
        <strong className="font-medium text-body">Editar</strong> en cada bloque para cambiar fotos, precio,
        descripción y más.
      </>
    ) : isLiveEdit ? (
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
    );

  const showRoomPicker = draft.rooms.length > 1 && editScope !== "property";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-light p-4 px-5 shadow-sm">
        <h3 className="text-[15px] font-bold text-primary">{heading}</h3>
        <p className="mt-2 text-sm text-muted">{intro}</p>
        {isLiveEdit && returnListingId ? (
          <Link
            to={listingPublicPath(returnListingId)}
            state={myListingsReturnState}
            className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Volver al anuncio publicado
          </Link>
        ) : null}
      </div>

      {showRoomPicker ? (
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
        editScope={editScope}
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
          <p className={`text-sm text-error ${publishBlockedReason ? "mt-3" : ""}`} role="alert">
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
          {isLiveEdit && cancelTo ? (
            <Link
              to={cancelTo}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated"
            >
              {cancelLabel}
            </Link>
          ) : null}
        </div>

        {!isLiveEdit ? <PublishReviewDisclaimer /> : null}
      </section>
    </div>
  );
}

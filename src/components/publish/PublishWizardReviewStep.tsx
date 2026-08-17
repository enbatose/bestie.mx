import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";
import { isListingRentMissing } from "@/lib/listingTags";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import {
  firstRoomIndexWithIssues,
  isStandaloneRoomPost,
  roomPreviewOptionLabel,
  roomSaveIssuesPrimaryLabel,
} from "@/lib/publishWizard/roomWizardValidation";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
import { PublishReviewDisclaimer } from "@/components/publish/PublishReviewDisclaimer";
import { RoomSaveIssuesCallout } from "@/components/publish/RoomSaveIssuesCallout";
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
  /** Apply a draft updater synchronously then publish (live-edit room modal). */
  onCommitAndPublish?: (updater: (d: Draft) => Draft) => void;
  apiOn: boolean;
  profilePhoneE164?: string | null;
  publishBlockedReason: string | null;
  actionErr: string | null;
  submitInFlight: "publish" | "draft" | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** Shown after a successful explicit “Guardar como borrador”. */
  draftSaved?: boolean;
  /** Owner editing an already-published or paused listing (not the first-time wizard). */
  liveEdit?: LiveEditContext | null;
  initialEditingPhotos?: boolean;
  onEditingPhotosChange?: (editing: boolean) => void;
  onPhotoPickerOpen?: () => void;
  isAssistedDraft?: boolean;
  /** Self-serve AI flow (not an admin outreach claim link). */
  isSelfServeAssistedDraft?: boolean;
  fieldConflicts?: Array<{ field: string; message: string }>;
};

export function PublishWizardReviewStep({
  draft,
  roomIndex,
  onRoomIndexChange,
  onDraftChange,
  onCommitAndPublish,
  apiOn,
  profilePhoneE164,
  publishBlockedReason,
  actionErr,
  submitInFlight,
  onSaveDraft,
  onPublish,
  draftSaved = false,
  liveEdit = null,
  initialEditingPhotos = false,
  onEditingPhotosChange,
  onPhotoPickerOpen,
  isAssistedDraft = false,
  isSelfServeAssistedDraft = false,
  fieldConflicts = [],
}: Props) {
  const navigate = useNavigate();
  const [jumpToRoomIndex, setJumpToRoomIndex] = useState<number | null>(null);
  const [publishAfterRoomFix, setPublishAfterRoomFix] = useState(false);
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

  const safeRoomIndex = Math.min(roomIndex, Math.max(0, draft.rooms.length - 1));
  const activeRoom = draft.rooms[safeRoomIndex];
  /** Numbered recámara chrome is for a room inside a property post, not a single-room listing. */
  const isRoomOfProperty = editScope === "room" && draft.postMode === "property";
  const isPropertyPreview = draft.postMode === "property" && editScope !== "room";
  const rentMissing = isPropertyPreview
    ? draft.rooms.some((r) => isRoomAvailableForRent(r) && isListingRentMissing(r.rentMxn))
    : isListingRentMissing(activeRoom?.rentMxn);
  const rentOnlyBlock =
    rentMissing &&
    Boolean(publishBlockedReason) &&
    /Renta \(MXN/.test(publishBlockedReason ?? "") &&
    !publishBlockedReason?.includes(";");
  const firstIncompleteRoom = firstRoomIndexWithIssues(draft);
  const hasRoomFieldIssues = firstIncompleteRoom >= 0;
  const nonRoomBlock = Boolean(publishBlockedReason) && !hasRoomFieldIssues;

  const openIncompleteRoom = (index: number, thenPublish: boolean) => {
    setPublishAfterRoomFix(isStandaloneRoomPost(draft) ? false : thenPublish);
    setJumpToRoomIndex(index);
  };

  const attemptPublish = () => {
    if (hasRoomFieldIssues) {
      openIncompleteRoom(firstIncompleteRoom, true);
      return;
    }
    if (publishBlockedReason) return;
    onPublish();
  };

  const heading =
    editScope === "property"
      ? "Editar propiedad"
      : isRoomOfProperty
        ? "Editar recámara"
        : isLiveEdit
          ? "Editar anuncio"
          : "Revisión final";

  const intro =
    editScope === "property" || (isPropertyPreview && isLiveEdit) ? (
      <>
        Edita los datos de la <strong className="font-medium text-body">propiedad</strong> y abre cada recámara
        para cambiar fotos, precio y detalles.
      </>
    ) : isRoomOfProperty ? (
      <>
        Solo estás cambiando esta recámara. Toca{" "}
        <strong className="font-medium text-body">Editar</strong> en cada bloque para fotos, precio, descripción y
        más.
      </>
    ) : isLiveEdit ? (
      <>
        Tu anuncio se ve como en la página publicada. Toca{" "}
        <strong className="font-medium text-body">Editar</strong> en cada bloque para cambiar fotos, precio,
        descripción y más.
      </>
    ) : isPropertyPreview ? (
      <>
        Así se verá tu propiedad publicada. Toca <strong className="font-medium text-body">Editar</strong> en cada
        sección. Usa <strong className="font-medium text-body">Editar esta recámara</strong> para ajustar cada cuarto.
      </>
    ) : (
      <>
        Así se verá tu anuncio publicado. Toca <strong className="font-medium text-body">Editar</strong> en cada
        bloque para ajustar el contenido aquí mismo, sin salir de este paso.
      </>
    );

  const showRoomPicker = draft.postMode === "room" && draft.rooms.length > 1 && editScope !== "property";
  const showRoomFocusBanner = showRoomPicker && !isLiveEdit;

  return (
    <div className="space-y-6">
      {isRoomOfProperty ? null : (
      <div className={`rounded-xl border shadow-sm ${isAssistedDraft && !isLiveEdit ? "border-amber-200 bg-amber-50/80 px-4 py-3" : "border-border bg-bg-light p-4 px-5"}`}>
        <h3 className="text-[15px] font-bold text-primary">{heading}</h3>
        {isAssistedDraft && !isLiveEdit ? (
          <div className="mt-2 border-t border-amber-200 pt-2">
            {isSelfServeAssistedDraft ? (
              <>
                <p className="text-xs font-semibold text-amber-800">Revisa lo que armamos con tu publicación</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Corrige lo que falte antes de publicar. La IA puede haber dejado campos vacíos.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-amber-800">Borrador creado por Bestie</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Revisa los datos y edita lo que necesites. Al publicar se creará tu cuenta y el
                  anuncio quedará bajo tu nombre.
                </p>
                <p className="mt-1.5 text-xs text-amber-700">
                  Se te pedirá tu correo electrónico al crear tu cuenta — ese será el canal por el que
                  recibirás notificaciones de Bestie y mensajes de roomies interesados en tu anuncio.
                </p>
              </>
            )}
            {fieldConflicts.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-medium text-amber-900">
                {fieldConflicts.map((c) => (
                  <li key={`${c.field}-${c.message}`}>{c.message}</li>
                ))}
              </ul>
            ) : null}
            {rentMissing ? (
              <p className="mt-1.5 text-xs font-semibold text-error">
                Falta el precio de renta. Agrégalo en «Editar encabezado» — no se puede publicar
                en 0 MXN / mes.
              </p>
            ) : null}
          </div>
        ) : null}
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
      )}

      {showRoomFocusBanner && !isRoomOfProperty ? (
        <label className="block text-sm font-medium text-body">
          Recámara en vista previa
          <select
            value={safeRoomIndex}
            onChange={(e) => onRoomIndexChange(Number(e.target.value))}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {draft.rooms.map((r, i) => (
              <option key={i} value={i}>
                {roomPreviewOptionLabel(r, i)}
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
        onRoomIndexChange={onRoomIndexChange}
        onCommitAndPublish={onCommitAndPublish}
        onPublish={onPublish}
        publishAfterRoomFix={publishAfterRoomFix}
        onPublishAfterRoomFixChange={setPublishAfterRoomFix}
        jumpToRoomIndex={jumpToRoomIndex}
        onJumpToRoomHandled={() => setJumpToRoomIndex(null)}
        onRoomModalDismiss={
          cancelTo
            ? () => navigate(cancelTo)
            : undefined
        }
        confirmLabel={primaryLabel}
        submitInFlight={submitInFlight}
        publishBlockedReason={publishBlockedReason}
        actionErr={actionErr}
        initialEditingPhotos={initialEditingPhotos}
        onEditingPhotosChange={onEditingPhotosChange}
        onPhotoPickerOpen={onPhotoPickerOpen}
        isAssistedDraft={isAssistedDraft && !isLiveEdit}
      />

      {isRoomOfProperty ? null : (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {rentMissing ? <MissingRentCallout className="mb-4" /> : null}
        {hasRoomFieldIssues ? (
          <div className={rentMissing ? "mt-3" : ""}>
            <RoomSaveIssuesCallout
              draft={draft}
              prefix={isLiveEdit ? "Para guardar," : "Para publicar,"}
              onOpenRoom={(index) => openIncompleteRoom(index, true)}
            />
          </div>
        ) : publishBlockedReason && !rentOnlyBlock ? (
          <p
            className={`rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning-fg ${
              rentMissing ? "mt-3" : ""
            }`}
            role="status"
          >
            {isLiveEdit ? "Para guardar:" : "Para publicar:"} {publishBlockedReason}
          </p>
        ) : null}
        {actionErr ? (
          <p
            className={`text-sm text-error ${publishBlockedReason || rentMissing || hasRoomFieldIssues ? "mt-3" : ""}`}
            role="alert"
          >
            {actionErr}
          </p>
        ) : draftSaved ? (
          <p className="mt-3 text-sm font-medium text-primary" role="status">
            Borrador guardado. Puedes cerrar esta página y retomarlo con el mismo enlace.
          </p>
        ) : null}

        <div
          className={`flex flex-col gap-2 ${
            publishBlockedReason || actionErr || rentMissing || draftSaved || hasRoomFieldIssues ? "mt-5" : ""
          }`}
        >
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null || nonRoomBlock}
              title={nonRoomBlock ? (publishBlockedReason ?? undefined) : undefined}
              onClick={attemptPublish}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {hasRoomFieldIssues
                ? roomSaveIssuesPrimaryLabel(draft, firstIncompleteRoom)
                : primaryLabel}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sin API: configura <code className="rounded bg-surface-elevated px-1">VITE_API_URL</code> para publicar.
            </span>
          )}
          {apiOn && !isLiveEdit ? (
            <button
              type="button"
              disabled={submitInFlight !== null}
              onClick={onSaveDraft}
              className="w-full rounded-full border border-secondary/60 bg-white px-5 py-2.5 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/10 disabled:opacity-50"
            >
              {submitInFlight === "draft" ? "Guardando…" : "Guardar como borrador"}
            </button>
          ) : null}
          {isLiveEdit && cancelTo ? (
            <Link
              to={cancelTo}
              className="inline-flex w-full items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated"
            >
              {cancelLabel}
            </Link>
          ) : null}
        </div>

        {!isLiveEdit ? <PublishReviewDisclaimer /> : null}
      </section>
      )}
    </div>
  );
}

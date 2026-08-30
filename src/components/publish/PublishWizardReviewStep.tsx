import { useState } from "react";
import { AlertCircle, ChevronRight, Wand2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PublishWizardActionBar } from "@/components/publish/PublishWizardActionBar";
import { listingPublicPath } from "@/lib/listingReference";
import { isListingRentMissing } from "@/lib/listingTags";
import { isRoomAvailableForRent } from "@/lib/roomDisplay";
import {
  firstRoomIndexMissingRent,
  firstRoomIndexWithIssues,
  isRentRequiredPublishError,
  isStandaloneRoomPost,
  roomPreviewOptionLabel,
  roomSaveIssuesPrimaryLabel,
} from "@/lib/publishWizard/roomWizardValidation";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
import { PublishReviewDisclaimer } from "@/components/publish/PublishReviewDisclaimer";
import { RoomSaveIssuesCallout } from "@/components/publish/RoomSaveIssuesCallout";
import { AdminConsentEvidenceForm } from "@/components/admin/AdminConsentEvidenceForm";
import type { Draft } from "@/pages/PublishWizardPage";
import type { ListingStatus } from "@/types/listing";

export type LiveEditScope = "property" | "room";

type LiveEditContext = {
  status: Extract<ListingStatus, "published" | "paused" | "draft">;
  returnListingId?: string | null;
  /** When set, Cancelar returns to Mis Anuncios instead of the public listing. */
  myListingsRestorePath?: string | null;
  /** Pass through so the public listing can still offer Volver a Mis anuncios. */
  myListingsReturnState?: unknown;
  /** When set, Cancelar returns to Admin → Posts. */
  adminPostsRestorePath?: string | null;
  /** Outreach claim draft (`/anuncio/A…?claim=`). Shown in addition to Posts. */
  claimDraftReturnPath?: string | null;
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
  /** Admin publishing an unclaimed outreach draft — consent screenshot instead of claim-publish. */
  adminOutreachEvidence?: {
    onPublish: (file: File, note?: string) => void;
  } | null;
  /** False for unclaimed admin outreach (no Bestie inbox until claimed). */
  hasChat?: boolean;
  savePhoneToProfile?: boolean;
  onSavePhoneToProfileChange?: (next: boolean) => void;
  fieldConflicts?: Array<{ field: string; message: string }>;
  onStepBack?: () => void;
  showStepBack?: boolean;
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
  adminOutreachEvidence = null,
  hasChat = true,
  savePhoneToProfile = false,
  onSavePhoneToProfileChange,
  fieldConflicts = [],
  onStepBack,
  showStepBack = false,
}: Props) {
  const navigate = useNavigate();
  const [jumpToRoomIndex, setJumpToRoomIndex] = useState<number | null>(null);
  const [jumpToRoomIssueId, setJumpToRoomIssueId] = useState<string | null>(null);
  const [publishAfterRoomFix, setPublishAfterRoomFix] = useState(false);
  const isLiveEdit = liveEdit != null;
  const editScope = liveEdit?.scope ?? null;
  const returnListingId = liveEdit?.returnListingId ?? null;
  const myListingsRestorePath = liveEdit?.myListingsRestorePath ?? null;
  const myListingsReturnState = liveEdit?.myListingsReturnState;
  const adminPostsRestorePath = liveEdit?.adminPostsRestorePath ?? null;
  const claimDraftReturnPath = liveEdit?.claimDraftReturnPath ?? null;
  const cancelTo = myListingsRestorePath
    ? myListingsRestorePath
    : adminPostsRestorePath
      ? adminPostsRestorePath
      : liveEdit?.status === "draft"
        ? null
        : returnListingId
          ? listingPublicPath(returnListingId)
          : null;
  const cancelLabel = myListingsRestorePath
    ? "Volver a Mis anuncios"
    : adminPostsRestorePath
      ? "Volver a Posts"
      : "Cancelar";
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
  const rentMissing =
    !draft.hidePricing &&
    (isPropertyPreview
      ? draft.rooms.some((r) => isRoomAvailableForRent(r) && isListingRentMissing(r.rentMxn))
      : isListingRentMissing(activeRoom?.rentMxn));
  const rentOnlyBlock =
    rentMissing &&
    Boolean(publishBlockedReason) &&
    /Renta \(MXN/.test(publishBlockedReason ?? "") &&
    !publishBlockedReason?.includes(";");
  const firstIncompleteRoom = firstRoomIndexWithIssues(draft);
  const hasRoomFieldIssues = firstIncompleteRoom >= 0;
  const nonRoomBlock = Boolean(publishBlockedReason) && !hasRoomFieldIssues;

  const openIncompleteRoom = (
    index: number,
    thenPublish: boolean,
    issueId?: string | null,
  ) => {
    setPublishAfterRoomFix(isStandaloneRoomPost(draft) ? false : thenPublish);
    setJumpToRoomIssueId(issueId ?? null);
    setJumpToRoomIndex(index);
  };

  const openMissingRentRoom = () => {
    const idx = isPropertyPreview ? firstRoomIndexMissingRent(draft) : safeRoomIndex;
    if (idx >= 0) openIncompleteRoom(idx, !isStandaloneRoomPost(draft));
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
        Solo estás cambiando esta recámara. Usa el ícono de lápiz en cada bloque para fotos, precio, descripción y
        más.
      </>
    ) : isLiveEdit && liveEdit.status === "draft" ? (
      <>
        Así se verá tu anuncio publicado. Usa el ícono de lápiz en cada bloque para cambiar fotos, precio,
        descripción y más.
      </>
    ) : isLiveEdit ? (
      <>
        Tu anuncio se ve como en la página publicada. Usa el ícono de lápiz en cada bloque para cambiar fotos, precio,
        descripción y más.
      </>
    ) : isPropertyPreview ? (
      <>
        Así se verá tu propiedad publicada. Usa el ícono de lápiz en cada sección y en cada recámara para ajustar el
        contenido.
      </>
    ) : (
      <>
        Así se verá tu anuncio publicado. Usa el ícono de lápiz en cada bloque para ajustar el contenido aquí mismo,
        sin salir de este paso.
      </>
    );

  const showRoomPicker = draft.postMode === "room" && draft.rooms.length > 1 && editScope !== "property";
  const showRoomFocusBanner = showRoomPicker && !isLiveEdit;

  const publishActionButtons = (
    <>
      {adminOutreachEvidence ? (
        <AdminConsentEvidenceForm
          busy={submitInFlight !== null}
          onPublish={(file, note) => {
            if (hasRoomFieldIssues) {
              openIncompleteRoom(firstIncompleteRoom, true);
              return;
            }
            if (publishBlockedReason) return;
            adminOutreachEvidence.onPublish(file, note);
          }}
        />
      ) : apiOn ? (
        <button
          type="button"
          disabled={submitInFlight !== null || nonRoomBlock}
          title={nonRoomBlock ? (publishBlockedReason ?? undefined) : undefined}
          onClick={attemptPublish}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50 sm:w-auto"
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
      {apiOn && (!isLiveEdit || liveEdit.status === "draft") ? (
        <button
          type="button"
          disabled={submitInFlight !== null}
          onClick={onSaveDraft}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-secondary/60 bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition enabled:hover:bg-secondary/10 disabled:opacity-50 sm:w-auto"
        >
          {submitInFlight === "draft" ? "Guardando…" : "Guardar como borrador"}
        </button>
      ) : null}
      {isLiveEdit && claimDraftReturnPath ? (
        <Link
          to={claimDraftReturnPath}
          className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated sm:w-auto"
        >
          Volver al borrador
        </Link>
      ) : null}
      {isLiveEdit && cancelTo ? (
        <Link
          to={cancelTo}
          className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated sm:w-auto"
        >
          {cancelLabel}
        </Link>
      ) : null}
    </>
  );

  return (
    <div className="min-w-0 space-y-6">
      {isRoomOfProperty ? null : (
      <div className="min-w-0 rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-bold tracking-tight text-primary">{heading}</h3>
          {isAssistedDraft && !isLiveEdit ? (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Wand2 className="size-3" aria-hidden />
              {isSelfServeAssistedDraft ? "Armado con IA" : "Creado por Bestie"}
            </span>
          ) : null}
        </div>

        {isAssistedDraft && !isLiveEdit && !isSelfServeAssistedDraft ? (
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
            {adminOutreachEvidence ? (
              <p>
                Este es un anuncio de crecimiento. Para publicarlo sin dueño, adjunta una captura de
                consentimiento (no las fotos del anuncio). La evidencia no se muestra al público.
              </p>
            ) : (
              <>
                <p>
                  Revisa los datos y edita lo que necesites. Al publicar se creará tu cuenta y el anuncio
                  quedará bajo tu nombre.
                </p>
                <p>
                  Se te pedirá tu correo electrónico al crear tu cuenta — ese será el canal por el que
                  recibirás notificaciones de Bestie y mensajes de roomies interesados en tu anuncio.
                </p>
              </>
            )}
          </div>
        ) : null}

        {isAssistedDraft && !isLiveEdit && isSelfServeAssistedDraft ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Revisa lo que armamos con tu publicación y corrige lo que falte antes de publicar. La IA
            puede haber dejado campos vacíos.
          </p>
        ) : null}

        <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>

        {isAssistedDraft && !isLiveEdit && fieldConflicts.length > 0 ? (
          <ul
            className="mt-3 list-disc space-y-1 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 pl-7 text-xs font-medium text-warning-fg"
            role="status"
          >
            {fieldConflicts.map((c) => (
              <li key={`${c.field}-${c.message}`}>{c.message}</li>
            ))}
          </ul>
        ) : null}

        {isAssistedDraft && !isLiveEdit && rentMissing ? (
          <button
            type="button"
            onClick={openMissingRentRoom}
            className="mt-3 flex w-full min-h-11 items-start gap-2.5 rounded-xl border border-error/30 bg-error/5 px-3 py-2.5 text-left text-error transition hover:bg-error/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-tight">Falta el precio de renta</span>
              <span className="mt-0.5 block text-xs font-normal leading-snug text-error/90">
                Toca para abrirlo. No se puede publicar en 0 MXN / mes.
              </span>
            </span>
            <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
          </button>
        ) : null}

        {isLiveEdit && liveEdit.status !== "draft" && returnListingId ? (
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
        jumpToRoomIssueId={jumpToRoomIssueId}
        onJumpToRoomHandled={() => {
          setJumpToRoomIndex(null);
          setJumpToRoomIssueId(null);
        }}
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
        savePhoneToProfile={savePhoneToProfile}
        onSavePhoneToProfileChange={onSavePhoneToProfileChange}
        hasChat={hasChat}
      />

      {isRoomOfProperty ? null : (
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        {rentMissing ||
        (isRentRequiredPublishError(actionErr) && firstRoomIndexMissingRent(draft) >= 0) ? (
          <MissingRentCallout
            className="mb-4"
            onEdit={openMissingRentRoom}
          />
        ) : null}
        {hasRoomFieldIssues ? (
          <div className={rentMissing ? "mt-3" : ""}>
            <RoomSaveIssuesCallout
              draft={draft}
              prefix={isLiveEdit ? "Para guardar," : "Para publicar,"}
              onOpenRoom={(index, issue) => openIncompleteRoom(index, true, issue?.id)}
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
        {actionErr &&
        !(isRentRequiredPublishError(actionErr) && firstRoomIndexMissingRent(draft) >= 0) ? (
          <p
            className={`text-sm text-error ${publishBlockedReason || rentMissing || hasRoomFieldIssues ? "mt-3" : ""}`}
            role="alert"
          >
            {actionErr}
          </p>
        ) : !actionErr && draftSaved ? (
          <p className="mt-3 text-sm font-medium text-primary" role="status">
            Borrador guardado. Puedes cerrar esta página y retomarlo con el mismo enlace.
          </p>
        ) : null}

        {isLiveEdit ? (
          <div
            className={`flex flex-col gap-2 ${
              publishBlockedReason || actionErr || rentMissing || draftSaved || hasRoomFieldIssues ? "mt-5" : ""
            }`}
          >
            {publishActionButtons}
          </div>
        ) : null}
      </section>
      )}

      {!isLiveEdit && !isRoomOfProperty ? (
        <PublishWizardActionBar className={showStepBack ? "sm:justify-between" : "sm:justify-end"}>
          {showStepBack && onStepBack ? (
            <button
              type="button"
              onClick={onStepBack}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated sm:w-auto"
            >
              Atrás
            </button>
          ) : null}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {publishActionButtons}
          </div>
        </PublishWizardActionBar>
      ) : null}

      {!isLiveEdit && !isRoomOfProperty ? <PublishReviewDisclaimer /> : null}
    </div>
  );
}

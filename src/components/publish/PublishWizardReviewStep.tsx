import { Link } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";
import { isListingRentMissing } from "@/lib/listingTags";
import { EditableListingPreview } from "@/components/publish/EditableListingPreview";
import { MissingRentCallout } from "@/components/publish/MissingRentCallout";
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
  /** Shown after a successful explicit “Guardar como borrador”. */
  draftSaved?: boolean;
  /** Owner editing an already-published or paused listing (not the first-time wizard). */
  liveEdit?: LiveEditContext | null;
  initialEditingPhotos?: boolean;
  onEditingPhotosChange?: (editing: boolean) => void;
  onPhotoPickerOpen?: () => void;
  /** True when the draft was created by the AI assistant, not manually. */
  isAssistedDraft?: boolean;
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
  draftSaved = false,
  liveEdit = null,
  initialEditingPhotos = false,
  onEditingPhotosChange,
  onPhotoPickerOpen,
  isAssistedDraft = false,
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

  const safeRoomIndex = Math.min(roomIndex, Math.max(0, draft.rooms.length - 1));
  const activeRoom = draft.rooms[safeRoomIndex];
  const rentMissing = isListingRentMissing(activeRoom?.rentMxn);
  const rentOnlyBlock =
    rentMissing &&
    Boolean(publishBlockedReason) &&
    /Renta \(MXN/.test(publishBlockedReason ?? "") &&
    !publishBlockedReason?.includes(";");
  const activeRoomTitle = activeRoom?.title.trim() || "Sin título";
  const activeRoomLabel = `Recámara ${safeRoomIndex + 1}`;
  const propertyLabel = draft.propertyTitle.trim() || draft.neighborhood.trim() || null;

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
    ) : (
      <>
        Así se verá tu anuncio publicado. Toca <strong className="font-medium text-body">Editar</strong> en cada
        bloque para ajustar el contenido aquí mismo, sin salir de este paso.
      </>
    );

  const showRoomPicker = draft.rooms.length > 1 && editScope !== "property";
  const showRoomFocusBanner = editScope === "room" || (showRoomPicker && !isLiveEdit);

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border shadow-sm ${isAssistedDraft && !isLiveEdit ? "border-amber-200 bg-amber-50/80 px-4 py-3" : "border-border bg-bg-light p-4 px-5"}`}>
        <h3 className="text-[15px] font-bold text-primary">{heading}</h3>
        {isAssistedDraft && !isLiveEdit ? (
          <div className="mt-2 border-t border-amber-200 pt-2">
            <p className="text-xs font-semibold text-amber-800">Borrador creado por Bestie</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Revisa los datos y edita lo que necesites. Al publicar se creará tu cuenta y el
              anuncio quedará bajo tu nombre.
            </p>
            <p className="mt-1.5 text-xs text-amber-700">
              Se te pedirá tu correo electrónico al crear tu cuenta — ese será el canal por el que
              recibirás notificaciones de Bestie y mensajes de roomies interesados en tu anuncio.
            </p>
            {rentMissing ? (
              <p className="mt-1.5 text-xs font-semibold text-error">
                Falta el precio de renta. Agrégalo en «Editar encabezado» — no se puede publicar
                en 0 MXN / mes.
              </p>
            ) : null}
          </div>
        ) : null}
        {editScope === "room" && activeRoom ? (
          <div className="mt-3 rounded-xl border border-primary/25 bg-primary px-4 py-3 text-primary-fg shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-fg/80">
              Estás editando solo esta recámara
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight sm:text-xl">
              {activeRoomLabel}
              <span className="font-semibold text-primary-fg/90"> · {activeRoomTitle}</span>
            </p>
            {propertyLabel ? (
              <p className="mt-1 text-sm text-primary-fg/80">En {propertyLabel}</p>
            ) : null}
            {showRoomPicker ? (
              <label className="mt-3 block text-xs font-semibold text-primary-fg/90">
                Cambiar de recámara
                <select
                  value={safeRoomIndex}
                  onChange={(e) => onRoomIndexChange(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-primary-fg/25 bg-primary-fg/10 px-3 py-2 text-sm font-medium text-primary-fg outline-none ring-secondary focus:ring-2"
                >
                  {draft.rooms.map((r, i) => (
                    <option key={i} value={i} className="text-body">
                      Recámara {i + 1}: {r.title.trim() || "Sin título"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        <p className={`text-sm text-muted ${editScope === "room" && activeRoom ? "mt-3" : "mt-2"}`}>{intro}</p>
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

      {showRoomFocusBanner && editScope !== "room" ? (
        <label className="block text-sm font-medium text-body">
          Recámara en vista previa
          <select
            value={safeRoomIndex}
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
        initialEditingPhotos={initialEditingPhotos}
        onEditingPhotosChange={onEditingPhotosChange}
        onPhotoPickerOpen={onPhotoPickerOpen}
        isAssistedDraft={isAssistedDraft && !isLiveEdit}
      />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {rentMissing ? <MissingRentCallout className="mb-4" /> : null}
        {publishBlockedReason && !rentOnlyBlock ? (
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
            className={`text-sm text-error ${publishBlockedReason || rentMissing ? "mt-3" : ""}`}
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
            publishBlockedReason || actionErr || rentMissing || draftSaved ? "mt-5" : ""
          }`}
        >
          {apiOn ? (
            <button
              type="button"
              disabled={submitInFlight !== null || Boolean(publishBlockedReason)}
              title={publishBlockedReason ?? undefined}
              onClick={onPublish}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {primaryLabel}
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

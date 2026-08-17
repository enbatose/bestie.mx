import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import {
  draftImagesAppend,
  listSharedDumpPhotosNotInRoom,
  type DraftImage,
} from "@/lib/publishWizard/draftImages";
import type { Draft } from "@/pages/PublishWizardPage";

type Props = {
  draft: Draft;
  roomIndex: number;
  roomPhotos: DraftImage[];
  maxCount: number;
  onTake: (nextPhotos: DraftImage[]) => void;
};

/** Lets a recámara claim dump / shared-area photos without leaving the room editor. */
export function SharedDumpPhotosPicker({
  draft,
  roomIndex,
  roomPhotos,
  maxCount,
  onTake,
}: Props) {
  if (draft.postMode !== "property") return null;
  const pool = listSharedDumpPhotosNotInRoom(draft, roomIndex, roomPhotos);
  if (!pool.length) return null;
  const remaining = Math.max(0, maxCount - roomPhotos.length);

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-light p-3 text-sm">
      <p className="font-medium text-body">Usar fotos del dump</p>
      <p className="mt-1 text-xs text-muted">
        Estas fotos están en áreas compartidas o sin categorizar. Toca una para pasarla a esta
        recámara.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pool.map((photo) => {
          const full = remaining === 0;
          return (
            <button
              key={photo.url}
              type="button"
              disabled={full}
              onClick={() => {
                if (full) return;
                onTake(
                  draftImagesAppend(
                    roomPhotos,
                    { url: photo.url, isCover: roomPhotos.length === 0 },
                    maxCount,
                  ),
                );
              }}
              className="group overflow-hidden rounded-lg border border-border bg-surface text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <img
                src={apiAbsoluteUrl(photo.url)}
                alt=""
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <span className="block min-h-9 px-1.5 py-1.5 text-center text-[11px] font-semibold text-primary group-disabled:text-muted">
                {full ? "Límite" : "Usar aquí"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { Draft } from "@/pages/PublishWizardPage";
import { normalizeListingImageUrlForApi } from "@/lib/listingImageUrls";
import { uploadListingImage } from "@/lib/listingsApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import type { DraftImage } from "@/lib/publishWizard/draftImages";
import { preferDraftImages, syncDraftPhotoArrays } from "@/lib/publishWizard/draftImages";

async function uploadDraftImageUrlIfNeeded(url: string): Promise<string> {
  const normalized = normalizeListingImageUrlForApi(url);
  if (normalized) return normalized;

  const fetchUrl = url.startsWith("http://") || url.startsWith("https://") ? url : apiAbsoluteUrl(url);
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`No se pudo preparar una foto (${fetchUrl}).`);
  }
  const blob = await res.blob();
  const ext =
    blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const name = url.split("/").pop()?.replace(/\?.*$/, "") || `photo.${ext}`;
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  return uploadListingImage(file);
}

async function ensureDraftImagesUploaded(images: readonly DraftImage[]): Promise<DraftImage[]> {
  if (!images.length) return [];
  const out: DraftImage[] = [];
  for (const img of images) {
    const url = await uploadDraftImageUrlIfNeeded(img.url);
    out.push({ ...img, url });
  }
  return out;
}

/** Uploads local/seed preview URLs so sync/publish can persist `/api/uploads/...` paths. */
export async function ensureDraftListingImagesUploadedForApi(draft: Draft): Promise<Draft> {
  draft = syncDraftPhotoArrays(draft);
  const commonAreaPhotos = await ensureDraftImagesUploaded(
    preferDraftImages(draft.commonAreaPhotos, draft.propertyImageUrls),
  );
  const unassignedImageUrls = await ensureDraftImagesUploaded(draft.unassignedImageUrls);
  const rooms = await Promise.all(
    draft.rooms.map(async (room, i) => ({
      ...room,
      photos: await ensureDraftImagesUploaded(
        preferDraftImages(room.photos, draft.roomImageUrls[i]),
      ),
    })),
  );
  const roomImageUrls = rooms.map((room) => room.photos);
  return {
    ...draft,
    rooms,
    commonAreaPhotos,
    propertyImageUrls: commonAreaPhotos,
    unassignedImageUrls,
    roomImageUrls,
  };
}

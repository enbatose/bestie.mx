import type { Draft } from "@/pages/PublishWizardPage";
import { normalizeListingImageUrlForApi } from "@/lib/listingImageUrls";
import { uploadListingImage } from "@/lib/listingsApi";
import { apiAbsoluteUrl } from "@/lib/mediaUrl";
import type { DraftImage } from "@/lib/publishWizard/draftImages";

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
  const propertyImageUrls = await ensureDraftImagesUploaded(draft.propertyImageUrls);
  const unassignedImageUrls = await ensureDraftImagesUploaded(draft.unassignedImageUrls);
  const roomImageUrls = await Promise.all(
    draft.roomImageUrls.map((row) => ensureDraftImagesUploaded(row ?? [])),
  );
  return { ...draft, propertyImageUrls, unassignedImageUrls, roomImageUrls };
}

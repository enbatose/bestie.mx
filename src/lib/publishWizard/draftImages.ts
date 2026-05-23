/** Imagen en borrador del wizard; la portada se persiste como primera URL al publicar. */
export type DraftImage = {
  url: string;
  isCover: boolean;
};

export function normalizeDraftImages(raw: DraftImage[] | string[] | undefined): DraftImage[] {
  if (!raw?.length) return [];
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((url, i) => ({ url, isCover: i === 0 }));
  }
  const out: DraftImage[] = [];
  let hasCover = false;
  for (const item of raw as DraftImage[]) {
    if (!item?.url) continue;
    const isCover = Boolean(item.isCover) && !hasCover;
    if (isCover) hasCover = true;
    out.push({ url: item.url, isCover });
  }
  if (out.length && !hasCover) out[0]!.isCover = true;
  return out;
}

/** Ordena con portada primero; formato que consume el API (`imageUrls`). */
export function draftImagesToUrls(images: readonly DraftImage[]): string[] {
  if (!images.length) return [];
  const cover = images.find((i) => i.isCover);
  const rest = images.filter((i) => !i.isCover).map((i) => i.url);
  if (cover) return [cover.url, ...rest.filter((u) => u !== cover.url)];
  return images.map((i) => i.url);
}

export function hydrateDraftImagesFromUrls(urls: readonly string[]): DraftImage[] {
  return urls.map((url, i) => ({ url, isCover: i === 0 }));
}

export function setDraftImageCover(images: readonly DraftImage[], url: string): DraftImage[] {
  return images.map((img) => ({ ...img, isCover: img.url === url }));
}

export function removeDraftImage(images: readonly DraftImage[], index: number): DraftImage[] {
  const next = images.filter((_, i) => i !== index);
  if (next.length && !next.some((i) => i.isCover)) next[0]!.isCover = true;
  return next;
}

export function appendDraftImageUrl(
  images: readonly DraftImage[],
  url: string,
  maxCount: number,
): DraftImage[] {
  const next = [...images, { url, isCover: images.length === 0 }];
  return next.slice(0, maxCount);
}

export function draftImageUrlAt(images: readonly DraftImage[], index: number): string | undefined {
  return images[index]?.url;
}

export function draftImagesWithoutUrl(images: readonly DraftImage[], url: string): DraftImage[] {
  const next = images.filter((img) => img.url !== url);
  if (next.length && !next.some((i) => i.isCover)) next[0]!.isCover = true;
  return next;
}

export function draftImagesAppend(
  images: readonly DraftImage[],
  item: DraftImage,
  maxCount: number,
): DraftImage[] {
  const without = images.filter((img) => img.url !== item.url);
  const merged = item.isCover
    ? [item, ...without.map((img) => ({ ...img, isCover: false }))]
    : [...without, item];
  if (!merged.some((i) => i.isCover) && merged[0]) merged[0]!.isCover = true;
  return merged.slice(0, maxCount);
}

export function normalizePersistedDraftImages<T extends {
  propertyImageUrls: DraftImage[] | string[];
  unassignedImageUrls: DraftImage[] | string[];
  roomImageUrls: (DraftImage[] | string[])[];
}>(draft: T): T {
  return {
    ...draft,
    propertyImageUrls: normalizeDraftImages(draft.propertyImageUrls),
    unassignedImageUrls: normalizeDraftImages(draft.unassignedImageUrls),
    roomImageUrls: draft.roomImageUrls.map((row) => normalizeDraftImages(row)),
  };
}

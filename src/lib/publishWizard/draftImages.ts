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

/**
 * When dual photo fields diverge (commonAreaPhotos vs propertyImageUrls, rooms[].photos vs
 * roomImageUrls), recover added photos from the longer strict-superset side.
 * An explicit empty primary array means the gallery was cleared — do not revive fallback.
 */
export function preferDraftImages(
  primary: DraftImage[] | string[] | undefined,
  fallback: DraftImage[] | string[] | undefined,
): DraftImage[] {
  if (primary === undefined) {
    return normalizeDraftImages(fallback);
  }
  const a = normalizeDraftImages(primary);
  // Writers set `[]` when the user removes every photo; keep that clear.
  if (a.length === 0) return [];
  const b = normalizeDraftImages(fallback);
  if (b.length === 0) return a;
  const ua = draftImagesToUrls(a);
  const ub = draftImagesToUrls(b);
  if (ua.join("\0") === ub.join("\0")) return a;
  const setA = new Set(ua);
  const setB = new Set(ub);
  if (ub.length > ua.length && ua.every((u) => setB.has(u))) return b;
  if (ua.length > ub.length && ub.every((u) => setA.has(u))) return a;
  return a;
}

/** Keep property + room photo mirrors in sync before autosave / publish / edit save. */
export function syncDraftPhotoArrays<
  T extends {
    commonAreaPhotos?: DraftImage[];
    propertyImageUrls?: DraftImage[];
    unassignedImageUrls?: DraftImage[];
    roomImageUrls?: DraftImage[][];
    rooms: Array<{ photos?: DraftImage[] } & Record<string, unknown>>;
  },
>(d: T): T {
  const commonAreaPhotos = preferDraftImages(d.commonAreaPhotos, d.propertyImageUrls);
  const legacyRows = d.roomImageUrls ?? [];
  const rooms = d.rooms.map((room, i) => ({
    ...room,
    photos: preferDraftImages(room.photos, legacyRows[i]),
  }));
  const roomImageUrls = rooms.map((r) => normalizeDraftImages(r.photos));
  while (roomImageUrls.length < rooms.length) roomImageUrls.push([]);
  return {
    ...d,
    rooms,
    commonAreaPhotos,
    propertyImageUrls: commonAreaPhotos,
    unassignedImageUrls: normalizeDraftImages(d.unassignedImageUrls),
    roomImageUrls: roomImageUrls.slice(0, Math.max(rooms.length, 1)),
  };
}

export type PhotoAssignDest = "uncat" | "shared" | "facade" | `room:${number}`;

export function parsePhotoAssignDest(raw: string): PhotoAssignDest | null {
  if (raw === "uncat" || raw === "shared" || raw === "facade") return raw;
  const m = /^room:(\d+)$/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return null;
  return `room:${n}`;
}

type AssignablePhotoDraft = {
  commonAreaPhotos?: DraftImage[];
  propertyImageUrls?: DraftImage[];
  unassignedImageUrls?: DraftImage[];
  roomImageUrls?: DraftImage[][];
  rooms: Array<{ photos?: DraftImage[] } & Record<string, unknown>>;
};

function stripDraftPhoto<T extends AssignablePhotoDraft>(d: T, url: string): T {
  const common = draftImagesWithoutUrl(preferDraftImages(d.commonAreaPhotos, d.propertyImageUrls), url);
  const rooms = d.rooms.map((room, i) => ({
    ...room,
    photos: draftImagesWithoutUrl(preferDraftImages(room.photos, d.roomImageUrls?.[i]), url),
  }));
  return {
    ...d,
    commonAreaPhotos: common,
    propertyImageUrls: common,
    unassignedImageUrls: draftImagesWithoutUrl(normalizeDraftImages(d.unassignedImageUrls), url),
    rooms,
    roomImageUrls: rooms.map((room) => normalizeDraftImages(room.photos)),
  };
}

/** Move a photo between unassigned, common areas, facade, or a room. */
export function assignDraftPhoto<T extends AssignablePhotoDraft>(
  d: T,
  url: string,
  dest: PhotoAssignDest,
): T {
  const trimmed = url.trim();
  if (!trimmed) return d;
  const stripped = stripDraftPhoto(d, trimmed);
  const item: DraftImage = { url: trimmed, isCover: dest === "facade" };

  if (dest === "uncat") {
    return syncDraftPhotoArrays({
      ...stripped,
      unassignedImageUrls: draftImagesAppend(
        normalizeDraftImages(stripped.unassignedImageUrls),
        { url: trimmed, isCover: false },
        120,
      ),
    });
  }

  if (dest === "shared" || dest === "facade") {
    const nextShared = draftImagesAppend(
      preferDraftImages(stripped.commonAreaPhotos, stripped.propertyImageUrls),
      item,
      20,
    );
    return syncDraftPhotoArrays({
      ...stripped,
      commonAreaPhotos: nextShared,
      propertyImageUrls: nextShared,
    });
  }

  const idx = Number(dest.slice("room:".length)) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= stripped.rooms.length) return stripped;
  const row = preferDraftImages(stripped.rooms[idx]?.photos, stripped.roomImageUrls?.[idx]);
  const nextRow = draftImagesAppend(row, { url: trimmed, isCover: row.length === 0 }, 20);
  return syncDraftPhotoArrays({
    ...stripped,
    rooms: stripped.rooms.map((room, i) => (i === idx ? { ...room, photos: nextRow } : room)),
  });
}

type RoomModePhotoDraft = {
  postMode?: string;
  commonAreaPhotos?: DraftImage[];
  propertyImageUrls?: DraftImage[];
  roomImageUrls?: DraftImage[][];
  rooms: Array<{ photos?: DraftImage[] } & Record<string, unknown>>;
};

/**
 * AI room drafts historically stored the gallery on the property row while the
 * room slot stayed `[]`. Preview falls back to property photos; the editor does
 * not. Copy them onto the room once at hydrate so Editar fotos can see them.
 * Do not call this on every keystroke — an explicit empty room gallery would
 * revive stale property photos.
 */
export function hydrateRoomModePhotosFromProperty<T extends RoomModePhotoDraft>(d: T): T {
  if (d.postMode !== "room") return d;
  const roomPhotos = normalizeDraftImages(d.rooms[0]?.photos);
  const roomLegacy = normalizeDraftImages(d.roomImageUrls?.[0]);
  if (roomPhotos.length > 0 || roomLegacy.length > 0) return d;
  const propertyPhotos = preferDraftImages(d.commonAreaPhotos, d.propertyImageUrls);
  if (propertyPhotos.length === 0) return d;
  const rooms = d.rooms.map((room, i) => (i === 0 ? { ...room, photos: propertyPhotos } : room));
  const roomImageUrls = [...(d.roomImageUrls ?? [])];
  while (roomImageUrls.length < Math.max(rooms.length, 1)) roomImageUrls.push([]);
  roomImageUrls[0] = propertyPhotos;
  return { ...d, rooms, roomImageUrls };
}

/** Room-mode canonical gallery is the room slot; keep property `imageUrls` as a mirror. */
export function mirrorRoomModePhotosToProperty<T extends RoomModePhotoDraft>(d: T): T {
  if (d.postMode !== "room") return d;
  const roomPhotos = preferDraftImages(d.rooms[0]?.photos, d.roomImageUrls?.[0]);
  return {
    ...d,
    commonAreaPhotos: roomPhotos,
    propertyImageUrls: roomPhotos,
  };
}

/** Photos shown in the room-post editor; falls back to property only when the room slot is empty. */
export function roomModeEditorImages(
  postMode: string | undefined,
  roomPhotos: DraftImage[] | undefined,
  roomFallback: DraftImage[] | undefined,
  propertyPhotos: DraftImage[] | undefined,
  propertyFallback: DraftImage[] | undefined,
): DraftImage[] {
  const room = preferDraftImages(roomPhotos, roomFallback);
  if (room.length > 0 || postMode !== "room") return room;
  return preferDraftImages(propertyPhotos, propertyFallback);
}

export function normalizePersistedDraftImages<T extends {
  commonAreaPhotos?: DraftImage[] | string[];
  propertyImageUrls: DraftImage[] | string[];
  unassignedImageUrls: DraftImage[] | string[];
  roomImageUrls: (DraftImage[] | string[])[];
}>(draft: T): T {
  // Prefer non-empty side when hydrating older JSON that only filled one mirror.
  const commonRaw =
    normalizeDraftImages(draft.commonAreaPhotos).length > 0
      ? draft.commonAreaPhotos
      : normalizeDraftImages(draft.propertyImageUrls).length > 0
        ? draft.propertyImageUrls
        : draft.commonAreaPhotos ?? draft.propertyImageUrls;
  const commonAreaPhotos = normalizeDraftImages(commonRaw);
  return {
    ...draft,
    commonAreaPhotos,
    propertyImageUrls: commonAreaPhotos,
    unassignedImageUrls: normalizeDraftImages(draft.unassignedImageUrls),
    roomImageUrls: draft.roomImageUrls.map((row) => normalizeDraftImages(row)),
  };
}

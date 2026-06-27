import { useEffect, useState } from "react";
import type { LucideProps } from "lucide-react";
import savedSearchPng from "@/assets/icons/saved-search.png";

const ICON_MASK_VERSION = 2;

const WHITE_THRESHOLD = 240;
const maskCache = new Map<string, string>();

function buildIconMask(src: string): Promise<string> {
  const cacheKey = `${src}@${ICON_MASK_VERSION}`;
  const cached = maskCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          const r = pixels[i] ?? 0;
          const g = pixels[i + 1] ?? 0;
          const b = pixels[i + 2] ?? 0;
          const a = pixels[i + 3] ?? 0;
          const isNearWhite = r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
          if (a === 0 || isNearWhite) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      const pad = 2;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(canvas.width - 1, maxX + pad);
      maxY = Math.min(canvas.height - 1, maxY + pad);
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const cropped = ctx.getImageData(minX, minY, cropW, cropH);
      const croppedPixels = cropped.data;

      for (let i = 0; i < croppedPixels.length; i += 4) {
        const r = croppedPixels[i] ?? 0;
        const g = croppedPixels[i + 1] ?? 0;
        const b = croppedPixels[i + 2] ?? 0;
        const a = croppedPixels[i + 3] ?? 0;
        const isNearWhite = r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
        if (a === 0 || isNearWhite) {
          croppedPixels[i + 3] = 0;
          continue;
        }
        croppedPixels[i] = 255;
        croppedPixels[i + 1] = 255;
        croppedPixels[i + 2] = 255;
        croppedPixels[i + 3] = 255;
      }

      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext("2d");
      if (!outCtx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      outCtx.putImageData(cropped, 0, 0);
      const dataUrl = out.toDataURL("image/png");
      maskCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error(`Unable to load icon source: ${src}`));
    img.src = src;
  });
}

/** Magnifying glass + floppy disk — saved search navigation icon. */
export function SavedSearchIcon({ className }: LucideProps) {
  const [maskUrl, setMaskUrl] = useState(() => maskCache.get(`${savedSearchPng}@${ICON_MASK_VERSION}`) ?? "");

  useEffect(() => {
    let cancelled = false;
    void buildIconMask(savedSearchPng)
      .then((next) => {
        if (!cancelled) setMaskUrl(next);
      })
      .catch(() => {
        if (!cancelled) setMaskUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span
      className={["inline-block shrink-0 bg-current", className].filter(Boolean).join(" ")}
      style={
        maskUrl
          ? {
              WebkitMaskImage: `url(${maskUrl})`,
              maskImage: `url(${maskUrl})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
            }
          : undefined
      }
      aria-hidden
    />
  );
}

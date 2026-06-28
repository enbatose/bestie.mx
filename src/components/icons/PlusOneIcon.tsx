import { useEffect, useState } from "react";
import type { LucideProps } from "lucide-react";
import sharedRoomPng from "@/assets/icons/room/shared-room.png";

const PRIMARY_RGB = [0x14, 0x3d, 0x30] as const;
const WHITE_THRESHOLD = 240;
const tintedIconCache = new Map<string, string>();

function tintSourceIcon(src: string): Promise<string> {
  const cached = tintedIconCache.get(src);
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

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;
        const a = pixels[i + 3] ?? 0;
        const isNearWhite = r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
        if (a === 0 || isNearWhite) {
          pixels[i + 3] = 0;
          continue;
        }
        pixels[i] = PRIMARY_RGB[0];
        pixels[i + 1] = PRIMARY_RGB[1];
        pixels[i + 2] = PRIMARY_RGB[2];
        pixels[i + 3] = a;
      }

      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      tintedIconCache.set(src, dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error(`Unable to load icon source: ${src}`));
    img.src = src;
  });
}

/** Exact shared-room asset, recolored to match other filter icons. */
export function PlusOneIcon({ className }: LucideProps) {
  const [tintedSrc, setTintedSrc] = useState(() => tintedIconCache.get(sharedRoomPng) ?? sharedRoomPng);

  useEffect(() => {
    let cancelled = false;
    void tintSourceIcon(sharedRoomPng)
      .then((next) => {
        if (!cancelled) setTintedSrc(next);
      })
      .catch(() => {
        if (!cancelled) setTintedSrc(sharedRoomPng);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className={["inline-flex h-full w-full items-center justify-center", className].filter(Boolean).join(" ")} aria-hidden>
      <img src={tintedSrc} alt="" className="h-full w-full object-contain object-center" />
    </span>
  );
}

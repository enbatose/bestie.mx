import { useEffect, useState } from "react";
import type { LucideProps } from "lucide-react";
import highHeelPng from "@/assets/icons/gender/highheel.png";
import mixedPng from "@/assets/icons/gender/mixed.png";
import mustachePng from "@/assets/icons/gender/mustache.png";

const PRIMARY_RGB = [0x14, 0x3d, 0x30] as const;
const WHITE_THRESHOLD = 240;
const tintedIconCache = new Map<string, string>();

function imageShellClass(className?: string) {
  return ["inline-flex items-center justify-center", className].filter(Boolean).join(" ");
}

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

function TintedPngIcon({
  className,
  src,
  innerClassName = "h-full w-full object-contain",
}: {
  className?: string;
  src: string;
  innerClassName?: string;
}) {
  const [tintedSrc, setTintedSrc] = useState(() => tintedIconCache.get(src) ?? src);

  useEffect(() => {
    let cancelled = false;
    void tintSourceIcon(src)
      .then((next) => {
        if (!cancelled) setTintedSrc(next);
      })
      .catch(() => {
        if (!cancelled) setTintedSrc(src);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <span className={imageShellClass(className)} aria-hidden>
      <img src={tintedSrc} alt="" className={innerClassName} />
    </span>
  );
}

/** Exact provided high-heel asset, recolored to match filter icons. */
export function HighHeelIcon({ className }: LucideProps) {
  return <TintedPngIcon className={className} src={highHeelPng} />;
}

/** Exact provided mustache asset, recolored to match filter icons. */
export function MustacheIcon({ className }: LucideProps) {
  return <TintedPngIcon className={className} src={mustachePng} />;
}

export const GENDER_MIXED_ICON_CLASS = "h-full w-[1.9rem] sm:w-[2.1rem]";

/** Mixto gender filter: exact provided neutral icon, recolored to match filter icons. */
export function GenderMixedIcon({ className }: LucideProps) {
  return (
    <TintedPngIcon
      className={className ?? GENDER_MIXED_ICON_CLASS}
      src={mixedPng}
      innerClassName="h-full w-full object-contain"
    />
  );
}

function quickAttributeGenderIconClass(id: string, mobile: boolean): string {
  if (id === "gender-mixed") {
    return mobile ? "h-4 w-[1.85rem]" : "h-[1.05rem] w-[2.05rem] sm:h-[1.1rem] sm:w-[2.15rem]";
  }
  if (id === "gender-female") {
    return mobile ? "h-[1.15rem] w-[1.45rem]" : "h-[1.2rem] w-[1.55rem] sm:h-[1.25rem] sm:w-[1.65rem]";
  }
  if (id === "gender-male") {
    return mobile ? "h-[1.05rem] w-[1.55rem]" : "h-[1.1rem] w-[1.65rem] sm:h-[1.15rem] sm:w-[1.75rem]";
  }
  return mobile ? "size-3.5" : "size-4 sm:size-[1.05rem]";
}

export { quickAttributeGenderIconClass };

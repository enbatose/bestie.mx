import type { LucideProps } from "lucide-react";
import highHeelPng from "@/assets/icons/gender/highheel.png";
import mustachePng from "@/assets/icons/gender/mustache.png";

function imageShellClass(className?: string) {
  return ["inline-flex items-center justify-center", className].filter(Boolean).join(" ");
}

/** Exact provided high-heel asset, scaled to fit the badge. */
export function HighHeelIcon({ className }: LucideProps) {
  return (
    <span className={imageShellClass(className)} aria-hidden>
      <img src={highHeelPng} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

/** Exact provided mustache asset, scaled to fit the badge. */
export function MustacheIcon({ className }: LucideProps) {
  return (
    <span className={imageShellClass(className)} aria-hidden>
      <img src={mustachePng} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

export const GENDER_MIXED_ICON_CLASS = "h-full w-[1.9rem] sm:w-[2.1rem]";

/** Mixto gender filter: exact high heel and mustache assets side by side. */
export function GenderMixedIcon({ className }: LucideProps) {
  return (
    <span className={imageShellClass(className ?? GENDER_MIXED_ICON_CLASS)} aria-hidden>
      <span className="inline-flex h-full w-full items-center justify-center gap-0.5">
        <img src={highHeelPng} alt="" className="h-full w-[46%] object-contain" />
        <span className="h-[82%] w-px rounded-full bg-current/65" />
        <img src={mustachePng} alt="" className="h-[54%] w-[42%] object-contain" />
      </span>
    </span>
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

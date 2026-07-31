import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TextareaHTMLAttributes,
} from "react";

type ResizableTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Classes on the outer wrapper (e.g. `mt-2`). */
  containerClassName?: string;
  /** Floor height in px (default 9rem). */
  minHeightPx?: number;
  /** Cap as a fraction of the viewport height (default 0.7). */
  maxHeightVh?: number;
};

const DEFAULT_MIN_PX = 144; // 9rem
const DEFAULT_MAX_VH = 0.7;
const HANDLE_SIZE = 40;

function maxHeightPx(vhFraction: number): number {
  if (typeof window === "undefined") return 640;
  return Math.round(window.innerHeight * vhFraction);
}

/** Diagonal grip lines — larger and higher contrast than the native browser resizer. */
function ResizeGripIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden
      className={className}
    >
      <path
        d="M4.5 14.5 L14.5 4.5 M8 14.5 L14.5 8 M11.5 14.5 L14.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Textarea with a large, visible bottom-right drag handle to grow/shrink height.
 * Replaces the tiny native browser resize grip on publish description fields.
 */
export function ResizableTextarea({
  className = "",
  containerClassName = "",
  minHeightPx = DEFAULT_MIN_PX,
  maxHeightVh = DEFAULT_MAX_VH,
  style,
  onChange,
  ...props
}: ResizableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(
        maxHeightPx(maxHeightVh),
        Math.max(minHeightPx, drag.startHeight + (e.clientY - drag.startY)),
      );
      setHeight(next);
    }

    function onUp() {
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [maxHeightVh, minHeightPx]);

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const el = textareaRef.current;
    if (!el) return;
    dragRef.current = { startY: e.clientY, startHeight: el.offsetHeight };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }

  const mergedStyle: CSSProperties = {
    ...style,
    minHeight: minHeightPx,
    maxHeight: `${maxHeightVh * 100}vh`,
    height: height ?? style?.height,
  };

  return (
    <div className={`relative ${containerClassName}`.trim()}>
      <textarea
        {...props}
        ref={textareaRef}
        onChange={onChange}
        style={mergedStyle}
        className={`w-full resize-none pb-10 ${className}`.trim()}
      />
      <div
        role="presentation"
        title="Arrastra para agrandar o reducir"
        aria-label="Arrastra para cambiar la altura del texto"
        onPointerDown={startDrag}
        className="absolute bottom-2 right-2 z-10 flex cursor-ns-resize touch-none items-center justify-center rounded-lg border-2 border-primary/35 bg-surface text-primary shadow-md transition hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.97]"
        style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
      >
        <ResizeGripIcon />
      </div>
    </div>
  );
}

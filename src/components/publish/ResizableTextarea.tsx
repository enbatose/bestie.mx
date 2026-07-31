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

/** Hit target (invisible); visual grip stays small like a native textarea resizer. */
const HANDLE_HIT = 22;

function maxHeightPx(vhFraction: number): number {
  if (typeof window === "undefined") return 640;
  return Math.round(window.innerHeight * vhFraction);
}

/**
 * Classic textarea corner grip: two short parallel diagonals.
 * Subtle gray, no chrome — matches the native browser look, just clearer.
 */
function NativeStyleResizeGrip() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="block">
      <path
        d="M7.5 11 L11 7.5 M9.5 11 L11 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Textarea with a subtle native-style bottom-right drag grip (two diagonal lines).
 * Keeps a slightly larger invisible hit target so dragging stays easy.
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
        className={`w-full resize-none ${className}`.trim()}
      />
      <div
        role="presentation"
        title="Arrastra para agrandar o reducir"
        aria-label="Arrastra para cambiar la altura del texto"
        onPointerDown={startDrag}
        className="absolute bottom-0 right-0 z-10 flex cursor-ns-resize touch-none items-end justify-end p-1 text-muted/80 hover:text-body"
        style={{ width: HANDLE_HIT, height: HANDLE_HIT }}
      >
        <NativeStyleResizeGrip />
      </div>
    </div>
  );
}

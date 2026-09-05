import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  imageFilesFromClipboard,
  isTypingPasteTarget,
  shouldAcceptClipboardImagePaste,
  type ClipboardPasteTargetState,
} from "@/lib/clipboardImages";

type RegisteredPasteTarget = {
  snapshot: () => ClipboardPasteTargetState;
};

const registered = new Map<string, RegisteredPasteTarget>();

type Options = {
  enabled: boolean;
  onFiles: (files: File[]) => void;
};

/**
 * Ctrl/Cmd+V images without focusing the drop zone first.
 * Several widgets: the hovered/focused one wins; a single enabled widget takes global paste.
 */
export function useClipboardImagePaste({ enabled, onFiles }: Options): {
  zoneRef: RefObject<HTMLDivElement | null>;
  zonePasteProps: {
    tabIndex: 0;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
} {
  const id = useId();
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [pointerOver, setPointerOver] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const pointerOverRef = useRef(pointerOver);
  pointerOverRef.current = pointerOver;

  useEffect(() => {
    registered.set(id, {
      snapshot: () => ({
        id,
        enabled: enabledRef.current,
        pointerOver: pointerOverRef.current,
        focused: (() => {
          const zone = zoneRef.current;
          if (!zone) return false;
          const ae = document.activeElement;
          return Boolean(ae && (ae === zone || zone.contains(ae)));
        })(),
      }),
    });
    return () => {
      registered.delete(id);
    };
  }, [id]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!enabledRef.current) return;
      let typedText = "";
      try {
        typedText = event.clipboardData?.getData("text/plain")?.trim() ?? "";
      } catch {
        typedText = "";
      }
      if (isTypingPasteTarget(event.target) && typedText) return;
      const targets = [...registered.values()].map((t) => t.snapshot());
      if (!shouldAcceptClipboardImagePaste(targets, id)) return;
      const files = imageFilesFromClipboard(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      onFilesRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [id]);

  return {
    zoneRef,
    zonePasteProps: {
      tabIndex: 0,
      onMouseEnter: () => setPointerOver(true),
      onMouseLeave: () => setPointerOver(false),
    },
  };
}

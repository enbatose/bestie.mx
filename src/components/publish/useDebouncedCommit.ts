import { useCallback, useEffect, useRef } from "react";

/** Commit `value` after idle time; also flush on unmount. Skips the initial mount. */
export function useDebouncedCommit<T>(
  value: T,
  commit: (value: T) => void,
  delayMs = 2000,
): () => void {
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const valueRef = useRef(value);
  valueRef.current = value;
  const dirtyRef = useRef(false);
  const skipFirst = useRef(true);

  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    commitRef.current(valueRef.current);
  }, []);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    dirtyRef.current = true;
    const t = window.setTimeout(flush, delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs, flush]);

  useEffect(() => () => flush(), [flush]);

  return flush;
}

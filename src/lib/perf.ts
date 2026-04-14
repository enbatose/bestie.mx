type PerfMark = {
  name: string;
  t0: number;
};

export type PerfSpan = {
  name: string;
  ms: number;
};

export function perfNowMs(): number {
  // Prefer High Resolution Time when available.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (globalThis as any).performance as Performance | undefined;
    if (p && typeof p.now === "function") return p.now();
  } catch {
    /* ignore */
  }
  return Date.now();
}

export function perfStart(name: string): PerfMark {
  return { name, t0: perfNowMs() };
}

export function perfEnd(mark: PerfMark): PerfSpan {
  return { name: mark.name, ms: Math.max(0, perfNowMs() - mark.t0) };
}

export function perfSampleImageInput(file: File): Record<string, unknown> {
  return {
    inputBytes: file.size,
    inputType: file.type || "unknown",
    inputName: file.name || "unnamed",
  };
}


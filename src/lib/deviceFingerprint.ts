const STORAGE_KEY = "bestie_device_fp_v1";

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    let v = localStorage.getItem(STORAGE_KEY);
    if (!v || v.length < 8) {
      v = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

export function deviceHeaders(): Record<string, string> {
  const fp = getDeviceFingerprint();
  return fp ? { "X-Device-Fingerprint": fp } : {};
}

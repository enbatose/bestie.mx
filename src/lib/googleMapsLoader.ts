let loadPromise: Promise<void> | null = null;

export function googleMapsApiKey(): string | null {
  return import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim() || null;
}

export function loadGoogleMapsScript(): Promise<void> {
  const key = googleMapsApiKey();
  if (!key) return Promise.reject(new Error("google_maps_api_key_missing"));

  if (typeof window !== "undefined" && window.google?.maps?.StreetViewPanorama) {
    return Promise.resolve();
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-bestie-google-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("google_maps_load_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.dataset.bestieGoogleMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google_maps_load_failed"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

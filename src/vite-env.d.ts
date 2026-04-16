/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Optional override for default prod API host (default `https://api.bestie.mx` on bestie.mx / www). */
  readonly VITE_API_ORIGIN_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

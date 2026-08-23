export type BlogBlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "quote"
  | "list"
  | "cta"
  | "faq";

export type BlogBlock = {
  id: string;
  type: BlogBlockType;
  level?: 2 | 3;
  text?: string;
  items?: string[];
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSource?: string;
  href?: string;
  label?: string;
  question?: string;
  answer?: string;
};

export type BlogSource = {
  id: number;
  title: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
};

export type BlogFaqItem = { question: string; answer: string };

export type BlogQualitySuggestion = {
  id: string;
  title: string;
  detail: string;
  accepted?: boolean;
};

export type BlogSimilarityWarning = {
  articleId: string;
  title: string;
  path: string;
  score: number;
};

export function parseJsonArray<T>(raw: unknown, fallback: T[] = []): T[] {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function parseLabels(raw: unknown): string[] {
  return parseJsonArray<string>(raw)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 24);
}

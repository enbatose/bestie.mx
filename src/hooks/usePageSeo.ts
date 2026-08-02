import { useEffect } from "react";
import { applyPageSeo, type PageSeoInput } from "@/lib/seo";

/** Sets document head SEO for the active route; cleans managed JSON-LD on unmount. */
export function usePageSeo(input: PageSeoInput) {
  const jsonLdKey = input.jsonLd ? JSON.stringify(input.jsonLd) : "";
  useEffect(() => {
    return applyPageSeo({
      title: input.title,
      description: input.description,
      canonicalPath: input.canonicalPath,
      ogType: input.ogType,
      noindex: input.noindex,
      jsonLd: input.jsonLd,
    });
    // Intentional: serialize jsonLd; callers pass stable title/description strings.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jsonLdKey stands in for jsonLd
  }, [input.title, input.description, input.canonicalPath, input.ogType, input.noindex, jsonLdKey]);
}

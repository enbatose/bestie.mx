import { useEffect, useState } from "react";
import { fetchCityListingsCount } from "@/lib/listingsApi";

/**
 * Total published cards in the metro area, used by the "Ver todas (N)" exit.
 * Returns `null` while loading or when the count is unavailable so callers can
 * hide the control instead of showing a broken number.
 */
export function useCityListingsCount(cityCode: string | null | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!cityCode) {
      setCount(null);
      return;
    }
    const ac = new AbortController();
    fetchCityListingsCount(cityCode, ac.signal)
      .then(setCount)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setCount(null);
      });
    return () => ac.abort();
  }, [cityCode]);

  return count;
}

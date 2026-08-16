import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/listingsApi";

type Props = {
  /** Metro city code (e.g. "gdl") to scope the search. */
  cityCode: string;
  /** Called when the user picks a suggestion. */
  onSelect: (hit: {
    lat: number;
    lng: number;
    zoom: number;
    neighborhood?: string;
    label: string;
  }) => void;
  /** When the map pin moves, parent sends the reverse-geocoded address to keep the field in sync. */
  syncAddress?: string | null;
  className?: string;
};

/** City-label → metro-code mapping for the publish wizard. */
const CITY_TO_CODE: Record<string, string> = {
  Guadalajara: "gdl",
};

export function cityToCode(city: string): string {
  return CITY_TO_CODE[city] ?? "gdl";
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-muted"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function PinIcon({ kind }: { kind: LocationSuggestion["kind"] }) {
  if (kind === "address") {
    return (
      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    );
  }
  return (
    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
    </svg>
  );
}

function buildPrimaryText(s: LocationSuggestion): string {
  return s.streetAddress ?? s.neighborhood ?? s.city;
}

function buildSecondaryText(s: LocationSuggestion): string {
  const parts: string[] = [];
  if (s.streetAddress && s.neighborhood) parts.push(s.neighborhood);
  if (s.city) parts.push(s.city);
  return parts.join(", ");
}

export function WizardAddressSearch({ cityCode, onSelect, syncAddress, className = "" }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const doSearch = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setIsLoading(true);
      try {
        const results = await fetchLocationSuggestions(q, {
          cityCode,
          scope: "publish",
          signal: ac.signal,
        });
        if (!ac.signal.aborted) {
          const seen = new Set<string>();
          const unique = results.filter((s) => {
            const key = `${buildPrimaryText(s).trim().toLowerCase()}|${buildSecondaryText(s).trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setSuggestions(unique);
          setIsOpen(unique.length > 0);
          setActiveIdx(-1);
        }
      } catch {
        // ignored: abort or network error
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    },
    [cityCode],
  );

  const handleChange = (q: string) => {
    setQuery(q);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      abortRef.current?.abort();
      return;
    }
    debounceRef.current = setTimeout(() => void doSearch(q), 350);
  };

  const handleSelect = (s: LocationSuggestion) => {
    const label = buildPrimaryText(s);
    setQuery(label);
    setIsOpen(false);
    setSuggestions([]);
    onSelect({
      lat: s.lat,
      lng: s.lng,
      zoom: s.zoom,
      neighborhood: s.neighborhood ?? undefined,
      label,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const s = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
        if (s) handleSelect(s);
        break;
      }
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Close on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!syncAddress) return;
    if (inputRef.current && document.activeElement === inputRef.current) return;
    setQuery((current) => (current === syncAddress ? current : syncAddress));
  }, [syncAddress]);

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 flex items-center">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="search"
          placeholder="Escribe tu dirección o mueve el mapa…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          aria-label="Buscar dirección"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-9 text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-3 flex items-center">
          {isLoading ? (
            <Spinner />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-surface-elevated hover:text-body"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Sugerencias de dirección"
          className="absolute left-0 right-0 top-full z-[1500] mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface shadow-xl"
        >
          {suggestions.map((s, i) => {
            const primary = buildPrimaryText(s);
            const secondary = buildSecondaryText(s);
            return (
              <li
                key={s.key}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  // mousedown fires before blur so we catch the click without closing the list first
                  e.preventDefault();
                  handleSelect(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors ${
                  i === activeIdx ? "bg-surface-elevated" : "hover:bg-surface-elevated/60"
                } ${i > 0 ? "border-t border-border/60" : ""}`}
              >
                <PinIcon kind={s.kind} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-body">{primary}</p>
                  {secondary && (
                    <p className="truncate text-xs text-muted">{secondary}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

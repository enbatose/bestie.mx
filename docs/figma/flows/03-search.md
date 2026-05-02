# 03 — Search (map + list)

## Figma frames

- `Buscar · desktop · map + list`
- `Buscar · mobile · sheet advanced filters`
- `Buscar · empty results`
- `Buscar · loading`
- `Buscar · error API` (banner)

## Route

`/buscar` (querystring drives filters; default city injected when `q` empty)

## Implementation

`src/pages/SearchPage.tsx`  
Components: `SearchTopBar`, `SearchFilterRail`, `SearchResultsList`, `PropertyMap`, `SearchAdvancedSheet`

## User goals

- Refine listings by city, bbox, budget, tags, etc.
- Correlate list selection with map pins.
- Open advanced filters sheet on mobile/narrow layouts.

## Layout zones

| Zone | Contents |
| --- | --- |
| Top bar | Query, filter chips, actions, “advanced” opener |
| Optional rail | `SearchFilterRail` |
| Main split | Map (`PropertyMap`) + results list |
| Overlay | `SearchAdvancedSheet` when `advancedOpen` |

## Components

- `Search/TopBar`
- `Search/FilterRail`
- `Search/ResultCard` or reuse `Listing/Card`
- `Map/Viewport` with pins + bbox-driven “search this area” behavior
- `Sheet/AdvancedFilters`
- `State/InlineError`

## Flows out

- **Listing detail** — tap row or pin → `/anuncio/:id`
- URL updates replace `searchParams` (`applyFilters`, `onViewportBbox`)

## States

- **Guadalajara default** — special-case: may not auto-select first listing (`isGuadalajaraSearch`).
- **API off** — uses seed data (`SEED_LISTINGS`).

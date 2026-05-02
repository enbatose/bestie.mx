# 10 — My listings (publisher hub)

## Figma frames

- `Mis anuncios · loading`
- `Mis anuncios · list with properties/rooms`
- `Mis anuncios · action in progress` (row disabled / spinner)
- `Mis anuncios · flash message` (success banner with optional link)
- `Mis anuncios · missing fields callout` (per property)

## Route

`/mis-anuncios`

## Implementation

`src/pages/MyListingsPage.tsx`

## User goals

- See all owned listings and property status.
- Pause, resume, archive, edit; complete missing legal / profile requirements.
- Jump into wizard for create/edit (`/publicar`, `/publicar?edit=:propertyId`).

## Layout zones

| Zone | Contents |
| --- | --- |
| Header | Title, short help |
| Flash | Optional `flash` message |
| List | Cards/rows per property + nested rooms |
| Actions | Edit, status toggles, upgrade-to-property where applicable |

## Components

- `Publisher/PropertyCard` (status pill: draft / published / paused / archived)
- `Publisher/RoomRow`
- `Publisher/ActionButton` (destructive + normal)
- `Callout/MissingFields` (list of missing labels from `computeMissing` logic — mirror UX, not every string)

## Flows out

- **Publicar** — new or `?edit=`.
- **Anuncio** — view live listing when linked.

## Status vocabulary

Property: Borrador / Publicada / Pausada / Archivada.  
Room: Borrador / Publicado / Pausado / Archivado (see `statusLabel` / `propertyStatusLabel` in file).

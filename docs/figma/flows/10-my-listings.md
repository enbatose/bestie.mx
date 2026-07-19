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
- `Publisher/DesktopRoomTable` — thumb, rent, metrics, overflow actions
- `Publisher/MobileListingCard` — thumb + rent + metrics + overflow (share/archive/restore)
- `Publisher/ListingThumb`, `Publisher/StatusBadge`, `Publisher/ReferenceChip`
- `Callout/MissingFields` → `MissingFieldsCallout.tsx`
- `Dialog/Confirm` with `intent="danger"` before archive (focus trap + `aria-describedby`)

## Owner metrics

- `rooms.views_count` incremented on public listing GET (non-owner)
- Inquiry count from `conversations.listing_room_id`
- Shown as `N vistas · M mensajes` on mobile cards and desktop Métricas column

## Flows out

- **Publicar** — new or `?edit=`.
- **Anuncio** — view live listing when linked.

## Status vocabulary

Property: Borrador / Publicada / Pausada / Archivada.  
Room: Borrador / Publicado / Pausado / Archivado (see `statusLabel` / `propertyStatusLabel` in file).

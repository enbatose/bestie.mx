# 10 — My listings (publisher hub)

## Design principles (canonical)

- **Doc:** [`docs/design/publisher-hub-principles.md`](../../design/publisher-hub-principles.md) — JTBD, reusable P1–P10 vs Mis Anuncios–specific rules, component map.
- **Cursor skill:** `.cursor/skills/publisher-hub-ui/SKILL.md` — auto-apply when redesigning inventory / publisher hubs.
- **Figma DS:** [Bestie.mx — Design System](https://www.figma.com/design/JVO8AoBQ5FJqfvtJXCe6Mv/Bestie.mx-%E2%80%94-Design-System) → `Principles / Publisher Hub` + `Components / Publisher`.

## Figma frames (User flows file)

- `Mis anuncios · loading`
- `Mis anuncios · list with properties/rooms`
- `Mis anuncios · action in progress` (row disabled / spinner)
- `Mis anuncios · flash message` (success banner with optional link)
- `Mis anuncios · missing fields callout` (per property)

## Route

`/mis-anuncios`

## Implementation

`src/pages/MyListingsPage.tsx`

## User goals (JTBD)

- **Inventory scan** — tabs + counts + summary.
- **Lifecycle control** — header On/Off for publication (confirm when Off cascades).
- **Slot management** — rooms accordion + occupancy On/Off.
- **Finish & publish** — missing fields + legal + Publicar.
- **Operate** — Ver / Editar / Compartir / Archivar (mobile icon strip / desktop pills).
- **Performance** — quiet vistas · mensajes.
- **Find one** — search; empty state can jump to another tab.

## Layout zones

| Zone | Contents |
| --- | --- |
| Header | Title, short help |
| Flash | Optional `flash` message |
| List | Cards/rows per property + nested rooms |
| Actions | Edit, status toggles, upgrade-to-property where applicable |

## Components

- `Publisher/PropertyCard` (status pill: draft / published / paused / archived)
- `Publisher/ListingPropertyCard` — unified card for both viewports: status + type badges, On/Off switch, title + place + thumb with reference underneath, footer actions (Ver / Editar / Compartir / Recámaras), rooms accordion
- `Publisher/RoomOnOffToggle` — outlined room switch (On = disponible, Off = ocupada)
- `Publisher/RoomActivationModal` — collects the room rental fields required before offering an occupied room for rent
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

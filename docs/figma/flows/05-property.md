# 05 — Property deep link (redirect)

## Figma frames

- `Propiedad · loading`
- `Propiedad · error / sin cuartos publicados` (final static message + “Volver a buscar”)

## Route

`/propiedad/:id`

## Implementation

`src/pages/PropertyPage.tsx`

## User goals

- Open a property link and land on a **usable room listing** as fast as possible.

## Behavior (for flow arrows, not heavy UI)

- On success with a published room: **immediate redirect** to `/anuncio/:firstPublishedRoomId` — no persistent property landing UI in the happy path.
- Otherwise: short error view + link back to `/buscar`.

## Figma note

Treat this as a **transition node** on your user-flow board (spinner → listing frame), plus one **error end state** frame.

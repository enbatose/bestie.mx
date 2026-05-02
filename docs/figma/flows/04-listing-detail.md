# 04 — Listing detail (room ad)

## Figma frames

- `Anuncio · published · default`
- `Anuncio · published · gallery focus` (optional)
- `Anuncio · unavailable · {draft|paused|archived|not found}` (mirror `unavailableCopy` cases in code)
- `Anuncio · auth required` (modal path — combine with [06-auth-modal](./06-auth-modal.md))

## Route

`/anuncio/:id`

## Implementation

`src/pages/ListingPage.tsx`  
Uses `useAuthModal`, `startConversationFromListing`, optional WhatsApp reveal.

## User goals

- Evaluate room: price, dates, tags, description, photos.
- Start in-app conversation with publisher.
- Optionally use public WhatsApp when enabled.

## Layout zones

| Zone | Contents |
| --- | --- |
| Media | Image gallery / placeholder |
| Title + meta | Rent, location summary, dates, tag chips |
| Body | Description blocks, rules, amenities |
| CTAs | Primary messaging, secondary WhatsApp / share |
| Errors | Friendly unavailable states with bullets + help |

## Components

- `Listing/MediaGallery`
- `Listing/PriceBlock`
- `Listing/TagChip` (labels from `TAG_LABELS`)
- `CTA/ContactBestie` (starts conversation; may open auth)
- `CTA/WhatsApp` (conditional)
- `Panel/Unavailable` (title, lead, bullets, help)

## Flows out

- **Mensajes** — success → `/mensajes?c=:conversationId`
- **Entrar** — when conversation requires auth and user uses full-page auth paths

## Edge flows

- Logged-out **Contact** → auth modal (see shell + auth doc).
- Listing linked to property: show property context as implemented.

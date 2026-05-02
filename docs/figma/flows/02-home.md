# 02 — Home (landing)

## Figma frames

- `Home · default`
- `Home · city chip selected` (optional: hero search focused)

## Route

`/`

## Implementation

`src/pages/HomePage.tsx`

## User goals

- Understand value proposition.
- Start search by text or by choosing a featured city.
- Jump to publish, FAQ, or auth CTAs (per current page content).

## Layout zones

| Zone | Contents |
| --- | --- |
| Hero (dark band) | `BrandLogo` variant on dark, kicker, H1, supporting copy |
| Search row | Search `input`, primary CTA button, city **chips** |
| Body | Additional sections / links below the fold (match live page) |

## Components

- `Hero/Home`
- `Input/SearchHero` (large, on-dark styling)
- `Button/SecondaryOnDark` (search submit)
- `Chip/City` (selectable; scrolls/focuses hero search on select)
- `Link/TextOnDark`

## Flows out

- **Buscar** — `navigate('/buscar', { search })` from query + filters defaults (`buildSearchParams`).
- **Auth** — `openLogin` / `openRegister` from `useAuthModal()` where used.

## States

- Cities list may grow after `fetchFeaturedCities()` — design **wrap** behavior.

# 15 — Contact, FAQ, Legal

## Figma frames (one per page)

- `Contacto · default`
- `FAQ · default` (+ optional accordion expanded state)
- `Legal · default` (long-form scroll)

## Routes

- `/contacto` — `src/pages/ContactPage.tsx`
- `/faq` — `src/pages/FaqPage.tsx`
- `/legal` — `src/pages/LegalPage.tsx`

## User goals

- Reach support, read policies, self-serve answers.

## Shared components

- `Page/MarketingNarrow` (typical `max-w-*` content column)
- `Typography/Prose` for legal body
- `FAQ/AccordionItem` (if FAQ uses disclosure pattern — confirm in component)

## Flows in

- Footer links on every page via shell ([01-app-shell](./01-app-shell.md)).

## Flows out

- Usually none (terminal informational pages); may include `mailto:` or external refs per page.

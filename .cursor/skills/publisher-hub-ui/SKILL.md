---
name: publisher-hub-ui
description: >-
  Apply Bestie Mis Anuncios / publisher-hub design principles when redesigning
  or building inventory management UIs (mis anuncios, owner lists, lifecycle
  hubs). Use for mobile/desktop publisher cards, status tabs, On/Off toggles,
  occupancy patterns, flash toasts, and when deciding what is reusable vs
  Mis Anuncios–specific. Triggers: Mis Publicaciones, Mis Anuncios, my listings,
  publisher hub, listing management UI, inventory hub redesign.
---

# Publisher hub UI principles

Canonical write-up: `docs/design/publisher-hub-principles.md`  
Figma: Design System `JVO8AoBQ5FJqfvtJXCe6Mv` → `Principles / Publisher Hub`, `Components / Publisher`  
Code references: `src/pages/MyListingsPage.tsx`, `src/components/myListings/*`

## When this skill applies

- Redesigning **Mis Anuncios** or another **owner inventory** surface.
- Building management cards with lifecycle status, nested items, or publish/pause.
- Deciding whether a Mis Anuncios pattern is safe to copy into Saved Searches, Mensajes, Account, Search, etc.

Do **not** use this as the brand bible — still follow `.cursor/rules/bestie-brand.mdc` for color, voice, and CTA hierarchy.

## Always separate: reusable vs JTBD-specific

### Reuse (P1–P10)

1. **One card, two densities** — same component; mobile icon action strip, `sm+` labeled pills.
2. **Underline status tabs + count chips** for lifecycle buckets.
3. **Binary control on the badge row** — height-matched On/Off; filled = parent live state, outlined = nested slot.
4. **Tone = entity type** — forest parent / lime single-unit; left border + badge + action tint.
5. **Accordion for nested inventory**; omit empty photo placeholders; quiet ref under thumb.
6. **Flash toast** (mobile bottom / desktop top-right) + inline card errors + confirm for cascade/danger.
7. **Empty/search states guide** — clear copy + one CTA, including jump to another tab with matches.
8. **Quiet owner metrics** — vistas + mensajes (link to inbox).
9. **Return navigation state** when leaving the hub.
10. **Completeness gates on-card** before high-stakes publish.

### Do not copy unless the product has the same invariants

- Publication status ≠ room occupancy.
- Paused items inline under “Publicados”.
- Legal checkbox + missing-fields callout on draft publish.
- Pause parent → mark children occupied.
- Room activation modal for incomplete rental data.
- Listing reference codes (`P…` / `A…`).

## Implementation checklist

- [ ] Match tokens only (`primary`, `secondary`, `warning`, `border`, …) — no arbitrary hex.
- [ ] Spanish `tú` copy; ≤4-word buttons; no gold CTA on this hub.
- [ ] Touch targets `min-h-11` on primary actions and tabs.
- [ ] `role="tablist"` / `role="switch"` / `role="status"` / `role="alert"` as in Mis Anuncios.
- [ ] Layering: flash ~`z-[1800]`, confirms `z-[2200]` (see `ui-layering-precedence.mdc`).
- [ ] Prefer extending `listingCardChrome.tsx` / myListings components over new parallel chrome.
- [ ] If adding Figma components, put them on `Components / Publisher` and update `docs/figma/DESIGN_SYSTEM.md` + `dsb-state.json`.

## Quick anatomy

```
Header (title + secondary CTA)
Summary counts
Search pill
Status tabs + counts
Card:
  badges | On/Off
  title/place/details | photo+ref
  [draft gates]
  actions [| Recámaras]
  [rooms…]
```

## Related

- Brand: `.cursor/rules/bestie-brand.mdc`
- Flow notes: `docs/figma/flows/10-my-listings.md`
- DS overview: `docs/figma/DESIGN_SYSTEM.md`

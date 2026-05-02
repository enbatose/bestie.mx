# 00 — Figma conventions for bestie.mx

## File structure in Figma

1. **Pages** — Use one page per major area in [FLOW-INDEX](./FLOW-INDEX.md) (Shell, Buscar, Publicar, …).
2. **Frames** — One top-level frame per **screen state** (e.g. `Buscar · default`, `Buscar · filtros avanzados abierto`).
3. **Sections** — Inside each frame, use labeled regions (Hero, Rail, Map, …) as **auto-layout** wrappers, not separate frames, unless you need a variant.

## Naming pattern

`{Area} · {screen or step} · {state}`

Examples:

- `Shell · header · logged out`
- `Shell · header · logged in · unread badge`
- `Publicar · paso 3 · Propiedad · property mode`
- `Anuncio · detail · contact CTA`

## Component strategy

| Layer | Figma | Maps to (typical) |
| --- | --- | --- |
| Primitives | `Button/Primary`, `Input/Text`, `Chip`, `Card` | Tailwind + shared patterns in `src/components/` |
| Composed | `ListingCard`, `ConversationRow`, `WizardStepper` | Feature components |
| Templates | `Page/Narrow`, `Page/SearchSplit` | `max-w-*` layouts in pages |

Use **variants** for: auth method (WhatsApp vs email), listing availability states, wizard steps, admin tabs.

## Dev handoff

- Put the **route** and **source file** (from each flow doc) in the frame description.
- For wizard steps, note **step title** exactly as in the app (Spanish strings from `PublishWizardPage`).

## Tokens

Palette reference: `docs/PRODUCT_V1.md` and existing board colors in `bestie-user-flows.svg`. Prefer Figma variables aligned with those names (`primary`, `secondary`, `surface`, …).

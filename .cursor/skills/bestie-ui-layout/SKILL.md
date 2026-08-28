---
name: bestie-ui-layout
description: >-
  Bestie UI layout playbook: 360px-first mobile, no horizontal overflow,
  flex input min-width, AppShell page shells, publish wizard and editable
  preview cards, phone fields, inline pencil editors, action bars, nested
  padding, overflow-x-clip vs hidden. Use when building or changing any UI
  (TSX, Tailwind, forms, modals, wizard, preview, admin outreach, profile),
  when a layout looks shifted/clipped, or when the user mentions Galaxy S8,
  S20, overflow, padding, or mobile vs desktop.
---

# Bestie UI layout

Read this **before** adding or restyling UI. The always-on summary is `.cursor/rules/mobile-layout-overflow.mdc`. Layering: `.cursor/rules/ui-layering-precedence.mdc`. Chips: `.cursor/rules/chip-label-soft-hyphens.mdc`. War stories and measurement steps: [reference.md](reference.md).

## Non-negotiables

1. **Design at 360×740** (Galaxy S8+ / iPhone SE). 390px and 412px (S20 Ultra) hide ~25px overflows. If it only breaks on the smaller phone, it is min-content, not “mobile vs desktop.”
2. **Do not guess from a screenshot.** Measure `getBoundingClientRect()` / `scrollWidth` at 360px. The clipped card is often innocent; walk parents until width > 360.
3. **Same UI on every publish path** when you touch wizard/preview: manual and AI, single-room and property, plus admin outreach if that screen shares the component.

## Copy these patterns

### Page under AppShell `<main>`

`<main>` is `flex flex-col`. Flex items default to `min-width: auto` (content size).

```tsx
<div className="mx-auto w-full min-w-0 overflow-x-clip px-3 py-4 sm:px-6 sm:py-10 max-w-3xl">
```

`max-w-* mx-auto` without `w-full min-w-0` still grows with min-content.

### Flex `<input>` (prefix + field, search + button)

UA `size="20"` ≈ 20ch min-content. `min-w-0` on ancestors is **not** enough.

```tsx
<div className="flex min-w-0 items-stretch gap-2">
  <div className="shrink-0">+52</div>
  <input size={10} className="min-h-11 w-0 min-w-0 flex-1 text-base sm:text-sm" />
</div>
```

Canonical: `PhoneNumberField`. Block fields use `w-full` (`WIZARD_FIELD_CONTROL_CLASS`). `text-base` on mobile avoids iOS focus zoom.

### Overflow

- `overflow-x-hidden` / `auto` = **scroll container**. Focusing an input `scrollIntoView`s it and the page looks shifted left.
- Crop with `overflow-x-clip` (no scroll box). `html`/`body` already use `overflow-x: clip`.
- Never “fix” overflow by hiding it around a form — **remove the extra width**.
- `ring-*` is a box-shadow (paints outside). Prefer `border` on nested editors.

### No `-mx-*` inside padded cards

`-mx-4` on a child of `p-4` is 16px wider than the parent. `PublishWizardActionBar` stays **in-flow** (no sticky/fixed, no negative horizontal margin, opaque `bg-surface`, no backdrop-blur). See ui-layering rule for why sticky fails in `<main>`.

Tab strips that must scroll are the exception: the **same** node has `-mx-4 overflow-x-auto px-4` (it is the scroller). Reset at `sm:`.

### Nested padding at 360px

`360 - 2*(px-3 + p-4 + p-4 + p-3)` ≈ **248px** of content. Do not wrap an already-padded block in another padded/ringed card.

- Wizard Datos Generales: `ListingPhoneCaptureFields` `embedded`.
- Preview pencil editor: compact field + checkboxes + **`PublisherPhoneSafetyCallout` (`dense`)** when “mostrar en publicación” is on. Fraud copy stays out of admin outreach extract form (`showPublisherSafety={false}` there only).
- Preview edit affordance: `PreviewPencilEditButton` (top-right), not a large “Editar” bar.

### Flex children that must shrink

`min-w-0 max-w-full` on flex/grid items. Split actions:

```tsx
<div className="flex min-w-0 gap-2">
  <button className="min-h-10 min-w-0 flex-1 px-3 sm:px-4">Listo</button>
  <button className="min-h-10 min-w-0 flex-1 px-3 sm:px-4">Cancelar</button>
</div>
```

Titles: `break-words min-w-0`. Checkbox rows: `grid-cols-[1.125rem_minmax(0,1fr)]`. Pills: `flex-wrap` + soft hyphens. Touch: `min-h-11`. Modals: `pb-[max(...,env(safe-area-inset-bottom))]`. Overlays that must sit above the header: portal to `document.body` (layering rule).

### Phone listing UX (when touching that UI)

- Optional everywhere. Prefill from profile; post number can differ.
- “Mostrar en la publicación” **on** by default when a valid number exists.
- “Guardar en perfil” only if profile has no phone; “Reemplazar” only if digits differ. No extra helper paragraphs.
- Public API never sends digits (`hasContactPhone` only). Hidden ⇒ field omitted on the published post.

## Before finishing

- [ ] 360×740: equal left/right gutters; nothing past the viewport.
- [ ] 412px still fine.
- [ ] Open every pencil editor and **focus** each input — page must not shift.
- [ ] Manual + AI, room + property; admin outreach if shared.
- [ ] No new `-mx-*` in padded cards; no new `overflow-x-hidden` around forms.
- [ ] Flex inputs use `w-0 min-w-0 flex-1` (or `w-full` if block).
- [ ] Page shell has `w-full min-w-0`.
- [ ] Layering + chip hyphen rules still hold.

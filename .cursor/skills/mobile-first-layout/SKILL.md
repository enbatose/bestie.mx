---
name: mobile-first-layout
description: >-
  Bestie mobile-first layout: prevent horizontal overflow on 360px phones,
  flex input min-width, AppShell flex children, overflow-x-clip vs hidden,
  nested padding budget, and wizard/preview cards. Use when building or
  fixing UI, publish wizard, editable preview, phone fields, admin outreach,
  or any layout that looks shifted/clipped on small phones but fine on larger ones.
---

# Mobile-first layout (Bestie)

Canonical rule: `.cursor/rules/mobile-layout-overflow.mdc` (always applied). This skill is the longer playbook and the regression checklist.

## When this applies

- Any new or changed TSX layout, form, card, modal, or wizard step.
- “Looks fine on my phone / S20 Ultra but broken on S8+.”
- Editable preview, publish wizard (manual + AI, room + property), admin outreach.
- Phone / OTP / search fields in a flex row.

## Viewport truth

| Device | CSS px | Use as |
| --- | --- | --- |
| Galaxy S8+ / iPhone SE | **360×740** | **Must pass** — this is where overflow shows up |
| iPhone 12/13/14 | 390×844 | Common but too wide to catch 360px bugs |
| Galaxy S20 Ultra | 412×915 | Can hide a 25px overflow that 360px shows |

A layout that is 385px wide in a 360px viewport appears as **white gutter on the left and clipping on the right**. `mx-auto` cannot center an overflowing box.

## Root causes we have already hit

1. **`<input>` default `size="20"`** in a flex row. Intrinsic min-content ~20ch. Nested inside wizard `px-3` + card `p-4` + header `p-4` + panel `p-3`, that inflates the whole page past 360px. `min-w-0` on ancestors is not enough. Fix: `size={maxLength}` and `className="w-0 min-w-0 flex-1"`. Shared example: `PhoneNumberField`.
2. **Page root is a flex item of AppShell `<main>`** (`flex flex-col`). Default `min-width: auto` = content size. Fix: `w-full min-w-0` on the page shell (`PublishWizardPage`, `AdminPage` already).
3. **`overflow-x-hidden` on an ancestor of a focused input.** That is a scroll container. Focus → `scrollIntoView` → the card slides left. Use `overflow-x-clip` only as a belt; **delete the extra width**.
4. **`-mx-4` full-bleed** inside a `p-4` card (`PublishWizardActionBar` used to do this). Child is 16px wider than parent. Same sideways-scroll-on-focus. Keep action bars in-flow with no negative horizontal margin.

## Patterns to copy

### Page shell

```tsx
<div className="mx-auto w-full min-w-0 overflow-x-clip px-3 py-4 sm:px-6 sm:py-10 max-w-3xl">
```

### Flex phone / short field

```tsx
<div className="flex min-w-0 items-stretch gap-2">
  <div className="shrink-0 ...">+52</div>
  <input size={10} className="min-h-11 w-0 min-w-0 flex-1 ..." />
</div>
```

Block fields (title, rent): `w-full` (`WIZARD_FIELD_CONTROL_CLASS`), not `flex-1`.

### Nested editor inside a preview card

Do not wrap `ListingPhoneCaptureFields` (already padded) inside another padded + ringed panel. If you need a compact editor, use the bare field + checkboxes (as in `EditableListingPreview`) and `overflow-x-clip` on that panel. Fraud copy stays on the Datos Generales step where there is room.

### Buttons in a split row

```tsx
<div className="flex min-w-0 gap-2">
  <button className="min-h-10 min-w-0 flex-1 px-3 sm:px-4">Listo</button>
  <button className="min-h-10 min-w-0 flex-1 px-3 sm:px-4">Cancelar</button>
</div>
```

## Checklist before shipping UI

- [ ] 360×740: no horizontal clip; left and right page gutters match (`px-3` / `p-4`).
- [ ] Open every inline editor (pencil) and focus each input — page must not shift.
- [ ] Manual **and** AI paths, **room** and **property**, plus **admin outreach** if those screens were touched.
- [ ] No new `-mx-*` inside padded cards; no new `overflow-x-hidden` around forms.
- [ ] Titles `break-words`; chips follow `chip-label-soft-hyphens.mdc`.
- [ ] Touch targets `min-h-11` on primary actions (44px).

## How to debug the next “shifted” screenshot

1. Set DevTools to **360×740**, not a 412px device.
2. Measure the node that *looks* clipped, then walk **parents** until `getBoundingClientRect().width > 360` or `scrollWidth > clientWidth`.
3. The first ancestor that is too wide is the one to fix — often an `<input>` several levels down, not the card you see overflowing.
4. Confirm the page root has `w-full min-w-0`. Confirm no `-mx-*` bleed. Confirm flex inputs use `w-0`.

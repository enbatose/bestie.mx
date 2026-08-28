# Bestie UI layout — why these rules exist

Incidents from the publish-wizard / phone-editor work (2026). Read when a layout “looks shifted” or you are tempted to add `overflow-hidden` / `-mx-*`.

## Symptom that fools you

White gutter on the **left**, content flush or clipped on the **right**. Feels like the phone block is too wide. It is almost always a **min-content width > viewport**, left-aligned because `margin: auto` cannot go negative.

It often appears **only while editing a field**, because focus + `scrollIntoView` moves a parent that is a scroll container (`overflow-x-hidden`) with 8–25px of extra scrollWidth.

It often appears on **Galaxy S8+ (360px)** and not on **S20 Ultra (412px)**. That 52px of slack hides a 25px overflow. Always reproduce at **360×740**.

## Incident 1 — `<input size="20">` in a flex row

**Measured:** wizard shell 385px in a 360px viewport. Phone panel itself was ~293px and looked “fine.” Walking up, the extra width was the input’s UA min-content (~20ch) plus nested padding (`px-3` + `p-4` + `p-4` + `p-3`).

**Failed fixes:** `min-w-0` on wrappers; `overflow-x-hidden` on the shell (turned ancestors into scroll containers, made focus-shift worse).

**Fix:** `size={10}` + `w-0 min-w-0 flex-1` on the input (`PhoneNumberField`). `w-full min-w-0` on the page root so it cannot grow as a flex child of `<main>`.

## Incident 2 — `PublishWizardActionBar` `-mx-4`

**Measured:** `review-root` / `steps-content` `scrollWidth` 348 vs `clientWidth` 332 (exactly 16px). Action bar `right` was 16px past its parent.

**Failed fixes:** compacting the phone panel, clipping `html`.

**Fix:** drop `-mx-4 px-4`. Bar stays inside the step card. In-flow, opaque, not sticky/fixed (sticky does not pin inside AppShell `<main>`).

## Incident 3 — nested padded editors

Wrapping `ListingPhoneCaptureFields` (border + padding + WhatsApp hint + fraud callout) inside the preview’s padded/ringed shell made the inline editor taller than the viewport and wider than 360px.

**Fix:** preview uses a **compact** editor (field + checkboxes + Listo/Cancelar). Fraud copy stays on Datos Generales. `bare` / `embedded` props exist so the full block is not double-padded. Pencil icon (`PreviewPencilEditButton`), not a full-width “Editar” button.

## Incident 4 — `ring-1` vs `border`

`ring-*` is `box-shadow` and paints **outside** the border box. A 1px ring on a panel that already fills its parent can show as 1px overflow. Prefer `border` on nested editors.

## How to measure (do this instead of restyling blindly)

1. DevTools device: **360×740**, not 412.
2. For each ancestor from the focused input up: log `id`, `left`, `right`, `width`, `scrollWidth`, `clientWidth`.
3. Stop at the first node with `width > 360` or `scrollWidth > clientWidth + 1`. That is the source.
4. Check computed `minWidth` / `flex` / `size` on any `<input>` in the chain.
5. After the fix, re-measure **with the input focused**.

A static HTML harness with the same class names and Playwright at `{ width: 360, height: 740 }` is enough; you do not need a logged-in app to prove min-content overflow.

## Padding budget

| Layer | Typical class | Horizontal each side |
| --- | --- | --- |
| Wizard shell | `px-3` | 12px |
| Step card | `p-4` | 16px |
| Preview header | `p-4` | 16px |
| Inner editor | `p-3` | 12px |
| **Total chrome** | | **56px × 2 = 112px** |
| Content at 360 | | **~248px** |

Prefix `w-[3.25rem]` (52px) + `gap-2` (8px) leaves ~188px for the digit field. That only fits if the input can shrink (`w-0`).

## Paths that must stay in sync

Anything in `EditableListingPreview`, `ListingPhoneCaptureFields`, `PhoneNumberField`, or `PublishWizardActionBar` is shared by:

- Manual room wizard
- Manual property wizard
- Self-serve AI compose (room and property)
- Admin outreach claim preview

Admin outreach extra: extraction tables use `overflow-x-auto` + `min-w-0`, not `overflow-hidden` clipping columns.

## Related files

- `src/components/phone/PhoneNumberField.tsx`
- `src/components/publish/ListingPhoneCaptureFields.tsx`
- `src/components/publish/EditableListingPreview.tsx`
- `src/components/publish/PublishWizardActionBar.tsx`
- `src/pages/PublishWizardPage.tsx`
- `src/index.css` (`html`/`body` `overflow-x: clip`)
- `src/layouts/AppShellLayout.tsx` (`<main>` flex column)
